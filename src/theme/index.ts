// Active theme registry. Today there is only one theme (Bibliophile);
// the indirection exists so future themes are a manifest swap, not a code rewrite.
// See docs/design/bibliophile-spec.md §1 "Theme architecture".

import type { Theme } from "./Theme";
import { bibliophile } from "./bibliophile/manifest";

export type { Theme, ThemeTokens, ThemeAudio, ThemeCopy } from "./Theme";

let activeTheme: Theme = bibliophile;

export function getTheme(): Theme {
  return activeTheme;
}

/** Switch the active theme. Updates the data-theme attribute on <html> so
 *  CSS variables under [data-theme="<name>"] take effect. */
export function setTheme(theme: Theme): void {
  activeTheme = theme;
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme.name;
  }
}

/** Look up a chapter's italic theme tag by era name. Returns empty string if
 *  the theme has no tag for that era — caller should treat that as "render
 *  the title bar without a subtitle." */
export function chapterTag(eraName: string): string {
  return activeTheme.chapterThemes[eraName] ?? "";
}
