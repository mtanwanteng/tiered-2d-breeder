// Brush-wipe — frontispiece reveal. See bibliophile-spec.md §6 and the per-
// theme variants in theming-architecture.md §3.4.
//
// Three variants per `motion.frontispieceRevealType`. All run 1400ms.
//
//   brush-wipe (Bibliophile)
//     clip-path inset 100% → 0% with a 4px horizontal drift. The "brush
//     stroke" feel.
//
//   spotlight-wipe (Curator)
//     A soft elliptical alpha mask sweeps left-to-right. The piece is dim
//     before the spotlight passes; lit after. Implemented as a radial-
//     gradient mask animated horizontally.
//
//   ink-wash (Cartographer)
//     A radial gradient expands from a corner — the era's plate fills in
//     like sepia ink dropped onto wet paper, spreading outward.
//
// Reduced motion: instant fade-in for all variants.

import { isReducedMotion } from "./util";

export interface BrushWipeOptions {
  durationMs?: number;
  type?: "brush-wipe" | "spotlight-wipe" | "ink-wash";
}

export function playBrushWipe(target: HTMLElement, opts: BrushWipeOptions = {}): Promise<void> {
  const { durationMs = 1400, type = "brush-wipe" } = opts;

  if (isReducedMotion()) {
    return new Promise<void>((resolve) => {
      target.style.clipPath = "inset(0)";
      target.style.maskImage = "";
      target.style.webkitMaskImage = "";
      const a = target.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out", fill: "forwards" });
      a.onfinish = () => resolve();
    });
  }

  if (type === "spotlight-wipe") {
    // Soft elliptical highlight sweeps left → right. Pre-spotlight area is
    // dim (40% brightness); post-spotlight area is lit (full brightness).
    // We animate `mask-position` on a horizontally-tiled radial gradient
    // mask of width 200% so the spotlight ellipse can travel a full target
    // width without clipping.
    return new Promise<void>((resolve) => {
      const mask = "radial-gradient(ellipse 70% 130% at center, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 30%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.4) 100%)";
      target.style.maskImage = mask;
      target.style.webkitMaskImage = mask;
      target.style.maskSize = "200% 100%";
      target.style.webkitMaskSize = "200% 100%";
      target.style.maskRepeat = "no-repeat";
      target.style.webkitMaskRepeat = "no-repeat";
      const a = target.animate(
        [
          { maskPosition: "-100% center", WebkitMaskPosition: "-100% center", opacity: 0.6 },
          { maskPosition: "100% center", WebkitMaskPosition: "100% center", opacity: 1 },
        ],
        { duration: durationMs, easing: "ease-out", fill: "forwards" },
      );
      a.onfinish = () => {
        // Strip the mask so the final paint is the unmasked piece.
        target.style.maskImage = "";
        target.style.webkitMaskImage = "";
        resolve();
      };
    });
  }

  if (type === "ink-wash") {
    // Radial reveal expanding from the top-left corner. The mask grows from
    // 0 to ~140% so the ellipse fully covers the target by the end.
    return new Promise<void>((resolve) => {
      target.style.maskRepeat = "no-repeat";
      target.style.webkitMaskRepeat = "no-repeat";
      const a = target.animate(
        [
          {
            maskImage: "radial-gradient(circle at 0% 0%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 4%, rgba(0,0,0,0) 8%)",
            WebkitMaskImage: "radial-gradient(circle at 0% 0%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.6) 4%, rgba(0,0,0,0) 8%)",
            opacity: 0.4,
          },
          {
            maskImage: "radial-gradient(circle at 0% 0%, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 100%, rgba(0,0,0,1) 140%)",
            WebkitMaskImage: "radial-gradient(circle at 0% 0%, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 100%, rgba(0,0,0,1) 140%)",
            opacity: 1,
          },
        ],
        { duration: durationMs, easing: "ease-out", fill: "forwards" },
      );
      a.onfinish = () => {
        target.style.maskImage = "";
        target.style.webkitMaskImage = "";
        resolve();
      };
    });
  }

  // brush-wipe (Bibliophile default)
  return new Promise<void>((resolve) => {
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
