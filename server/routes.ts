import type { Express } from "express";
import { Server } from "http";
import { z } from "zod";
import { insertTransactionSchema, insertBudgetSchema, insertSavingsGoalSchema, insertAccountSchema } from "@shared/schema";
import {
  authMiddleware, AuthRequest, setCookieToken,
  clearCookieToken, signJwt, verifyPassword
} from "./auth";

// ── Storage abstraction (supports both MemStorage and PgStorage) ──────────

type AnyStorage = import("./storage").IStorage | import("./storage-pg").PgStorage;

let _storage: import("./storage").IStorage | null = null;
let _pgStorage: import("./storage-pg").PgStorage | null = null;

async function getStorage(): Promise<{ mem: import("./storage").IStorage | null; pg: import("./storage-pg").PgStorage | null }> {
  if (!_storage || !_pgStorage) {
    // Try PG first, fall back to memory
    if (process.env.DATABASE_URL) {
      try {
        const { pgStorage } = await import("./storage-pg");
        _pgStorage = pgStorage;
        await pgStorage.seedGlobalData();
        console.log("[routes] Using PostgreSQL storage");
      } catch (e) {
        console.warn("[routes] PG failed, using MemStorage:", (e as Error).message);
      }
    }
    if (!_pgStorage) {
      const { storage } = await import("./storage");
      _storage = storage;
      console.log("[routes] Using in-memory storage");
    }
  }
  return { mem: _storage, pg: _pgStorage };
}

// ── Helper: get userId from request (falls back to 1 for mem-storage mode) ─

function getUserId(req: AuthRequest): number {
  return req.userId ?? 1;
}

