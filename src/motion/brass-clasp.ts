// Brass clasp — the only "snap" in the game. See spec §6.
//
// Two pseudo-clasp rects slide ±20px toward the target's edges over 220ms with
// cubic-bezier(0.4, 0, 0.2, 1). Tile pulses 1.0 → 1.12 → 1.0.
//
// We render the clasps as inline-SVG sprites overlaid on the target's bounding
// rect, then remove them on completion.

import { isReducedMotion } from "./util";

export function playBrassClasp(target: HTMLElement, color = "var(--gilt, #c9a85f)"): Promise<void> {
  if (isReducedMotion()) {
    // Reduced: subtle opacity flash on the target, no slide.
    return new Promise<void>((resolve) => {
      const a = target.animate(
        [{ filter: "brightness(1)" }, { filter: "brightness(1.4)" }, { filter: "brightness(1)" }],
        { duration: 280, easing: "ease-out", fill: "none" },
      );
      a.onfinish = () => resolve();
    });
  }

  const rect = target.getBoundingClientRect();
  const claspW = 18;
  const claspH = 10;

  function makeClasp(side: "top" | "bottom"): HTMLElement {
    const el = document.createElement("div");
    Object.assign(el.style, {
      position: "fixed",
      width: `${claspW}px`,
      height: `${claspH}px`,
      left: `${rect.left + rect.width / 2 - claspW / 2}px`,
      top: side === "top"
        ? `${rect.top - claspH - 12}px`
        : `${rect.bottom + 2}px`,
      background: color,
      border: "1px solid rgba(0,0,0,0.5)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 1px 2px rgba(0,0,0,0.4)",
      borderRadius: "1px",
      zIndex: "70",
      pointerEvents: "none",
    });
    document.body.appendChild(el);
    return el;
  }

  const top = makeClasp("top");
  const bottom = makeClasp("bottom");

  const easing = "cubic-bezier(0.4, 0, 0.2, 1)";
  const duration = 220;

  const aTop = top.animate(
    [{ transform: "translateY(-20px)" }, { transform: "translateY(20px)" }],
    { duration, easing, fill: "forwards" },
  );
  const aBottom = bottom.animate(
    [{ transform: "translateY(20px)" }, { transform: "translateY(-20px)" }],
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
    new Promise<void>((r) => { aTop.onfinish = () => r(); }),
    new Promise<void>((r) => { aBottom.onfinish = () => r(); }),
    new Promise<void>((r) => { tilePulse.onfinish = () => r(); }),
  ]).then(() => {
    // Hold the clasp visible for a beat, then dissolve.
    const fadeDuration = 240;
    const fadeTop = top.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fadeDuration, fill: "forwards" });
    const fadeBottom = bottom.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fadeDuration, fill: "forwards" });
    return Promise.all([
      new Promise<void>((r) => { fadeTop.onfinish = () => r(); }),
      new Promise<void>((r) => { fadeBottom.onfinish = () => r(); }),
    ]).then(() => {
      if (top.parentElement) top.parentElement.removeChild(top);
      if (bottom.parentElement) bottom.parentElement.removeChild(bottom);
    });
  });
}
