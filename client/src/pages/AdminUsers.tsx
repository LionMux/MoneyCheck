import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";

interface AdminUser {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

const AVATAR_COLORS = [
  "bg-violet-500/15 text-violet-600",
  "bg-emerald-500/15 text-emerald-600",
  "bg-sky-500/15 text-sky-600",
  "bg-amber-500/15 text-amber-600",
  "bg-rose-500/15 text-rose-600",
];

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 403) navigate("/");
          throw new Error("Нет доступа");
        }
        return res.json();
      })
      .then((data) => setUsers(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Пользователи</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Управление аккаунтами</p>
        </div>
        <span className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
          {users.length} {users.length === 1 ? "аккаунт" : users.length < 5 ? "аккаунта" : "аккаунтов"}
        </span>
      </div>

      {/* User list */}
      <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Нет пользователей</p>
        ) : (
          users.map((u, i) => (
            <div
              key={u.id}
              className="flex items-center gap-4 px-5 py-4 hover:bg-accent/40 transition-colors"
            >
              {/* Avatar */}
              <div
                className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}
              >
                {getInitials(u.name)}
              </div>

              {/* Name + email */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-tight">{u.name}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{u.email}</p>
              </div>

              {/* Dates */}
              <div className="text-right hidden sm:block">
                <p className="text-xs text-muted-foreground">
                  Регистрация{" "}
                  <span className="text-foreground font-medium">{formatDate(u.createdAt)}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Заходил{" "}
                  <span className="text-foreground font-medium">{formatDate(u.lastLoginAt)}</span>
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
