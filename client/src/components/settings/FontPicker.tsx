/**
 * FontPicker
 * ==========
 * Grid of font cards, one per APP_FONTS entry.
 * Active card is highlighted with a primary-colored ring.
 * Each card loads its font lazily via FontPreferencesContext.setFontId.
 *
 * Preview rendering:
 *   - Large number sample ("12 345 ₽") in the font itself.
 *   - Font name + label below.
 *   - Small "Aa" badge on hover / active state.
 *
 * Accessibility:
 *   - Each card is a <button> with role="radio" + aria-checked.
 *   - Arrow-key navigation within the group via onKeyDown.
 */
import { useRef, type KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFontPreferences } from "@/contexts/FontPreferencesContext";
import { APP_FONTS } from "@/lib/fonts";

export function FontPicker() {
  const { fontId, setFontId } = useFontPreferences();
  const groupRef = useRef<HTMLDivElement>(null);

  const handleKey = (e: KeyboardEvent, idx: number) => {
    const items = groupRef.current?.querySelectorAll<HTMLButtonElement>("[role='radio']");
    if (!items) return;
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % items.length;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + items.length) % items.length;
    if (next >= 0) { e.preventDefault(); items[next].focus(); }
  };

  return (
    <div className="space-y-3">
      {/* Info banner */}
      <div className="rounded-lg border border-border bg-muted/30 p-3.5 flex gap-2.5 text-sm text-muted-foreground">
        <span className="mt-0.5 flex-shrink-0 text-primary">✦</span>
        <span>
          Шрифт применяется ко всему приложению. Числа выровнены по сетке во всех вариантах.
        </span>
      </div>

      {/* Font grid */}
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label="Выбор шрифта"
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
      >
        {APP_FONTS.map((font, idx) => {
          const isActive = font.id === fontId;
          return (
            <button
              key={font.id}
              role="radio"
              aria-checked={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setFontId(font.id)}
              onKeyDown={(e) => handleKey(e, idx)}
              style={{ fontFamily: font.cssFamily }}
              className={cn(
                "relative flex flex-col items-start gap-1.5 rounded-xl border px-3.5 py-3 text-left",
                "transition-all duration-200 focus-visible:outline-none",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "active:scale-[0.98]",
                isActive
                  ? "border-primary/60 bg-primary/5 ring-2 ring-primary/30"
                  : "border-border bg-card hover:bg-muted/40 hover:border-border/80",
              )}
            >
              {/* Active checkmark */}
              {isActive && (
                <span className="absolute top-2.5 right-2.5 w-4.5 h-4.5 rounded-full bg-primary flex items-center justify-center">
                  <Check size={10} className="text-white" strokeWidth={3} />
                </span>
              )}

              {/* Number preview — rendered in the target font */}
              <span
                className="text-xl font-semibold tabular-nums tracking-tight leading-none"
                aria-hidden="true"
              >
                {font.previewText}
              </span>

              {/* Font metadata — always in system font so it's legible */}
              <span style={{ fontFamily: "var(--font-body, sans-serif)" }} className="mt-0.5">
                <span className="block text-[13px] font-medium leading-tight">
                  {font.name}
                </span>
                <span className="block text-[11px] text-muted-foreground leading-tight mt-0.5">
                  {font.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
