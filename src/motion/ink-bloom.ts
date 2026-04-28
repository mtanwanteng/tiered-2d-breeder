// Ink-bloom — primitive arrival animation for tiles, narrative text, ink halos.
// See spec §6.
//
// scale 0 → 1 over 600ms cubic-bezier(0.2, 0.8, 0.2, 1)
// opacity 0 → 1 over the first 350ms
//
// Reduced motion: 200ms opacity-only fade.

import { isReducedMotion } from "./util";

export interface InkBloomOptions {
  durationMs?: number;
  startScale?: number;
}

export function playInkBloom(target: HTMLElement, opts: InkBloomOptions = {}): Promise<void> {
  const { durationMs = 600, startScale = 0 } = opts;

  if (isReducedMotion()) {
    return new Promise<void>((resolve) => {
      const a = target.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: 200, easing: "ease-out", fill: "forwards" },
      );
      a.onfinish = () => resolve();
    });
  }

  return new Promise<void>((resolve) => {
    const a = target.animate(
      [
        { transform: `scale(${startScale})`, opacity: 0, offset: 0 },
        { opacity: 1, offset: 350 / durationMs },
        { transform: "scale(1)", opacity: 1, offset: 1 },
      ],
      { duration: durationMs, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "forwards" },
    );
    a.onfinish = () => resolve();
  });
}