export async function registerRoutes(httpServer: Server, app: Express) {
  const cookieParser = (await import("cookie-parser")).default;
  app.use(cookieParser());

  const { mem, pg } = await getStorage();

  // Start scheduler if using PG
  if (pg) {
    const { startScheduler } = await import("./scheduler");
    startScheduler(pg);
  }

  // ────────────────────────────────────────────────────────────────────────
  // AUTH ROUTES (no middleware)
  // ────────────────────────────────────────────────────────────────────────

  app.post("/api/auth/register", async (req, res) => {
    if (!pg) return res.status(503).json({ error: "Database not configured. Auth requires PostgreSQL." });
    const { email, name, password } = z.object({
      email: z.string().email(),
      name: z.string().min(1).max(100),
      password: z.string().min(8),
    }).parse(req.body);

    const existing = await pg.getUserByEmail(email);
    if (existing) return res.status(409).json({ error: "Email уже зарегистрирован" });

    const user = await pg.createUser(email, name, password);
    const token = signJwt(user.id);
    setCookieToken(res, token);
    res.json({ id: user.id, email: user.email, name: user.name });
  });

  app.post("/api/auth/login", async (req, res) => {
    if (!pg) return res.status(503).json({ error: "Database not configured" });
    const { email, password } = z.object({
      email: z.string().email(),
      password: z.string(),
    }).parse(req.body);

    const user = await pg.getUserByEmail(email);
    if (!user) return res.status(401).json({ error: "Неверный email или пароль" });

    const valid = await verifyPassword(password, user.hashedPassword);
    if (!valid) return res.status(401).json({ error: "Неверный email или пароль" });

    const token = signJwt(user.id);
    setCookieToken(res, token);
    res.json({ id: user.id, email: user.email, name: user.name });
  });

  app.post("/api/auth/logout", (req, res) => {
    clearCookieToken(res);
    res.json({ ok: true });
  });

  // Returns current user info if authenticated
  app.get("/api/auth/me", authMiddleware, async (req: AuthRequest, res) => {
    if (!pg) return res.json({ id: 1, email: "demo@finwise.app", name: "Demo User" });
    const user = await pg.getUserById(req.userId!);
    if (!user) return res.status(404).json({ error: "User not found" });
    const { hashedPassword: _, ...safeUser } = user;
    res.json(safeUser);
  });

  app.patch("/api/auth/settings", authMiddleware, async (req: AuthRequest, res) => {
    if (!pg) return res.json({ ok: true });
    const userId = req.userId!;
    const data = z.object({
      name: z.string().min(1).max(100).optional(),
      preferredCurrency: z.string().optional(),
      notifyBudget: z.boolean().optional(),
      notifyCredit: z.boolean().optional(),
      notifyInactivity: z.boolean().optional(),
      notifyEmail: z.boolean().optional(),
      notifyPush: z.boolean().optional(),
      pushSubscription: z.string().optional(),
    }).parse(req.body);
    const updated = await pg.updateUser(userId, data);
    const { hashedPassword: _, ...safe } = updated;
    res.json(safe);
  });

  // ────────────────────────────────────────────────────────────────────────
  // OPTIONAL AUTH GUARD: if PG is available → require auth; else allow all
  // ────────────────────────────────────────────────────────────────────────

  const guard = pg ? authMiddleware : (_req: any, _res: any, next: any) => next();

  // ────────────────────────────────────────────────────────────────────────
  // ACCOUNTS
  // ────────────────────────────────────────────────────────────────────────

  app.get("/api/accounts", guard, async (req: AuthRequest, res) => {
    if (!pg) return res.json([]);
    const accounts = await pg.getAccounts(getUserId(req));
    // Enrich with balance
    const enriched = await Promise.all(
      accounts.map(async (acc) => ({
      ...acc,
      balance: acc.type === "credit"
        ? 0                              // кредитка не является активом
        : await pg.getAccountBalance(acc.id),
      debt: acc.type === "credit"
        ? await pg.getCreditDebt(acc.id) // теперь включает initialBalance
        : undefined,
    }))

    );
    res.json(enriched);
  });

  app.post("/api/accounts", guard, async (req: AuthRequest, res) => {
    if (!pg) return res.status(503).json({ error: "DB required" });
    const userId = getUserId(req);
    const parsed = insertAccountSchema.omit({ userId: true, createdAt: true } as any).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    const acc = await pg.createAccount(userId, parsed.data as any);
    res.json(acc);
  });

  app.patch("/api/accounts/:id", guard, async (req: AuthRequest, res) => {
    if (!pg) return res.status(503).json({ error: "DB required" });
    const acc = await pg.updateAccount(Number(req.params.id), getUserId(req), req.body);
    res.json(acc);
  });

  app.delete("/api/accounts/:id", guard, async (req: AuthRequest, res) => {
    if (!pg) return res.status(503).json({ error: "DB required" });
    await pg.archiveAccount(Number(req.params.id), getUserId(req));
    res.json({ ok: true });
  });

  // ────────────────────────────────────────────────────────────────────────
  // TRANSACTIONS (updated to support userId and accountId)
  // ────────────────────────────────────────────────────────────────────────

  app.get("/api/transactions", guard, async (req: AuthRequest, res) => {
    if (pg) {
      const txs = await pg.getTransactions(getUserId(req));
      return res.json(txs);
    }
    const txs = await (mem as any).getTransactions();
    res.json(txs);
  });

  app.get("/api/transactions/account/:accountId", guard, async (req: AuthRequest, res) => {
    if (!pg) return res.json([]);
    const txs = await pg.getTransactionsByAccount(Number(req.params.accountId), getUserId(req));
    res.json(txs);
  });

  app.post("/api/transactions", guard, async (req: AuthRequest, res) => {
    if (pg) {
      const userId = getUserId(req);
      const body = { ...req.body, userId };
      const parsed = insertTransactionSchema.safeParse(body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error });
      const tx = await pg.addTransaction(userId, parsed.data);
      return res.json(tx);
    }
    const parsed = insertTransactionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    const tx = await (mem as any).addTransaction(parsed.data);
    res.json(tx);
  });

  app.delete("/api/transactions/:id", guard, async (req: AuthRequest, res) => {
    if (pg) {
      await pg.deleteTransaction(Number(req.params.id), getUserId(req));
    } else {
      await (mem as any).deleteTransaction(Number(req.params.id));
    }
    res.json({ ok: true });
  });

  // ────────────────────────────────────────────────────────────────────────
  // BUDGETS
  // ────────────────────────────────────────────────────────────────────────

  app.get("/api/budgets", guard, async (req: AuthRequest, res) => {
    if (pg) return res.json(await pg.getBudgets(getUserId(req)));
    res.json(await (mem as any).getBudgets());
  });

  app.post("/api/budgets", guard, async (req: AuthRequest, res) => {
    if (pg) {
      const userId = getUserId(req);
      const parsed = insertBudgetSchema.safeParse({ ...req.body, userId });
      if (!parsed.success) return res.status(400).json({ error: parsed.error });
      return res.json(await pg.addBudget(userId, parsed.data));
    }
    const parsed = insertBudgetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.json(await (mem as any).addBudget(parsed.data));
  });

  app.patch("/api/budgets/:id", guard, async (req: AuthRequest, res) => {
    if (pg) return res.json(await pg.updateBudget(Number(req.params.id), getUserId(req), req.body));
    res.json(await (mem as any).updateBudget(Number(req.params.id), req.body));
  });

  app.delete("/api/budgets/:id", guard, async (req: AuthRequest, res) => {
    if (pg) {
      await pg.deleteBudget(Number(req.params.id), getUserId(req));
    } else {
      await (mem as any).deleteBudget(Number(req.params.id));
    }
    res.json({ ok: true });
  });

  // ────────────────────────────────────────────────────────────────────────
  // LESSONS (with per-user progress if PG available)
  // ────────────────────────────────────────────────────────────────────────

  app.get("/api/lessons", guard, async (req: AuthRequest, res) => {
    if (pg) return res.json(await pg.getLessonsWithProgress(getUserId(req)));
    res.json(await (mem as any).getLessons());
  });

  app.post("/api/lessons/:id/complete", guard, async (req: AuthRequest, res) => {
    if (pg) return res.json(await pg.completeLesson(Number(req.params.id), getUserId(req)));
    res.json(await (mem as any).completeLesson(Number(req.params.id)));
  });

  // ────────────────────────────────────────────────────────────────────────
  // USER PROGRESS
  // ────────────────────────────────────────────────────────────────────────

  app.get("/api/progress", guard, async (req: AuthRequest, res) => {
    if (pg) return res.json(await pg.getUserProgress(getUserId(req)));
    res.json(await (mem as any).getUserProgress());
  });

  // ────────────────────────────────────────────────────────────────────────
  // SAVINGS GOALS
  // ────────────────────────────────────────────────────────────────────────

  app.get("/api/goals", guard, async (req: AuthRequest, res) => {
    if (pg) return res.json(await pg.getSavingsGoals(getUserId(req)));
    res.json(await (mem as any).getSavingsGoals());
  });

  app.post("/api/goals", guard, async (req: AuthRequest, res) => {
    if (pg) {
      const userId = getUserId(req);
      const parsed = insertSavingsGoalSchema.safeParse({ ...req.body, userId });
      if (!parsed.success) return res.status(400).json({ error: parsed.error });
      return res.json(await pg.addSavingsGoal(userId, parsed.data));
    }
    const parsed = insertSavingsGoalSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.json(await (mem as any).addSavingsGoal(parsed.data));
  });

  app.patch("/api/goals/:id/deposit", guard, async (req: AuthRequest, res) => {
    const { amount } = z.object({ amount: z.number() }).parse(req.body);
    if (pg) return res.json(await pg.updateSavingsGoalAmount(Number(req.params.id), getUserId(req), amount));
    res.json(await (mem as any).updateSavingsGoal(Number(req.params.id), amount));
  });

  app.delete("/api/goals/:id", guard, async (req: AuthRequest, res) => {
    if (pg) {
      await pg.deleteSavingsGoal(Number(req.params.id), getUserId(req));
    } else {
      await (mem as any).deleteSavingsGoal(Number(req.params.id));
    }
    res.json({ ok: true });
  });

  // ────────────────────────────────────────────────────────────────────────
  // CATEGORIES
  // ────────────────────────────────────────────────────────────────────────

  app.get("/api/categories", guard, async (req: AuthRequest, res) => {
    if (!pg) return res.json([]);
    res.json(await pg.getCategories(getUserId(req)));
  });

  // ────────────────────────────────────────────────────────────────────────
  // NOTIFICATIONS
  // ────────────────────────────────────────────────────────────────────────

  app.get("/api/notifications", guard, async (req: AuthRequest, res) => {
    if (!pg) return res.json([]);
    res.json(await pg.getNotifications(getUserId(req)));
  });

  app.patch("/api/notifications/:id/read", guard, async (req: AuthRequest, res) => {
    if (!pg) return res.json({ ok: true });
    await pg.markNotificationRead(Number(req.params.id), getUserId(req));
    res.json({ ok: true });
  });

  // ────────────────────────────────────────────────────────────────────────
  // QUICK-ADD (public deep-link endpoint for widgets)
  // GET /api/quick-add?type=expense — returns 200 so SPA can handle the rest
  // ────────────────────────────────────────────────────────────────────────

  app.get("/api/quick-add", (req, res) => {
    res.json({ ok: true, type: req.query.type ?? "expense" });
  });

  return httpServer;
}
