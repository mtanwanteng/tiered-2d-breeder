// Page-turn — transition between surfaces. See bibliophile-spec.md §6 and
// theming-architecture.md §3.4 for the per-theme variants.
//
// Three variants per `motion.pageTransitionType`:
//
//   peel-2d (Bibliophile, 700ms)
//     Rotate around the left edge with perspective + thin shadow under the
//     lift. The "page peeling away" feel.
//
//   pan-horizontal (Curator, 700ms)
//     Slide horizontally to the next gallery — the camera moves left, the
//     surface scrolls right out of frame. No rotation, no shadow.
//
//   fold-3d (Cartographer, 800ms)
//     3D fold left-over-right with a thin shadow under the leading edge.
//     Old paper has more give — the 100ms duration bump reflects paper
//     weight per cartographer-spec.md §2.4. Falls back to peel-2d behavior
//     on very-old browsers that don't honor `transform-style: preserve-3d`.
//
// Reduced motion: 200ms fade for all variants.

import { isReducedMotion } from "./util";

export interface PageTurnOptions {
  durationMs?: number;
  type?: "peel-2d" | "pan-horizontal" | "fold-3d";
}

export function playPageTurn(target: HTMLElement, opts: PageTurnOptions = {}): Promise<void> {
  const type = opts.type ?? "peel-2d";
  const defaultDuration = type === "fold-3d" ? 800 : 700;
  const durationMs = opts.durationMs ?? defaultDuration;

  if (isReducedMotion()) {
    return new Promise<void>((resolve) => {
      const a = target.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
      a.onfinish = () => resolve();
    });
  }

  if (type === "pan-horizontal") {
    return new Promise<void>((resolve) => {
      target.style.willChange = "transform, opacity";
      const a = target.animate(
        [
          { transform: "translateX(0)", opacity: 1 },
          { transform: "translateX(-100%)", opacity: 0 },
        ],
        { duration: durationMs, easing: "ease-in-out", fill: "forwards" },
      );
      a.onfinish = () => resolve();
    });
  }

  if (type === "fold-3d") {
    return new Promise<void>((resolve) => {
      target.style.transformOrigin = "left center";
      target.style.willChange = "transform, filter, opacity";
      // Steeper rotation than peel-2d (full 180° fold) and longer drop
      // shadow trailing the leading edge to read as a thicker leaf folding.
      const a = target.animate(
        [
          { transform: "perspective(1400px) rotateY(0deg)", filter: "drop-shadow(0 0 0 transparent)", opacity: 1 },
          { transform: "perspective(1400px) rotateY(-90deg)", filter: "drop-shadow(-16px 8px 18px rgba(0,0,0,0.5))", opacity: 0.85, offset: 0.5 },
          { transform: "perspective(1400px) rotateY(-180deg)", filter: "drop-shadow(-22px 6px 22px rgba(0,0,0,0.45))", opacity: 0 },
        ],
        { duration: durationMs, easing: "ease-in-out", fill: "forwards" },
      );
      a.onfinish = () => resolve();
    });
  }

  // peel-2d (Bibliophile default)
  return new Promise<void>((resolve) => {
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
