/**
 * In-browser demo store.
 * Replaces all API calls when VITE_DEMO_MODE=true.
 * Provides a QueryClient with pre-seeded data and full CRUD support.
 */
import { QueryClient } from "@tanstack/react-query";
import {
  DEMO_TRANSACTIONS, DEMO_BUDGETS, DEMO_GOALS,
  DEMO_PROGRESS, DEMO_LESSONS, DEMO_ACCOUNTS, DEMO_NOTIFICATIONS,
} from "./demoData";

// ── Mutable in-memory state ─────────────────────────────────────────────────
const state = {
  transactions:  [...DEMO_TRANSACTIONS] as any[],
  budgets:       [...DEMO_BUDGETS]       as any[],
  goals:         [...DEMO_GOALS]         as any[],
  progress:      { ...DEMO_PROGRESS }    as any,
  lessons:       [...DEMO_LESSONS]       as any[],
  accounts:      [...DEMO_ACCOUNTS]      as any[],
  notifications: [...DEMO_NOTIFICATIONS] as any[],
  nextId: { tx: 100, budget: 100, goal: 100, account: 100, notif: 100 },
};

// ── Route handler ───────────────────────────────────────────────────────────

type RouteHandler = (method: string, path: string, body?: any) => any;

const handler: RouteHandler = (method, path, body) => {

  // ── Auth ────────────────────────────────────────────────────────────────
  if (path === "/api/auth/me" && method === "GET") {
    return { id: 1, email: "demo@finwise.app", name: "Demo User" };
  }
  if (path.startsWith("/api/auth/") && method === "POST") {
    return { id: 1, email: body?.email ?? "demo@finwise.app", name: body?.name ?? "Demo User" };
  }

  // ── Transactions ─────────────────────────────────────────────────────────
  if (path === "/api/transactions" && method === "GET") {
    return [...state.transactions].sort((a, b) => b.date.localeCompare(a.date));
  }
  if (path === "/api/transactions" && method === "POST") {
    const item = { ...body, id: state.nextId.tx++, userId: 1, note: body.note ?? null, createdAt: new Date().toISOString().slice(0, 10), currency: body.currency ?? "RUB", accountId: body.accountId ?? null, categoryId: null, counterparty: null, linkedTransactionId: null, isPlanned: false };
    state.transactions.push(item);
    return item;
  }
  if (path.startsWith("/api/transactions/") && method === "DELETE") {
    const id = Number(path.split("/").pop());
    state.transactions = state.transactions.filter(t => t.id !== id);
    return {};
  }

  // ── Budgets ───────────────────────────────────────────────────────────────
  if (path === "/api/budgets" && method === "GET") return state.budgets;
  if (path === "/api/budgets" && method === "POST") {
    const item = { ...body, id: state.nextId.budget++, userId: 1, color: body.color ?? "#20808D", period: body.period ?? "month" };
    state.budgets.push(item);
    return item;
  }
  if (path.startsWith("/api/budgets/") && method === "PATCH") {
    const id = Number(path.split("/").pop());
    const idx = state.budgets.findIndex(b => b.id === id);
    if (idx >= 0) state.budgets[idx] = { ...state.budgets[idx], ...body };
    return state.budgets[idx];
  }
  if (path.startsWith("/api/budgets/") && method === "DELETE") {
    const id = Number(path.split("/").pop());
    state.budgets = state.budgets.filter(b => b.id !== id);
    return {};
  }

  // ── Savings Goals ─────────────────────────────────────────────────────────
  if (path === "/api/goals" && method === "GET") return state.goals;
  if (path === "/api/goals" && method === "POST") {
    const item = { ...body, id: state.nextId.goal++, userId: 1, currentAmount: body.currentAmount ?? 0, icon: body.icon ?? "Target", color: body.color ?? "#20808D", deadline: body.deadline ?? null };
    state.goals.push(item);
    return item;
  }
  if (path.match(/\/api\/goals\/\d+\/deposit/) && method === "POST") {
    const id = Number(path.split("/")[3]);
    const goal = state.goals.find(g => g.id === id);
    if (goal) goal.currentAmount = Math.min(goal.currentAmount + (body.amount ?? 0), goal.targetAmount);
    return goal;
  }
  if (path.startsWith("/api/goals/") && method === "DELETE") {
    const id = Number(path.split("/").pop());
    state.goals = state.goals.filter(g => g.id !== id);
    return {};
  }

  // ── Progress ──────────────────────────────────────────────────────────────
  if (path === "/api/progress" && method === "GET") return state.progress;

  // ── Lessons ───────────────────────────────────────────────────────────────
  if (path === "/api/lessons" && method === "GET") return state.lessons;
  if (path.match(/\/api\/lessons\/\d+\/complete/) && method === "POST") {
    const id = Number(path.split("/")[3]);
    const lesson = state.lessons.find(l => l.id === id);
    if (lesson && !lesson.completed) {
      lesson.completed = true;
      state.progress.totalXp += lesson.xpReward;
      state.progress.level = Math.floor(state.progress.totalXp / 200) + 1;
      state.progress.streak = Math.max(state.progress.streak, 1);
    }
    return lesson;
  }

  // ── Accounts ──────────────────────────────────────────────────────────────
  if (path === "/api/accounts" && method === "GET") return state.accounts.filter(a => !a.isArchived);
  if (path === "/api/accounts" && method === "POST") {
    const item = { ...body, id: state.nextId.account++, userId: 1, isArchived: false, creditLimit: body.creditLimit ?? null, billingDay: null, dueDay: null, interestRate: null, gracePeriodDays: null, createdAt: new Date().toISOString().slice(0, 10) };
    state.accounts.push(item);
    return item;
  }
  if (path.startsWith("/api/accounts/") && !path.includes("deposit") && method === "PATCH") {
    const id = Number(path.split("/").pop());
    const idx = state.accounts.findIndex(a => a.id === id);
    if (idx >= 0) state.accounts[idx] = { ...state.accounts[idx], ...body };
    return state.accounts[idx];
  }
  if (path.startsWith("/api/accounts/") && method === "DELETE") {
    const id = Number(path.split("/").pop());
    const acc = state.accounts.find(a => a.id === id);
    if (acc) acc.isArchived = true;
    return {};
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  if (path === "/api/notifications" && method === "GET") return state.notifications;
  if (path.match(/\/api\/notifications\/\d+\/read/) && method === "PATCH") {
    const id = Number(path.split("/")[3]);
    const n = state.notifications.find(n => n.id === id);
    if (n) n.isRead = true;
    return n;
  }

  // ── Quick-add widget ──────────────────────────────────────────────────────
  if (path === "/api/quick-add") return { message: "Demo mode" };

  // Default 404-like
  console.warn("[demoStore] unhandled:", method, path);
  return null;
};

// ── Demo fetch interceptor ──────────────────────────────────────────────────

export function installDemoInterceptor() {
  const originalFetch = window.fetch.bind(window);
  (window as any).fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

    // Only intercept our /api/ routes
    if (url.includes("/api/")) {
      // Extract just the path (strip host/port if present)
      const path = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
      let body: any;
      try { body = init?.body ? JSON.parse(init.body as string) : undefined; } catch { body = undefined; }

      const result = handler(method, path, body);
      return new Response(JSON.stringify(result ?? {}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return originalFetch(input, init);
  };
}

// ── Demo QueryClient (same config as real one, interceptor handles fetch) ──
export function createDemoQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        queryFn: async ({ queryKey }) => {
          const path = (queryKey as string[]).join("/");
          const res = await fetch(path);
          return res.json();
        },
        refetchInterval: false,
        refetchOnWindowFocus: false,
        staleTime: Infinity,
        retry: false,
      },
      mutations: { retry: false },
    },
  });
}
