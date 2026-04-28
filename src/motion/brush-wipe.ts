// Brush-wipe — frontispiece reveal. See spec §6.
//
// clip-path inset 100% → 0% over 1400ms ease-out
// + 4px horizontal drift (subtle "brush stroke" feel)
//
// Reduced motion: instant fade-in.

import { isReducedMotion } from "./util";

export function playBrushWipe(target: HTMLElement, opts: { durationMs?: number } = {}): Promise<void> {
  const { durationMs = 1400 } = opts;

  if (isReducedMotion()) {
    return new Promise<void>((resolve) => {
      target.style.clipPath = "inset(0)";
      const a = target.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out", fill: "forwards" });
      a.onfinish = () => resolve();
    });
  }

  return new Promise<void>((resolve) => {
    // Reveal left → right via inset(top right bottom left). Start fully clipped.
    const a = target.animate(
      [
        { clipPath: "inset(0 100% 0 0)", transform: "translateX(-4px)" },
        { clipPath: "inset(0 0 0 0)", transform: "translateX(0)" },
      ],
      { duration: durationMs, easing: "ease-out", fill: "forwards" },
    );
    a.onfinish = () => resolve();
  });
}
