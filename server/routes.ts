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

function getUserId(req: AuthRequest): number {
  return req.userId ?? 1;
}

export async function registerRoutes(httpServer: Server, app: Express) {
  const cookieParser = (await import("cookie-parser")).default;
  app.use(cookieParser());

  const { mem, pg } = await getStorage();

  if (pg) {
    const { startScheduler } = await import("./scheduler");
    startScheduler(pg);
  }

  // ── AUTH ──────────────────────────────────────────────────────────────────

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

  app.get("/api/auth/me", async (req: AuthRequest, res) => {
    if (!pg) return res.status(503).json({ error: "Database not configured. Running in demo mode." });
    const token = req.cookies?.["finwise_token"];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const payload = (await import("./auth")).verifyJwt(token);
    if (!payload) return res.status(401).json({ error: "Invalid or expired token" });
    const user = await pg.getUserById(payload.sub);
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

  const guard = pg ? authMiddleware : (_req: any, _res: any, next: any) => next();

  // ── ACCOUNTS ──────────────────────────────────────────────────────────────

  app.get("/api/accounts", guard, async (req: AuthRequest, res) => {
    if (!pg) return res.json([]);
    const accounts = await pg.getAccounts(getUserId(req));
    const enriched = await Promise.all(
      accounts.map(async (acc) => ({
        ...acc,
        balance: await pg.getAccountBalance(acc.id),
        debt: acc.type === "credit"
          ? await pg.getCreditDebt(acc.id)
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

  // ── TRANSACTIONS ──────────────────────────────────────────────────────────

  app.get("/api/transactions", guard, async (req: AuthRequest, res) => {
    if (pg) {
      const txs = await pg.getTransactions(getUserId(req));
      return res.json(txs);
    }
    const txs = await (mem as any).getTransactions();
    res.json(txs);
  });

  app.get("/api/transactions/monthly-summary", guard, async (req: AuthRequest, res) => {
    if (!pg) return res.json([]);
    const userId = getUserId(req);
    const txs = await pg.getTransactions(userId);
    const map: Record<string, { income: number; expense: number }> = {};
    for (const t of txs) {
      const month = String(t.date).slice(0, 7);
      if (!map[month]) map[month] = { income: 0, expense: 0 };
      if (t.type === "income") map[month].income += Number(t.amount);
      else if (t.type === "expense") map[month].expense += Math.abs(Number(t.amount));
    }
    const result = Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, income: data.income, expense: data.expense }));
    res.json(result);
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
    if (pg) await pg.deleteTransaction(Number(req.params.id), getUserId(req));
    else await (mem as any).deleteTransaction(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── BUDGETS ───────────────────────────────────────────────────────────────

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
    if (pg) await pg.deleteBudget(Number(req.params.id), getUserId(req));
    else await (mem as any).deleteBudget(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── LESSONS ───────────────────────────────────────────────────────────────

  app.get("/api/lessons", guard, async (req: AuthRequest, res) => {
    if (pg) return res.json(await pg.getLessonsWithProgress(getUserId(req)));
    res.json(await (mem as any).getLessons());
  });

  app.post("/api/lessons/:id/complete", guard, async (req: AuthRequest, res) => {
    if (pg) return res.json(await pg.completeLesson(Number(req.params.id), getUserId(req)));
    res.json(await (mem as any).completeLesson(Number(req.params.id)));
  });

  // ── USER PROGRESS ─────────────────────────────────────────────────────────

  app.get("/api/progress", guard, async (req: AuthRequest, res) => {
    if (pg) return res.json(await pg.getUserProgress(getUserId(req)));
    res.json(await (mem as any).getUserProgress());
  });

  // ── SAVINGS GOALS ─────────────────────────────────────────────────────────

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
    try {
      const { amount, accountId } = z.object({
        amount: z.number(),
        accountId: z.number().nullable().optional(),
      }).parse(req.body);
      if (pg) return res.json(await pg.updateSavingsGoalAmount(Number(req.params.id), getUserId(req), amount, accountId ?? null));
      res.json(await (mem as any).updateSavingsGoal(Number(req.params.id), amount));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/goals/:id", guard, async (req: AuthRequest, res) => {
    if (pg) await pg.deleteSavingsGoal(Number(req.params.id), getUserId(req));
    else await (mem as any).deleteSavingsGoal(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── CATEGORIES ────────────────────────────────────────────────────────────

  app.get("/api/categories", guard, async (req: AuthRequest, res) => {
    if (!pg) return res.json([]);
    res.json(await pg.getCategories(getUserId(req)));
  });

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────────

  app.get("/api/notifications", guard, async (req: AuthRequest, res) => {
    if (!pg) return res.json([]);
    res.json(await pg.getNotifications(getUserId(req)));
  });

  app.patch("/api/notifications/:id/read", guard, async (req: AuthRequest, res) => {
    if (!pg) return res.json({ ok: true });
    await pg.markNotificationRead(Number(req.params.id), getUserId(req));
    res.json({ ok: true });
  });

  // ── QUICK-ADD ─────────────────────────────────────────────────────────────

  app.get("/api/quick-add", (req, res) => {
    res.json({ ok: true, type: req.query.type ?? "expense" });
  });

  // ── WIDGET SUMMARY ────────────────────────────────────────────────────────
  // GET /api/widget/summary
  // - totalBalance: только НЕ-кредитные счета (debit, cash, savings)
  // - monthIncome/monthExpense: только type=income/expense (без creditPurchase/creditPayment)
  app.get("/api/widget/summary", async (req: AuthRequest, res) => {
    if (!pg) {
      return res.json({
        totalBalance: 0,
        monthIncome: 0,
        monthExpense: 0,
        streak: 0,
        level: 1,
        totalXp: 0,
        demo: true,
      });
    }

    let userId: number | null = null;
    const token =
      (req as any).cookies?.["finwise_token"] ??
      (req.headers.authorization?.replace("Bearer ", "") || null);
    if (token) {
      const { verifyJwt } = await import("./auth");
      const payload = verifyJwt(token);
      if (payload) userId = payload.sub;
    }

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized. Please login via FinWise web app first." });
    }

    try {
      const accounts = await pg.getAccounts(userId);

      // Суммируем баланс только не-кредитных счетов
      let totalBalance = 0;
      for (const acc of accounts) {
        if (acc.type !== "credit") {
          totalBalance += await pg.getAccountBalance(acc.id);
        }
      }

      // Транзакции за текущий месяц — только income/expense (без кредитных операций)
      const allTxs = await pg.getTransactions(userId);
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const monthTxs = allTxs.filter(t => String(t.date).slice(0, 7) === currentMonth);

      let monthIncome = 0;
      let monthExpense = 0;
      for (const t of monthTxs) {
        if (t.type === "income") monthIncome += Number(t.amount);
        else if (t.type === "expense") monthExpense += Math.abs(Number(t.amount));
        // creditPurchase и creditPayment намеренно пропускаем
      }

      const progress = await pg.getUserProgress(userId);

      return res.json({
        totalBalance: Math.round(totalBalance),
        monthIncome: Math.round(monthIncome),
        monthExpense: Math.round(monthExpense),
        streak: progress.streak,
        level: progress.level,
        totalXp: progress.totalXp,
      });
    } catch (err: any) {
      console.error("[widget/summary] Error:", err.message);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── WIDGET AUTH (OAuth-like flow для Scriptable iOS) ──────────────────────

  app.post("/api/widget/auth/issue", guard, async (req: AuthRequest, res) => {
    if (!pg) return res.status(503).json({ error: "DB required" });
    const userId = getUserId(req);
    const { randomBytes } = await import("crypto");
    const code = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await pg.createWidgetCode(userId, code, expiresAt);
    res.json({ code });
  });

  app.post("/api/widget/auth/exchange", async (req, res) => {
    if (!pg) return res.status(503).json({ error: "DB required" });
    try {
      const { code } = z.object({ code: z.string() }).parse(req.body);
      const userId = await pg.consumeWidgetCode(code);
      if (!userId) {
        return res.status(401).json({ error: "Код недействителен или истёк" });
      }
      const token = signJwt(userId, 60 * 60 * 24 * 30);
      res.json({ token });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

}
