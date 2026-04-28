// Scratch-in (typewriter) — narrative text reveal. See spec §6.
//
// ~30ms/char, blinking cursor at 1Hz, optional pen-scratch SFX every 6 chars.
// Reduced motion: instant text set.

import { isReducedMotion } from "./util";

export interface ScratchInOptions {
  msPerChar?: number;
  /** Fired every Nth character so the caller can hook a pen-scratch SFX. */
  onChar?: (charIndex: number) => void;
}

export interface ScratchInHandle {
  /** Skip remaining typing; resolve immediately. */
  skip(): void;
  promise: Promise<void>;
}

export function scratchIn(target: HTMLElement, text: string, opts: ScratchInOptions = {}): ScratchInHandle {
  const { msPerChar = 30, onChar } = opts;

  if (isReducedMotion()) {
    target.textContent = text;
    return { skip() { /* no-op */ }, promise: Promise.resolve() };
  }

  target.textContent = "";
  let i = 0;
  let cancelled = false;
  let interval: ReturnType<typeof setInterval> | null = null;

  let resolveDone!: () => void;
  const promise = new Promise<void>((r) => { resolveDone = r; });

  function step() {
    if (cancelled) return;
    if (i >= text.length) {
      if (interval) clearInterval(interval);
      resolveDone();
      return;
    }
    target.textContent += text[i];
    if (onChar) onChar(i);
    i += 1;
  }

  // First char fires immediately so the player sees instant feedback.
  step();
  interval = setInterval(step, msPerChar);

  function skip() {
    if (cancelled) return;
    cancelled = true;
    if (interval) clearInterval(interval);
    target.textContent = text;
    resolveDone();
  }

  return { skip, promise };
}
