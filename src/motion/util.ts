// Shared helpers for motion primitives. See docs/design/bibliophile-spec.md §6, §8.

/** True when the user has requested reduced motion (OS-level setting). */
export function isReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Resolve after `ms` milliseconds. Cancellable via `signal`. */
export function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });
}

/** Reads a token color from the active theme via getComputedStyle on <html>.
 *  Returns the resolved hex/rgb string, or the fallback if the token isn't set. */
export function tokenColor(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
