// Theme-driven Google Fonts URL.
//
// Layout.tsx renders this server-side so SSR first paint loads the right
// typefaces (no FOUC, no client-side string concatenation). Phase B Bibliophile
// is the only theme, but the dispatch is keyed on theme.name so Curator and
// Cartographer can each register their own font-axis spec without touching
// layout.tsx.

import type { Theme } from "./Theme";

/** Per-theme Google Fonts axis specs. The browser builds one stylesheet URL
 *  from the values; missing themes fall back to Bibliophile so SSR never 404s. */
const GOOGLE_FONTS_BY_THEME: Record<string, string> = {
  bibliophile:
    "https://fonts.googleapis.com/css2?family=Cardo:ital,wght@0,400;0,700;1,400;1,700&family=Inter:wght@400;500;600&display=swap",
  // Curator (GT Sectra + Söhne) and Cartographer (EB Garamond + IBM Plex Mono)
  // register here when their delta specs ship in Phase D / Phase E.
};

/** Returns the Google Fonts <link href> for the given theme. */
export function getFontStylesheetUrl(theme: Theme): string {
  return GOOGLE_FONTS_BY_THEME[theme.name] ?? GOOGLE_FONTS_BY_THEME.bibliophile;
}
