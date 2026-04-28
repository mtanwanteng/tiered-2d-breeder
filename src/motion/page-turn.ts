// Page-turn — 2D peel transition between surfaces. See spec §6.
//
// 700ms ease-in-out, peel from the right edge with a thin shadow under the lift.
//
// Reduced motion: 200ms fade.

import { isReducedMotion } from "./util";

export function playPageTurn(target: HTMLElement, opts: { durationMs?: number } = {}): Promise<void> {
  const { durationMs = 700 } = opts;

  if (isReducedMotion()) {
    return new Promise<void>((resolve) => {
      const a = target.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
      a.onfinish = () => resolve();
    });
  }

  return new Promise<void>((resolve) => {
    // Peel: rotate around the left edge, slight perspective. Origin = left center.
    target.style.transformOrigin = "left center";
    target.style.willChange = "transform, filter, opacity";
    const a = target.animate(
      [
        { transform: "perspective(1200px) rotateY(0deg) translateX(0)", filter: "drop-shadow(0 0 0 transparent)", opacity: 1 },
        { transform: "perspective(1200px) rotateY(-25deg) translateX(-4%)", filter: "drop-shadow(-12px 4px 16px rgba(0,0,0,0.45))", opacity: 0.9, offset: 0.6 },
        { transform: "perspective(1200px) rotateY(-90deg) translateX(-15%)", filter: "drop-shadow(-20px 4px 20px rgba(0,0,0,0.5))", opacity: 0 },
      ],
      { duration: durationMs, easing: "ease-in-out", fill: "forwards" },
    );
    a.onfinish = () => resolve();
  });
}
