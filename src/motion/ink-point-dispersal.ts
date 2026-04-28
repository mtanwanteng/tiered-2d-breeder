// Ink-point dispersal — the retirement primitive. See spec §6.
//
// ~9 small ink-point circles spawn at the target's center, drift upward with
// random horizontal offsets, and fade over 1.4s. Reads as the retiring tile
// "dissolving back into the world" — a release, not a deletion.
//
// Reduced motion: opacity-only fade in place (no drift).

import { isReducedMotion } from "./util";

export interface InkPointDispersalOptions {
  /** Element whose center the points emanate from. */
  target: HTMLElement;
  /** How many points to spawn. Default 9. */
  count?: number;
  /** Total duration in ms. Default 1400. */
  durationMs?: number;
  /** Color of the points. Default var(--ink-black). */
  color?: string;
  /** Container to attach the points to. Default document.body. */
  parent?: HTMLElement;
}

export function playInkPointDispersal(opts: InkPointDispersalOptions): Promise<void> {
  const {
    target,
    count = 9,
    durationMs = 1400,
    color = "var(--ink-black, #2a1f15)",
    parent = document.body,
  } = opts;
  const reduced = isReducedMotion();

  const rect = target.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const points: HTMLElement[] = [];
  const animations: Promise<void>[] = [];

  for (let i = 0; i < count; i++) {
    const dot = document.createElement("div");
    const size = 4 + Math.random() * 4; // 4–8px
    Object.assign(dot.style, {
      position: "fixed",
      width: `${size}px`,
      height: `${size}px`,
      left: `${cx - size / 2}px`,
      top: `${cy - size / 2}px`,
      background: color,
      borderRadius: "50%",
      pointerEvents: "none",
      zIndex: "65",
      filter: "blur(0.4px)",
    });
    parent.appendChild(dot);
    points.push(dot);

    if (reduced) {
      animations.push(
        new Promise((resolve) => {
          const a = dot.animate(
            [{ opacity: 1 }, { opacity: 0 }],
            { duration: 300, easing: "ease-out", fill: "forwards" },
          );
          a.onfinish = () => resolve();
        }),
      );
    } else {
      // Each point drifts up with random horizontal offset and a slight wobble.
      const driftX = (Math.random() * 2 - 1) * 28; // ±28px
      const driftY = -(40 + Math.random() * 60); // 40–100px upward
      const delay = i * (durationMs * 0.04); // stagger ~5% of duration
      animations.push(
        new Promise((resolve) => {
          const a = dot.animate(
            [
              { transform: "translate(0, 0)", opacity: 0.85 },
              { transform: `translate(${driftX * 0.5}px, ${driftY * 0.4}px)`, opacity: 0.55, offset: 0.5 },
              { transform: `translate(${driftX}px, ${driftY}px)`, opacity: 0 },
            ],
            { duration: durationMs, delay, easing: "cubic-bezier(0.2, 0.6, 0.2, 1)", fill: "forwards" },
          );
          a.onfinish = () => resolve();
        }),
      );
    }
  }

  return Promise.all(animations).then(() => {
    for (const dot of points) {
      if (dot.parentElement) dot.parentElement.removeChild(dot);
    }
  });
}
