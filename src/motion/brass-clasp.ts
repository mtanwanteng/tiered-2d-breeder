// Brass clasp — the only "snap" in the game. See spec §6.
//
// Two pseudo-clasp rects slide ±20px toward the target's mid-line over 220ms
// with cubic-bezier(0.4, 0, 0.2, 1). Tile pulses 1.0 → 1.12 → 1.0.
//
// Two directional variants per theming-architecture.md §3.4:
//
//   horizontal-clasp (Bibliophile)
//     LEFT and RIGHT rects slide horizontally toward the centerline.
//     Brass clasp on a leather page edge.
//
//   vertical-pin (Curator + Cartographer)
//     TOP and BOTTOM rects descend / rise toward the centerline.
//     Pin pressing into matboard / corkboard.
//
// Callers should read the active theme's `motion.bindClaspType` and pass it
// as the `direction` option. Defaults to "horizontal" (Bibliophile) so legacy
// callers keep their behavior.

import { isReducedMotion } from "./util";

export interface BrassClaspOptions {
  /** "horizontal" = Bibliophile clasps; "vertical" = Curator/Cartographer pins. */
  direction?: "horizontal" | "vertical";
  /** Clasp color. Defaults to var(--accent-secondary). */
  color?: string;
}

export function playBrassClasp(
  target: HTMLElement,
  optionsOrColor: BrassClaspOptions | string = {},
): Promise<void> {
  // Back-compat: callers that passed a bare color string still work.
  const opts: BrassClaspOptions = typeof optionsOrColor === "string"
    ? { color: optionsOrColor }
    : optionsOrColor;
  const direction = opts.direction ?? "horizontal";
  const color = opts.color ?? "var(--accent-secondary, #c9a85f)";

  if (isReducedMotion()) {
    return new Promise<void>((resolve) => {
      const a = target.animate(
        [{ filter: "brightness(1)" }, { filter: "brightness(1.4)" }, { filter: "brightness(1)" }],
        { duration: 280, easing: "ease-out", fill: "none" },
      );
      a.onfinish = () => resolve();
    });
  }

  const rect = target.getBoundingClientRect();
  // Horizontal clasps are short tall rects sliding from L/R; vertical pins
  // are short wide rects descending/rising from T/B. Same total ±20px travel.
  const isHorizontal = direction === "horizontal";
  const claspW = isHorizontal ? 10 : 18;
  const claspH = isHorizontal ? 18 : 10;

  type Side = "left" | "right" | "top" | "bottom";
  const sides: [Side, Side] = isHorizontal ? ["left", "right"] : ["top", "bottom"];

  function makeClasp(side: Side): HTMLElement {
    const el = document.createElement("div");
    const baseStyle: Partial<CSSStyleDeclaration> = {
      position: "fixed",
      width: `${claspW}px`,
      height: `${claspH}px`,
      background: color,
      border: "1px solid rgba(0,0,0,0.5)",
      boxShadow: "inset 1px 0 0 rgba(255,255,255,0.25), 1px 0 2px rgba(0,0,0,0.4)",
      borderRadius: "1px",
      zIndex: "70",
      pointerEvents: "none",
    };
    if (side === "left") {
      baseStyle.top = `${rect.top + rect.height / 2 - claspH / 2}px`;
      baseStyle.left = `${rect.left - claspW - 12}px`;
    } else if (side === "right") {
      baseStyle.top = `${rect.top + rect.height / 2 - claspH / 2}px`;
      baseStyle.left = `${rect.right + 2}px`;
    } else if (side === "top") {
      baseStyle.left = `${rect.left + rect.width / 2 - claspW / 2}px`;
      baseStyle.top = `${rect.top - claspH - 12}px`;
    } else {
      baseStyle.left = `${rect.left + rect.width / 2 - claspW / 2}px`;
      baseStyle.top = `${rect.bottom + 2}px`;
    }
    Object.assign(el.style, baseStyle);
    document.body.appendChild(el);
    return el;
  }

  const a = makeClasp(sides[0]);
  const b = makeClasp(sides[1]);

  const easing = "cubic-bezier(0.4, 0, 0.2, 1)";
  const duration = 220;
  const axis = isHorizontal ? "X" : "Y";

  const aA = a.animate(
    [{ transform: `translate${axis}(-20px)` }, { transform: `translate${axis}(20px)` }],
    { duration, easing, fill: "forwards" },
  );
  const aB = b.animate(
    [{ transform: `translate${axis}(20px)` }, { transform: `translate${axis}(-20px)` }],
    { duration, easing, fill: "forwards" },
  );

  const tilePulse = target.animate(
    [
      { transform: "scale(1)", offset: 0 },
      { transform: "scale(1.12)", offset: 0.5 },
      { transform: "scale(1)", offset: 1 },
    ],
    { duration, easing, fill: "none" },
  );

  return Promise.all([
    new Promise<void>((r) => { aA.onfinish = () => r(); }),
    new Promise<void>((r) => { aB.onfinish = () => r(); }),
    new Promise<void>((r) => { tilePulse.onfinish = () => r(); }),
  ]).then(() => {
    const fadeDuration = 240;
    const fadeA = a.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fadeDuration, fill: "forwards" });
    const fadeB = b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fadeDuration, fill: "forwards" });
    return Promise.all([
      new Promise<void>((r) => { fadeA.onfinish = () => r(); }),
      new Promise<void>((r) => { fadeB.onfinish = () => r(); }),
    ]).then(() => {
      if (a.parentElement) a.parentElement.removeChild(a);
      if (b.parentElement) b.parentElement.removeChild(b);
    });
  });
}
