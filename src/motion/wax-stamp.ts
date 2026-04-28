// Wax stamp — scale 1.4 → 1.0 with overshoot, 320ms. See spec §6.
//
// Used by:
//   - Run end (gilt "A" wax seal pressed onto the strip)
//   - Retirement commit (small wax-click variant)
//
// Reduced motion: opacity-only fade-in.

import { isReducedMotion } from "./util";

export interface WaxStampOptions {
  /** Total duration. Default 320ms. */
  durationMs?: number;
  /** Initial scale. Default 1.4. */
  startScale?: number;
}

export function playWaxStamp(target: HTMLElement, opts: WaxStampOptions = {}): Promise<void> {
  const { durationMs = 320, startScale = 1.4 } = opts;

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
        { transform: "scale(0.94)", opacity: 1, offset: 0.7 },
        { transform: "scale(1.0)", opacity: 1, offset: 1 },
      ],
      { duration: durationMs, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", fill: "forwards" },
    );
    a.onfinish = () => resolve();
  });
}
