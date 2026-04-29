// Theme-driven Google Fonts URL.
//
// Layout.tsx renders this server-side so SSR first paint loads the right
// typefaces (no FOUC, no client-side string concatenation). Phase B Bibliophile
// is the only theme, but the dispatch is keyed on theme.name so Curator and
// Cartographer can each register their own font-axis spec without touching
// layout.tsx.

import type { Theme } from "./Theme";

/** Per-theme Google Fonts axis specs. The browser builds one stylesheet URL
 *  from the values; missing themes fall back to Bibliophile so SSR never 404s.
 *  Curator's GT Sectra and Söhne are licensed; using Cormorant Garamond +
 *  Inter as free near-equivalents (the manifest's font stack lists both). */
const GOOGLE_FONTS_BY_THEME: Record<string, string> = {
  bibliophile:
    "https://fonts.googleapis.com/css2?family=Cardo:ital,wght@0,400;0,700;1,400;1,700&family=Inter:wght@400;500;600&display=swap",
  curator:
    "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@400;500;600&display=swap",
  // Cartographer (EB Garamond + IBM Plex Mono) registers in Phase E.
};

/** Returns the Google Fonts <link href> for the given theme. */
export function getFontStylesheetUrl(theme: Theme): string {
  return GOOGLE_FONTS_BY_THEME[theme.name] ?? GOOGLE_FONTS_BY_THEME.bibliophile;
}

/** Inject a theme's font stylesheet into <head> at runtime. Idempotent —
 *  re-calling for the same theme is a no-op. Used by dev-flag setTheme()
 *  switches and (in Phase F) the Settings drawer when the player flips
 *  themes mid-session. SSR's first-paint stylesheet is set in app/layout.tsx
 *  and isn't affected. */
export function loadThemeFonts(themeName: string): void {
  if (typeof document === "undefined") return;
  const url = GOOGLE_FONTS_BY_THEME[themeName];
  if (!url) return;
  const id = `theme-fonts-${themeName}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);
}
