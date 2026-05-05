// Active theme registry. Curator is the current default; Bibliophile and
// Cartographer are parallel themes selectable from the Appearance picker.
// The indirection exists so future themes are a manifest swap, not a code
// rewrite. See docs/design/bibliophile-spec.md §1 "Theme architecture" and
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

/** App-wide default theme. Single source of truth for "what theme does a
 *  brand-new player land on." Imported by:
 *  - this module (initial activeTheme)
 *  - src/settings.ts (defaults().themePreference)
 *  - app/layout.tsx (SSR cookie fallback)
 *  - app/api/settings/route.ts (pre-migration GET fallback)
 *  - app/auth.ts (user.create.before hook → new user's themePreference)
 *
 *  The DB column's stored .default("bibliophile") in src/db/schema.ts is
 *  the historical value frozen for migration stability — it is not the
 *  app default. New rows get DEFAULT_THEME_NAME via the auth hook. */
export const DEFAULT_THEME: Theme = curator;
export const DEFAULT_THEME_NAME = DEFAULT_THEME.name;

let activeTheme: Theme = DEFAULT_THEME;

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
