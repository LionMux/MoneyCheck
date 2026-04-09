import { useRef, useEffect, useCallback } from "react";
import type { ReactNode } from "react";

export interface SettingsDockTab {
  id: string;
  label: string;
  icon: ReactNode;
}

interface SettingsDockProps {
  tabs: SettingsDockTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

/**
 * SettingsDock — animated pill/dock tab switcher (v2).
 *
 * CSS grid 0fr→1fr column transition expands the label column
 * without max-width caps. The pill is measured TWICE:
 *   1. Immediately on tab change (fast snap to new position).
 *   2. After the grid transition ends (pill grows to fit full label).
 *
 * This two-pass approach ensures the pill width always matches
 * the fully-revealed label, never the collapsed mid-animation state.
 */
export function SettingsDock({
  tabs,
  activeTab,
  onTabChange,
  className = "",
}: SettingsDockProps) {
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  const movePill = useCallback((targetEl: HTMLButtonElement) => {
    const pill = pillRef.current;
    if (!pill) return;
    pill.style.width = `${targetEl.offsetWidth}px`;
    pill.style.transform = `translate(${targetEl.offsetLeft}px, -50%)`;
  }, []);

  const syncToActive = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    const active = nav.querySelector<HTMLButtonElement>(
      `[data-tab="${activeTab}"]`
    );
    if (active) movePill(active);
  }, [activeTab, movePill]);

  // Pass 1: move pill immediately when activeTab changes
  useEffect(() => {
    syncToActive();
  }, [syncToActive]);

  // Pass 2: re-sync after the grid column transition finishes
  // so pill width matches the fully-expanded label
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const handleTransitionEnd = (e: TransitionEvent) => {
      // Only react to the grid-template-columns transition on the active button
      if (e.propertyName === "grid-template-columns") {
        syncToActive();
      }
    };

    nav.addEventListener("transitionend", handleTransitionEnd);
    return () => nav.removeEventListener("transitionend", handleTransitionEnd);
  }, [syncToActive]);

  // Re-sync on window resize
  useEffect(() => {
    window.addEventListener("resize", syncToActive);
    return () => window.removeEventListener("resize", syncToActive);
  }, [syncToActive]);

  // Initial position after first paint
  useEffect(() => {
    const id = requestAnimationFrame(syncToActive);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <nav
      ref={navRef}
      aria-label="Settings navigation"
      className={`settings-dock ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            data-tab={tab.id}
            aria-selected={isActive}
            role="tab"
            onClick={() => onTabChange(tab.id)}
            className={`settings-dock__item${isActive ? " is-active" : ""}`}
          >
            <span className="settings-dock__icon" aria-hidden="true">
              {tab.icon}
            </span>
            <span className="settings-dock__label">{tab.label}</span>
          </button>
        );
      })}
      <span className="settings-dock__pill" aria-hidden="true" ref={pillRef} />
    </nav>
  );
}
