// Failed-combine shake — gentle horizontal jitter + dim pulse on the
// source pair when a drop is rejected. Spec §6.
//
// 240ms total: 3 oscillations at ±3px, opacity 1 → 0.8 → 1.
//
// Reduced motion: opacity flash only (no translation), still ~240ms so the
// player perceives the rejection without vestibular movement.

import { isReducedMotion } from "./util";

export interface ShakeOptions {
  /** Total animation duration in ms. Default 240ms. */
  durationMs?: number;
  /** Peak horizontal offset in px. Default 3. */
  amplitudePx?: number;
}

export function playFailedCombineShake(
  el: HTMLElement,
  opts: ShakeOptions = {},
): Promise<void> {
  const { durationMs = 240, amplitudePx = 3 } = opts;

  if (isReducedMotion()) {
    return new Promise<void>((resolve) => {
      const anim = el.animate(
        [{ opacity: 1 }, { opacity: 0.8 }, { opacity: 1 }],
        { duration: durationMs, easing: "ease-in-out", fill: "none" },
      );
      anim.onfinish = () => resolve();
    });
  }

  return new Promise<void>((resolve) => {
    const a = amplitudePx;
    const anim = el.animate(
      [
        { transform: "translateX(0)", opacity: 1 },
        { transform: `translateX(-${a}px)`, opacity: 0.9 },
        { transform: `translateX(${a}px)`, opacity: 0.8 },
        { transform: `translateX(-${a}px)`, opacity: 0.85 },
        { transform: `translateX(${a}px)`, opacity: 0.9 },
        { transform: "translateX(0)", opacity: 1 },
      ],
      { duration: durationMs, easing: "ease-in-out", fill: "none" },
    );
    anim.onfinish = () => resolve();
  });
}
