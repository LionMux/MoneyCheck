/**
 * fonts.ts — Curated font catalogue for FinWise (2026)
 * ======================================================
 * Used by FontPreferencesContext (future PR) to:
 *   1. Lazy-load font <link> tags on demand.
 *   2. Set --font-body CSS variable on <html>.
 *   3. Persist user selection to localStorage.
 *
 * How to add a new font:
 *   1. Add an entry to APP_FONTS below.
 *   2. Provide either googleFontsUrl or fontshareUrl (or both).
 *   3. The FontPicker component reads this array automatically.
 *      No other changes required.
 *
 * Font selection criteria (2026):
 *   - Variable font support preferred (smooth weight transitions).
 *   - Tabular numerals (tnum) required — financial app must align digits.
 *   - Free for commercial use.
 *   - Tested at 12px–20px for mobile UI readability.
 */

export interface AppFont {
  /** Unique stable ID — stored in localStorage, do not rename */
  id: string;
  /** Display name shown in FontPicker */
  name: string;
  /** Short personality label shown below font name */
  label: string;
  /** Visual category for optional grouping in UI */
  category: "sans" | "rounded" | "mono";
  /** CSS font-family value written to --font-body */
  cssFamily: string;
  /** Google Fonts CDN stylesheet URL (preferred) */
  googleFontsUrl?: string;
  /** Fontshare CDN stylesheet URL (alternative) */
  fontshareUrl?: string;
  /** Short sample text rendered inside each FontCard */
  previewText: string;
}

export const APP_FONTS: AppFont[] = [
  {
    id: "inter",
    name: "Inter",
    label: "Чистый · Стандарт UI",
    category: "sans",
    cssFamily: "'Inter Variable', 'Inter', sans-serif",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
    previewText: "12 345 ₽",
  },
  {
    id: "geist",
    name: "Geist",
    label: "Техничный · Premium",
    category: "sans",
    cssFamily: "'Geist', sans-serif",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap",
    previewText: "12 345 ₽",
  },
  {
    id: "satoshi",
    name: "Satoshi",
    label: "Дружелюбный · Живой",
    category: "sans",
    cssFamily: "'Satoshi', sans-serif",
    fontshareUrl:
      "https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700&display=swap",
    previewText: "12 345 ₽",
  },
  {
    id: "dm-sans",
    name: "DM Sans",
    label: "Мягкий · Доступный",
    category: "rounded",
    cssFamily: "'DM Sans', sans-serif",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap",
    previewText: "12 345 ₽",
  },
  {
    id: "figtree",
    name: "Figtree",
    label: "Округлый · Mobile-first",
    category: "rounded",
    cssFamily: "'Figtree', sans-serif",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,300..900;1,300..900&display=swap",
    previewText: "12 345 ₽",
  },
  {
    id: "outfit",
    name: "Outfit",
    label: "Современный · Нейтральный",
    category: "sans",
    cssFamily: "'Outfit', sans-serif",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap",
    previewText: "12 345 ₽",
  },
  {
    id: "plus-jakarta",
    name: "Plus Jakarta Sans",
    label: "Энергичный · Финтех",
    category: "sans",
    cssFamily: "'Plus Jakarta Sans', sans-serif",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap",
    previewText: "12 345 ₽",
  },
];

/** Default font ID applied on first launch */
export const DEFAULT_FONT_ID = "inter";
