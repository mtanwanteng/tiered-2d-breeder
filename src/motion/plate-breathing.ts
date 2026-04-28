// Plate breathing — subtle post-commit "still alive" pulse on the bind plate.
// See spec §3.3, §6.
//
// scale 1.0 ↔ 1.02 over 3s sine. Halo opacity (if any) 0.06 ↔ 0.12.
// Reduced motion: no-op.

import { isReducedMotion } from "./util";

export interface PlateBreathingHandle {
  stop(): void;
}

export function startPlateBreathing(target: HTMLElement): PlateBreathingHandle {
  if (isReducedMotion()) {
    return { stop() { /* no-op */ } };
  }
  const a = target.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(1.02)" },
      { transform: "scale(1)" },
    ],
    { duration: 3000, iterations: Infinity, easing: "ease-in-out" },
  );
  return {
    stop() { a.cancel(); },
  };
}
