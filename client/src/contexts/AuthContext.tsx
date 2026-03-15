/**
 * AuthContext — tracks the currently logged-in user.
 * Works in three modes:
 *   1. VITE_DEMO_MODE=true  — purely static, no backend at all.
 *      The fetch interceptor (demoStore.ts) already handles /api/*, so
 *      /api/auth/me returns the demo user instantly.
 *   2. MemStorage (dev)     — backend is running but has no real DB.
 *      Returns 503 on /api/auth/me → isDemo=true, skip auth screen.
 *   3. PG mode (production) — real JWT auth.
 */
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

const DEMO_USER = { id: 1, email: "demo@finwise.app", name: "Demo User" };

interface AuthUser {
  id: number;
  email: string;
  name: string;
  notifInApp?: boolean;
  notifEmail?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isDemo: boolean; // true = no auth screen required
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // In VITE_DEMO_MODE the interceptor is already installed before mount,
  // so we can start with user=DEMO_USER and loading=false immediately.
  const [user, setUser] = useState<AuthUser | null>(DEMO_MODE ? DEMO_USER : null);
  const [loading, setLoading] = useState(!DEMO_MODE);
  const [isDemo, setIsDemo] = useState(DEMO_MODE);

  useEffect(() => {
    if (DEMO_MODE) return; // interceptor handles everything

    // Try to load current session
    fetch("/api/auth/me", { credentials: "include" })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        } else if (res.status === 503) {
          // Backend is in demo / mem-storage mode — no auth needed
          setIsDemo(true);
        }
        // 401 = no session, that's fine — show auth screen
      })
      .catch(() => {
        // Network error (e.g. S3 static deploy without VITE_DEMO_MODE)
        setIsDemo(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { email, password });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Ошибка входа");
    setUser(data);
    await queryClient.invalidateQueries(); // ← данные обновятся без перезагрузки
  };

  const register = async (email: string, name: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/register", { email, name, password });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Ошибка регистрации");
    setUser(data);
    await queryClient.invalidateQueries(); // ← то же самое
  };

  const logout = async () => {
    if (!DEMO_MODE) {
      await apiRequest("POST", "/api/auth/logout", {});
    }
    queryClient.clear(); // ← теперь работает, импорт есть
    setUser(null);
    setIsDemo(false);
  };



  return (
    <AuthContext.Provider value={{ user, loading, isDemo, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
