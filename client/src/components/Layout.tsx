import { Link } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { useQuery } from "@tanstack/react-query";
import type { UserProgress } from "@shared/schema";
import {
  LayoutDashboard, ArrowLeftRight, PieChart,
  Target, BookOpen, Sun, Moon, Zap, Star,
  Wallet, Bell, LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import PerplexityAttribution from "@/components/PerplexityAttribution";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  testId: string;
}

const navItems: NavItem[] = [
  { href: "/", label: "Дашборд", icon: <LayoutDashboard size={18} />, testId: "nav-dashboard" },
  { href: "/transactions", label: "Операции", icon: <ArrowLeftRight size={18} />, testId: "nav-transactions" },
  { href: "/accounts", label: "Счета", icon: <Wallet size={18} />, testId: "nav-accounts" },
  { href: "/budget", label: "Бюджет", icon: <PieChart size={18} />, testId: "nav-budget" },
  { href: "/goals", label: "Цели", icon: <Target size={18} />, testId: "nav-goals" },
  { href: "/learn", label: "Обучение", icon: <BookOpen size={18} />, testId: "nav-learn" },
  { href: "/notifications", label: "Уведомления", icon: <Bell size={18} />, testId: "nav-notifications" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useHashLocation();
  const { user, logout, isDemo } = useAuth();

  const { data: progress } = useQuery<UserProgress>({
    queryKey: ["/api/progress"],
  });

  const { data: notifications = [] } = useQuery<{ isRead: boolean }[]>({
    queryKey: ["/api/notifications"],
    enabled: !isDemo && !!user,
  });
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
  };

  const xpInLevel = progress ? progress.totalXp % 200 : 0;
  const xpPct = Math.round((xpInLevel / 200) * 100);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col bg-sidebar text-sidebar-foreground">
        {/* Logo */}
        <div className="px-5 pt-6 pb-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-label="FinWise logo">
              <rect width="32" height="32" rx="8" fill="hsl(158 64% 32%)" />
              <path d="M8 22V16M12 22V12M16 22V8M20 22V14M24 22V18" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span className="text-lg font-bold text-white" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              FinWise
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href === "/" && (location === "" || location === "/"));
            return (
              <Link key={item.href} href={item.href}>
                <div
                  data-testid={item.testId}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer",
                    isActive
                      ? "bg-sidebar-primary text-white"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  {item.href === "/notifications" && unreadCount > 0 && (
                    <span className="text-xs bg-emerald-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                      {unreadCount}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* XP Progress */}
        {progress && (
          <div className="px-4 py-4 border-t border-sidebar-border">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Star size={14} className="text-yellow-400" />
                <span className="text-xs font-semibold text-white">Уровень {progress.level}</span>
              </div>
              <span className="text-xs text-sidebar-foreground">{xpInLevel} / 200 XP</span>
            </div>
            <div className="w-full bg-sidebar-accent rounded-full h-1.5">
              <div
                className="bg-sidebar-primary h-1.5 rounded-full transition-all duration-700"
                style={{ width: `${xpPct}%` }}
              />
            </div>
            {progress.streak > 0 && (
              <div className="flex items-center gap-1 mt-2">
                <Zap size={12} className="text-yellow-400" />
                <span className="text-xs text-sidebar-foreground">{progress.streak} дней подряд</span>
              </div>
            )}
          </div>
        )}

        {/* User info */}
        {user && (
          <div className="px-4 py-3 border-t border-sidebar-border">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">{user.name}</div>
                <div className="text-xs text-sidebar-foreground truncate">{user.email}</div>
              </div>
              <button
                onClick={() => logout()}
                data-testid="btn-logout"
                title="Выйти"
                className="p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground transition-colors"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Theme + attribution */}
        <div className="px-4 pb-4 space-y-2">
          <button
            onClick={toggleTheme}
            data-testid="btn-theme-toggle"
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <Sun size={15} className="hidden dark:block" />
            <Moon size={15} className="block dark:hidden" />
            <span className="block dark:hidden">Тёмная тема</span>
            <span className="hidden dark:block">Светлая тема</span>
          </button>
          <PerplexityAttribution />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="p-6 max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
