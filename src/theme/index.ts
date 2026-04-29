// Active theme registry. Bibliophile is the v1 default; Curator and
// Cartographer are parallel themes registered from Phase D onward. The
// indirection exists so future themes are a manifest swap, not a code rewrite.
// See docs/design/bibliophile-spec.md §1 "Theme architecture" and
// docs/design/theming-architecture.md.

import type { Theme } from "./Theme";
import { bibliophile } from "./bibliophile/manifest";
import { curator } from "./curator/manifest";
import { cartographer } from "./cartographer/manifest";
import { loadThemeFonts } from "./fontStylesheet";

export type {
  Theme,
  ThemeTokens,
  ThemeFonts,
  ThemeTextures,
  ThemeMotion,
  ThemeAudio,
  ThemeCopy,
} from "./Theme";

/** All registered themes, keyed by manifest.name. Phase F's settings
 *  switcher iterates this for the Appearance picker. */
export const THEMES: Record<string, Theme> = {
  bibliophile,
  curator,
  cartographer,
};

export { bibliophile, curator, cartographer };

let activeTheme: Theme = bibliophile;

export function getTheme(): Theme {
  return activeTheme;
}

/** Switch the active theme. Updates the data-theme attribute on <html> so
 *  CSS variables under [data-theme="<name>"] take effect, and lazy-injects
 *  the new theme's font stylesheet so type doesn't drop to system fallbacks. */
export function setTheme(theme: Theme): void {
  activeTheme = theme;
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme.name;
    loadThemeFonts(theme.name);
  }
}

/** Phase D dev-flag toggle. Switch by name from the DevTools console:
 *  `setThemeByName("curator")`. Falls back silently if the name is unknown
 *  so a typo doesn't crash. */
export function setThemeByName(name: string): boolean {
  const theme = THEMES[name];
  if (!theme) return false;
  setTheme(theme);
  return true;
}

/** Look up a chapter's italic theme tag by era name. Returns empty string if
 *  the theme has no tag for that era — caller should treat that as "render
 *  the title bar without a subtitle." */
export function chapterTag(eraName: string): string {
  return activeTheme.chapterThemes[eraName] ?? "";
}
