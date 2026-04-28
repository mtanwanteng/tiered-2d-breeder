// Bibliophile player settings — Phase 7.
//
// Source of truth: localStorage (anon + authed alike). For authed users we
// also fire-and-forget a PUT to /api/settings so the server-side row stays
// in sync; on first sign-in the auth claim flow can hydrate from the server.
//
// On every change the relevant data-* attribute is applied to <html> so CSS
// rules can react ([data-contrast="high"], [data-reduced-motion="true"], etc.)
// and the motion primitives' isReducedMotion() helper picks it up.

export interface SettingsState {
  prefersReducedMotion: boolean;
  prefersTapToCommit: boolean;
  prefersHighContrast: boolean;
  roomToneEnabled: boolean;
}

const STORAGE_PREFIX = "bibliophile-";
const KEYS: Record<keyof SettingsState, string> = {
  prefersReducedMotion: STORAGE_PREFIX + "prefers-reduced-motion",
  prefersTapToCommit: STORAGE_PREFIX + "prefers-tap-to-commit",
  prefersHighContrast: STORAGE_PREFIX + "prefers-high-contrast",
  roomToneEnabled: STORAGE_PREFIX + "room-tone-enabled",
};

function defaults(): SettingsState {
  return {
    prefersReducedMotion: false,
    prefersTapToCommit: false,
    prefersHighContrast: false,
    roomToneEnabled: true, // default ON; spec §7 makes the room tone optional
  };
}

function readFromStorage(): SettingsState {
  if (typeof window === "undefined") return defaults();
  try {
    const d = defaults();
    return {
      prefersReducedMotion: localStorage.getItem(KEYS.prefersReducedMotion) === "true",
      prefersTapToCommit: localStorage.getItem(KEYS.prefersTapToCommit) === "true",
      prefersHighContrast: localStorage.getItem(KEYS.prefersHighContrast) === "true",
      // The room-tone default is true, so we treat absence as "true" and only
      // explicit "false" disables it.
      roomToneEnabled: localStorage.getItem(KEYS.roomToneEnabled) !== "false"
        ? d.roomToneEnabled
        : false,
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

/** Initialize settings from localStorage on game mount. Idempotent. */
export function initSettings(): void {
  state = readFromStorage();
  applyToDom();
}
