import { useState } from "react";
import { Link } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { useQuery } from "@tanstack/react-query";
import type { UserProgress } from "@shared/schema";
import {
  LayoutDashboard, ArrowLeftRight, PieChart,
  Target, BookOpen, Sun, Moon, Zap, Star,
  Wallet, Bell, LogOut, Menu, X, Settings2
} from "lucide-react";
import { cn } from "@/lib/utils";

import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  testId: string;
}

const navItems: NavItem[] = [
  { href: "/",             label: "Дашборд",     icon: <LayoutDashboard size={18} />, testId: "nav-dashboard" },
  { href: "/transactions", label: "Операции",    icon: <ArrowLeftRight size={18} />,  testId: "nav-transactions" },
  { href: "/accounts",    label: "Счета",        icon: <Wallet size={18} />,          testId: "nav-accounts" },
  { href: "/budget",      label: "Бюджет",       icon: <PieChart size={18} />,        testId: "nav-budget" },
  { href: "/goals",       label: "Цели",         icon: <Target size={18} />,          testId: "nav-goals" },
  { href: "/learn",       label: "Обучение",     icon: <BookOpen size={18} />,        testId: "nav-learn" },
  { href: "/notifications",label: "Уведомления", icon: <Bell size={18} />,            testId: "nav-notifications" },
  { href: "/settings",   label: "Настройки",    icon: <Settings2 size={18} />,       testId: "nav-settings" },
];

const mobileNavItems = navItems.slice(0, 5);

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useHashLocation();
  const { user, logout, isDemo } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  const isActive = (href: string) =>
    location === href || (href === "/" && (location === "" || location === "/"));

  const SidebarContent = () => (
    <>
      <div className="px-5 pt-6 pb-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-label="FinWise logo">
            <rect width="32" height="32" rx="8" fill="hsl(158 64% 32%)" />
            <path d="M8 22V12M12 22V16M16 22V8M20 22V14M24 22V18" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span className="font-bold text-xl text-sidebar-foreground tracking-tight">FinWise</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <a
              data-testid={item.testId}
              onClick={() => setDrawerOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full",
                isActive(item.href)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              {item.icon}
              {item.label}
              {item.href === "/notifications" && unreadCount > 0 && (
                <Badge variant="destructive" className="ml-auto text-[10px] px-1.5 py-0 h-4">
                  {unreadCount}
                </Badge>
              )}
            </a>
          </Link>
        ))}
      </nav>

      {progress && (
        <div className="px-4 py-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2 mb-1.5">
            <Star size={13} className="text-yellow-500" />
            <span className="text-xs font-medium text-sidebar-foreground">Уровень {progress.level}</span>
            <span className="text-xs text-sidebar-foreground/50 ml-auto">{xpInLevel} / 200 XP</span>
          </div>
          <div className="w-full bg-sidebar-border rounded-full h-1.5">
            <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${xpPct}%` }} />
          </div>
          {progress.streak > 0 && (
            <div className="flex items-center gap-1 mt-1.5">
              <Zap size={12} className="text-orange-500" />
              <span className="text-[11px] text-sidebar-foreground/60">{progress.streak} дней подряд</span>
            </div>
          )}
        </div>
      )}

      {user && (
        <div className="px-4 py-3 border-t border-sidebar-border flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{user.email}</p>
          </div>
          <button
            onClick={logout}
            data-testid="btn-logout"
            title="Выйти"
            className="p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground transition-colors flex-shrink-0"
          >
            <LogOut size={16} />
          </button>
        </div>
      )}

      <div className="px-4 py-3 border-t border-sidebar-border flex items-center justify-between">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
        >
          <Sun size={14} className="dark:hidden" />
          <Moon size={14} className="hidden dark:block" />
          <span className="dark:hidden">Светлая тема</span>
          <span className="hidden dark:block">Тёмная тема</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex w-60 flex-shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <SidebarContent />
      </aside>

      {/* MOBILE DRAWER */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <aside
            className="relative z-10 w-72 max-w-[85vw] flex flex-col bg-sidebar text-sidebar-foreground shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground transition-colors z-10"
            >
              <X size={18} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* MAIN */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile header — pt учитывает статус-бар iPhone (safe-area-inset-top) */}
        <header
          className="md:hidden flex items-center gap-3 px-4 pb-3 bg-background border-b border-border flex-shrink-0"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
        >
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-1.5 rounded-lg hover:bg-accent transition-colors"
            aria-label="Открыть меню"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="hsl(158 64% 32%)" />
              <path d="M8 22V12M12 22V16M16 22V8M20 22V14M24 22V18" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span className="font-bold text-base">FinWise</span>
          </div>
          {unreadCount > 0 && (
            <Link href="/notifications">
              <a className="ml-auto relative p-1.5">
                <Bell size={20} />
                <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              </a>
            </Link>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-background pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
          <div className="p-4 md:p-6 max-w-5xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex justify-around py-1 px-1">
          {mobileNavItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <a
                data-testid={item.testId}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl transition-colors min-w-[52px]",
                  isActive(item.href) ? "text-primary" : "text-muted-foreground"
                )}
              >
                <span className="relative">
                  {item.icon}
                  {item.href === "/notifications" && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-destructive text-destructive-foreground text-[8px] rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </span>
                <span className="text-[10px] leading-tight font-medium">{item.label}</span>
              </a>
            </Link>
          ))}
        </div>
      </nav>

    </div>
  );
}
