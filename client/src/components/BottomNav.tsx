import { useRef, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export interface BottomNavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  testId: string;
}

interface BottomNavProps {
  items: BottomNavItem[];
  activeHref: string;
  badge?: (href: string) => number;
}

/**
 * BottomNav — animated sliding-pill bottom navigation bar.
 *
 * One absolutely-positioned pill slides between buttons via JS-measured
 * offsetLeft/offsetWidth. Active button expands its label column (0fr→1fr)
 * exactly like SettingsDock. No Framer Motion required — pure CSS + rAF.
 */
export function BottomNav({ items, activeHref, badge }: BottomNavProps) {
  const navRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  const movePill = useCallback(() => {
    const nav = navRef.current;
    const pill = pillRef.current;
    if (!nav || !pill) return;
    const activeBtn = nav.querySelector<HTMLElement>(
      `[data-href="${activeHref}"]`
    );
    if (!activeBtn) return;
    pill.style.width = `${activeBtn.offsetWidth}px`;
    pill.style.transform = `translate(${activeBtn.offsetLeft}px, -50%)`;
  }, [activeHref]);

  // Initial position — after first paint
  useEffect(() => {
    const id = requestAnimationFrame(movePill);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move on active route change
  useEffect(() => {
    movePill();
  }, [movePill]);

  // Re-sync on resize
  useEffect(() => {
    window.addEventListener("resize", movePill);
    return () => window.removeEventListener("resize", movePill);
  }, [movePill]);

  // Re-sync after label grid expansion finishes (mirrors SettingsDock pass-2)
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const handleTransitionEnd = (e: TransitionEvent) => {
      if (e.propertyName !== "grid-template-columns") return;
      const target = e.target as HTMLElement;
      if (target.dataset.href === activeHref) movePill();
    };
    nav.addEventListener("transitionend", handleTransitionEnd);
    return () => nav.removeEventListener("transitionend", handleTransitionEnd);
  }, [activeHref, movePill]);

  return (
    <div className="bottom-nav-outer">
      <div ref={navRef} className="bottom-nav" role="navigation" aria-label="Основная навигация">
        {/* Single moving pill */}
        <span ref={pillRef} className="bottom-nav__pill" aria-hidden="true" />

        {items.map((item) => {
          const isActive = item.href === activeHref;
          const badgeCount = badge?.(item.href) ?? 0;
          return (
            <Link key={item.href} href={item.href}>
              <a
                data-href={item.href}
                data-testid={item.testId}
                aria-current={isActive ? "page" : undefined}
                className={cn("bottom-nav__item", isActive && "is-active")}
              >
                <span className="bottom-nav__icon" aria-hidden="true">
                  {item.icon}
                  {badgeCount > 0 && (
                    <span className="bottom-nav__badge">
                      {badgeCount > 9 ? "9+" : badgeCount}
                    </span>
                  )}
                </span>
                <span className="bottom-nav__label">{item.label}</span>
              </a>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
