import { useRef, useEffect, useCallback } from "react";

export interface SettingsDockTab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface SettingsDockProps {
  tabs: SettingsDockTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

/**
 * SettingsDock — animated pill/dock tab switcher.
 *
 * A single absolutely-positioned .settings-dock__pill slides between buttons
 * using JS-measured offsetLeft + offsetWidth. The active label fades/expands
 * in with max-width + opacity + translateX trick (no reflow chaos).
 *
 * To add a new tab: just add an item to the SETTINGS_TABS array in Settings.tsx.
 * No changes to this component required.
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

  // Move pill whenever activeTab changes
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const active = nav.querySelector<HTMLButtonElement>(
      `[data-tab="${activeTab}"]`
    );
    if (active) movePill(active);
  }, [activeTab, movePill]);

  // Move pill on resize
  useEffect(() => {
    const handleResize = () => {
      const nav = navRef.current;
      if (!nav) return;
      const active = nav.querySelector<HTMLButtonElement>(
        `[data-tab="${activeTab}"]`
      );
      if (active) movePill(active);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activeTab, movePill]);

  // Set initial pill position after first paint
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const nav = navRef.current;
      if (!nav) return;
      const active = nav.querySelector<HTMLButtonElement>(
        `[data-tab="${activeTab}"]`
      );
      if (active) movePill(active);
    });
    return () => cancelAnimationFrame(id);
    // Only on mount
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
      {/* The sliding pill — sits behind buttons via z-index */}
      <span className="settings-dock__pill" aria-hidden="true" ref={pillRef} />
    </nav>
  );
}
