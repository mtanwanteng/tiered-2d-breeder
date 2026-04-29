// Ink-bloom — primitive arrival animation for tiles, narrative text, ink halos.
// See bibliophile-spec.md §6 and theming-architecture.md §3.4 variants.
//
// Three variants per `motion.inkBloomType`. Total 600ms each.
//
//   fill-expand (Bibliophile)
//     scale 0 → 1, opacity 0 → 1 over the first 350ms.
//     The "ink dot blooming" feel.
//
//   frame-then-fill (Curator)
//     A thin outline draws around the target (200ms), then the interior
//     fades in (400ms). Mat-board sketching first, contents after.
//
//   outline-then-fill (Cartographer)
//     Sepia outline draws first (300ms), then emoji + label fade in
//     (300ms). Reads as the tile being sketched into a journal.
//
// Reduced motion: 200ms opacity-only fade for all variants.
//
// Note: per D24, tile arrivals in Bibliophile use a CSS scale-pulse rather
// than this primitive. The variant infrastructure is here for surfaces that
// *do* call into it (narrative text, ink halos, future surfaces).

import { isReducedMotion } from "./util";

export interface InkBloomOptions {
  durationMs?: number;
  startScale?: number;
  type?: "fill-expand" | "frame-then-fill" | "outline-then-fill";
}

export function playInkBloom(target: HTMLElement, opts: InkBloomOptions = {}): Promise<void> {
  const { durationMs = 600, startScale = 0, type = "fill-expand" } = opts;

  if (isReducedMotion()) {
    return new Promise<void>((resolve) => {
      const a = target.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: 200, easing: "ease-out", fill: "forwards" },
      );
      a.onfinish = () => resolve();
    });
  }

  if (type === "frame-then-fill") {
    // Outline phase: draw a thin border at full opacity with interior
    // transparent. Fill phase: the interior fades in. The outline color
    // resolves from the active theme's --border-strong so Curator's
    // near-black mat shows through.
    const outlineMs = Math.round(durationMs / 3); // 200ms of 600ms
    const fillMs = durationMs - outlineMs;
    const originalOutline = target.style.outline;
    const originalOutlineOffset = target.style.outlineOffset;
    return new Promise<void>((resolve) => {
      target.style.outline = "1.5px solid var(--border-strong, #1a1a1a)";
      target.style.outlineOffset = "-0.5px";
      const a1 = target.animate(
        [
          { transform: `scale(${startScale === 0 ? 0.92 : startScale})`, opacity: 0 },
          { transform: "scale(1)", opacity: 0.0 }, // interior still hidden
        ],
        { duration: outlineMs, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "forwards" },
      );
      a1.onfinish = () => {
        const a2 = target.animate(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: fillMs, easing: "ease-out", fill: "forwards" },
        );
        a2.onfinish = () => {
          target.style.outline = originalOutline;
          target.style.outlineOffset = originalOutlineOffset;
          resolve();
        };
      };
    });
  }

  if (type === "outline-then-fill") {
    // Cartographer: sepia outline draws first, then fades the interior in.
    // Mechanically similar to frame-then-fill but slower outline phase
    // (300ms) and a sepia color, suggesting hand-drawn sketching.
    const outlineMs = Math.round(durationMs / 2); // 300ms of 600ms
    const fillMs = durationMs - outlineMs;
    const originalOutline = target.style.outline;
    const originalOutlineOffset = target.style.outlineOffset;
    return new Promise<void>((resolve) => {
      target.style.outline = "1px dashed var(--text-primary, #3a2818)";
      target.style.outlineOffset = "-0.5px";
      const a1 = target.animate(
        [
          { transform: `scale(${startScale === 0 ? 0.94 : startScale})`, opacity: 0 },
          { transform: "scale(1)", opacity: 0 },
        ],
        { duration: outlineMs, easing: "ease-out", fill: "forwards" },
      );
      a1.onfinish = () => {
        const a2 = target.animate(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: fillMs, easing: "ease-out", fill: "forwards" },
        );
        a2.onfinish = () => {
          target.style.outline = originalOutline;
          target.style.outlineOffset = originalOutlineOffset;
          resolve();
        };
      };
    });
  }

  // fill-expand (Bibliophile default)
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
