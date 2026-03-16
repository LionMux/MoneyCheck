/**
 * AuthContext — tracks the currently logged-in user.
 *
 * Three-layer isolation guarantee:
 *   1. `switching` flag — while switching accounts the app renders a full-screen
 *      spinner, so no page component can fire stale queries.
 *   2. `queryClient.clear()` is called BEFORE setUser() so the new render
 *      cycle always starts with an empty cache.
 *   3. App.tsx passes `key={user?.id ?? 'guest'}` to Layout, which forces
 *      React to fully unmount/remount every page component on user change —
 *      guaranteed zero stale component state.
 *
 * Modes:
 *   1. VITE_DEMO_MODE=true  — static deploy, fetch interceptor handles /api/*
 *   2. MemStorage (no DB)   — server returns 503 on /api/auth/me → isDemo=true
 *   3. PG mode (production) — real JWT / httpOnly cookie auth
 */
import {
  createContext, useContext, useState, useEffect,
  useCallback, ReactNode
} from "react";
import { apiRequest, queryClient, setUnauthorizedHandler } from "@/lib/queryClient";
import { useHashLocation } from "wouter/use-hash-location";

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";
const DEMO_USER = { id: 1, email: "demo@finwise.app", name: "Demo User" };

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  notifInApp?: boolean;
  notifEmail?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;   // true while the initial /api/auth/me request is in flight
  switching: boolean; // true while logout/login transition is in progress
  isDemo: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, navigate] = useHashLocation();
  const [user, setUser]       = useState<AuthUser | null>(DEMO_MODE ? DEMO_USER : null);
  const [loading, setLoading] = useState(!DEMO_MODE);
  const [isDemo, setIsDemo]   = useState(DEMO_MODE);
  /**
   * `switching` is true during the gap between "old session cleared" and
   * "new session ready to render". While true, App.tsx renders a full-screen
   * spinner instead of the page tree — no stale query can fire.
   */
  const [switching, setSwitching] = useState(false);

  // ── Initial session check ─────────────────────────────────────────────────
  useEffect(() => {
    if (DEMO_MODE) return;

    fetch("/api/auth/me", { credentials: "include" })
      .then(async (res) => {
        if (res.ok) {
          setUser(await res.json());
        } else if (res.status === 503) {
          setIsDemo(true);
        }
        // 401 = not logged in — show auth screen
      })
      .catch(() => setIsDemo(true))
      .finally(() => setLoading(false));
  }, []);

  // ── Core switch helper ────────────────────────────────────────────────────
  /**
   * Immediately:
   *   1. Sets switching=true → spinner renders, pages unmount
   *   2. Cancels all in-flight requests
   *   3. Clears the entire query cache
   *   4. Navigates to "/"
   * Returns an `endSwitch` function to call once the new user is set.
   */
  const beginSwitch = useCallback(() => {
    setSwitching(true);
    queryClient.cancelQueries();
    queryClient.clear();
    navigate("/");
    return function endSwitch() {
      setSwitching(false);
    };
  }, [navigate]);

  // ── login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { email, password });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Ошибка входа");

    const endSwitch = beginSwitch();
    setUser(data);
    // Give React one tick to flush the spinner before pages re-mount
    await new Promise(r => setTimeout(r, 50));
    endSwitch();
  }, [beginSwitch]);

  // ── register ──────────────────────────────────────────────────────────────
  const register = useCallback(async (email: string, name: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/register", { email, name, password });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Ошибка регистрации");

    const endSwitch = beginSwitch();
    setUser(data);
    await new Promise(r => setTimeout(r, 50));
    endSwitch();
  }, [beginSwitch]);

  // ── logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    // Step 1: block rendering + clear cache + navigate("/")
    const endSwitch = beginSwitch();

    // Step 2: invalidate server session
    if (!DEMO_MODE) {
      try {
        await apiRequest("POST", "/api/auth/logout", {});
      } catch {
        // ignore network errors on logout — local state still gets cleared
      }
    }

    // Step 3: clear identity
    setUser(null);
    setIsDemo(false);

    // Step 4: let the spinner frame paint
    await new Promise(r => setTimeout(r, 50));

    // Step 5: unblock — AuthPage renders with zero stale data
    endSwitch();
  }, [beginSwitch]);

  // ── 401 auto-logout (expired/invalid token while app is open) ─────────────
  useEffect(() => {
    const handler = () => {
      // Only react if we think we're logged in
      if (user || isDemo) logout();
    };
    setUnauthorizedHandler(handler);
    return () => setUnauthorizedHandler(() => {});
  }, [user, isDemo, logout]);

  return (
    <AuthContext.Provider
      value={{ user, loading, switching, isDemo, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
