// Bibliophile player settings — Phase 7 + Phase F (theme preference).
//
// Source of truth: localStorage (anon + authed alike). For authed users we
// also fire-and-forget a PUT to /api/settings so the server-side row stays
// in sync; on first sign-in the auth claim flow can hydrate from the server.
//
// On every change the relevant data-* attribute is applied to <html> so CSS
// rules can react ([data-contrast="high"], [data-reduced-motion="true"], etc.)
// and the motion primitives' isReducedMotion() helper picks it up. The
// theme preference also writes a `theme` cookie so SSR's first paint matches
// the chosen theme on the next page load.

import { setThemeByName } from "./theme";

export interface SettingsState {
  prefersReducedMotion: boolean;
  prefersTapToCommit: boolean;
  prefersHighContrast: boolean;
  roomToneEnabled: boolean;
  /** Active theme preference. One of the registered theme names; arbitrary
   *  strings are clamped to "bibliophile" on read so a renamed/removed theme
   *  doesn't lock the player into a broken state. */
  themePreference: "bibliophile" | "curator" | "cartographer";
}

const STORAGE_PREFIX = "bibliophile-";
const KEYS: Record<keyof SettingsState, string> = {
  prefersReducedMotion: STORAGE_PREFIX + "prefers-reduced-motion",
  prefersTapToCommit: STORAGE_PREFIX + "prefers-tap-to-commit",
  prefersHighContrast: STORAGE_PREFIX + "prefers-high-contrast",
  roomToneEnabled: STORAGE_PREFIX + "room-tone-enabled",
  themePreference: STORAGE_PREFIX + "theme-preference",
};

const VALID_THEME_NAMES = new Set(["bibliophile", "curator", "cartographer"]);

function defaults(): SettingsState {
  return {
    prefersReducedMotion: false,
    prefersTapToCommit: false,
    prefersHighContrast: false,
    roomToneEnabled: true, // default ON; spec §7 makes the room tone optional
    themePreference: "bibliophile",
  };
}

function readFromStorage(): SettingsState {
  if (typeof window === "undefined") return defaults();
  try {
    const d = defaults();
    const rawTheme = localStorage.getItem(KEYS.themePreference);
    const themePreference: SettingsState["themePreference"] =
      rawTheme && VALID_THEME_NAMES.has(rawTheme)
        ? (rawTheme as SettingsState["themePreference"])
        : d.themePreference;
    return {
      prefersReducedMotion: localStorage.getItem(KEYS.prefersReducedMotion) === "true",
      prefersTapToCommit: localStorage.getItem(KEYS.prefersTapToCommit) === "true",
      prefersHighContrast: localStorage.getItem(KEYS.prefersHighContrast) === "true",
      // The room-tone default is true, so we treat absence as "true" and only
      // explicit "false" disables it.
      roomToneEnabled: localStorage.getItem(KEYS.roomToneEnabled) !== "false"
        ? d.roomToneEnabled
        : false,
      themePreference,
    };
  } catch {
    return defaults();
  }
}

let state: SettingsState = defaults();
const listeners = new Set<(s: SettingsState) => void>();

export function getSettings(): SettingsState {
  return state;
}

export function subscribeSettings(fn: (s: SettingsState) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function setSetting<K extends keyof SettingsState>(
  key: K,
  value: SettingsState[K],
): void {
  if (state[key] === value) return;
  state = { ...state, [key]: value };
  try {
    localStorage.setItem(KEYS[key], String(value));
  } catch {
    /* private mode etc. — DOM still updates */
  }
  applyToDom();
  // Theme preference has side effects beyond a data-* attribute: actively
  // switch the active theme + write the SSR cookie.
  if (key === "themePreference") {
    setThemeByName(state.themePreference);
    writeThemeCookie(state.themePreference);
  }
  listeners.forEach((l) => l(state));
  void syncToApi();
}

function applyToDom(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.reducedMotion = state.prefersReducedMotion ? "true" : "false";
  root.dataset.tapToCommit = state.prefersTapToCommit ? "true" : "false";
  root.dataset.contrast = state.prefersHighContrast ? "high" : "default";
  root.dataset.roomTone = state.roomToneEnabled ? "true" : "false";
  // data-theme is owned by setTheme(); only mirror it if it drifted.
  if (root.dataset.theme !== state.themePreference) {
    root.dataset.theme = state.themePreference;
  }
}

function writeThemeCookie(themeName: string): void {
  if (typeof document === "undefined") return;
  // 1-year cookie so SSR first paint matches the player's choice across
  // sessions. SameSite=Lax keeps it out of cross-site requests; path=/
  // covers every page.
  const oneYearSeconds = 60 * 60 * 24 * 365;
  document.cookie = `theme=${encodeURIComponent(themeName)}; path=/; max-age=${oneYearSeconds}; SameSite=Lax`;
}

async function syncToApi(): Promise<void> {
  try {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(state),
    });
  } catch {
    /* network blip — localStorage is still authoritative */
  }
}

/** Initialize settings from localStorage on game mount. Idempotent.
 *  Activates the stored theme so the rest of mount sees the right palette. */
export function initSettings(): void {
  state = readFromStorage();
  applyToDom();
  // Apply the stored theme. Cookie write is *not* repeated here — we only
  // write when the player actively changes the setting, never as a side
  // effect of mount.
  setThemeByName(state.themePreference);
}
