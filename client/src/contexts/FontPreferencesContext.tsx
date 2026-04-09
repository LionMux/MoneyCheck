/**
 * FontPreferencesContext
 * ======================
 * Provides:
 *   - fontId       — currently selected font ID (string, from APP_FONTS)
 *   - setFontId    — change font, lazy-load its stylesheet, write --font-body
 *
 * On mount it:
 *   1. Reads persisted font from localStorage (key: "finwise_font").
 *   2. Injects the matching <link> tag into <head> if not already present.
 *   3. Writes --font-body to document.documentElement.
 *
 * Lazy-loading approach:
 *   - Each font has at most ONE <link> tag in <head> (keyed by font ID).
 *   - We never remove old <link> tags — cached fonts cost nothing to keep.
 *   - We only update CSS variable; the browser handles cache.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { APP_FONTS, DEFAULT_FONT_ID, type AppFont } from "@/lib/fonts";

const STORAGE_KEY = "finwise_font";
const FONT_MAP = new Map<string, AppFont>(APP_FONTS.map((f) => [f.id, f]));

function loadFontLink(font: AppFont) {
  const url = font.googleFontsUrl ?? font.fontshareUrl;
  if (!url) return;

  const linkId = `font-link-${font.id}`;
  if (document.getElementById(linkId)) return; // already loaded

  // preconnect (best-effort, only first time per origin)
  const origin = new URL(url).origin;
  if (!document.querySelector(`link[rel="preconnect"][href="${origin}"]`)) {
    const pc = document.createElement("link");
    pc.rel = "preconnect";
    pc.href = origin;
    pc.crossOrigin = "anonymous";
    document.head.appendChild(pc);
  }

  const link = document.createElement("link");
  link.id = linkId;
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}

function applyFont(font: AppFont) {
  document.documentElement.style.setProperty("--font-body", font.cssFamily);
}

function resolveFont(id: string): AppFont {
  return FONT_MAP.get(id) ?? FONT_MAP.get(DEFAULT_FONT_ID)!;
}

interface FontPreferences {
  fontId: string;
  font: AppFont;
  setFontId: (id: string) => void;
}

const FontPreferencesContext = createContext<FontPreferences>({
  fontId: DEFAULT_FONT_ID,
  font: resolveFont(DEFAULT_FONT_ID),
  setFontId: () => {},
});

export function FontPreferencesProvider({ children }: { children: ReactNode }) {
  const [fontId, setFontIdState] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_FONT_ID;
    } catch {
      return DEFAULT_FONT_ID;
    }
  });

  // On mount and on every fontId change — load stylesheet + apply CSS var
  useEffect(() => {
    const font = resolveFont(fontId);
    loadFontLink(font);
    applyFont(font);
  }, [fontId]);

  const setFontId = (id: string) => {
    setFontIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* sandboxed */
    }
  };

  return (
    <FontPreferencesContext.Provider
      value={{ fontId, font: resolveFont(fontId), setFontId }}
    >
      {children}
    </FontPreferencesContext.Provider>
  );
}

export function useFontPreferences() {
  return useContext(FontPreferencesContext);
}
