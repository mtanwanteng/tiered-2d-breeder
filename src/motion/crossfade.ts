// Crossfade — swap text on an element with a fade-out / swap / fade-in pulse.
// Spec §6 (added with the AI-thinking copy-evolves pattern). 280ms total:
// 120ms fade-out, swap textContent, 160ms fade-in.
//
// Reduced motion: instant text set.

import { isReducedMotion } from "./util";

export interface CrossfadeOptions {
  /** Fade-out duration. Default 120ms. */
  fadeOutMs?: number;
  /** Fade-in duration. Default 160ms. */
  fadeInMs?: number;
}

export function crossfade(
  target: HTMLElement,
  newText: string,
  opts: CrossfadeOptions = {},
): Promise<void> {
  const { fadeOutMs = 120, fadeInMs = 160 } = opts;

  if (isReducedMotion()) {
    target.textContent = newText;
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const out = target.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: fadeOutMs, easing: "ease-out", fill: "forwards" },
    );
    out.onfinish = () => {
      target.textContent = newText;
      const inAnim = target.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: fadeInMs, easing: "ease-out", fill: "forwards" },
      );
      inAnim.onfinish = () => resolve();
    };
  });
}
