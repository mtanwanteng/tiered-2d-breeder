// Brass clasp — the only "snap" in the game. See spec §6.
//
// Two pseudo-clasp rects slide ±20px toward the target's vertical mid-line
// from the LEFT and RIGHT sides over 220ms with cubic-bezier(0.4, 0, 0.2, 1).
// Tile pulses 1.0 → 1.12 → 1.0.
//
// Horizontal axis is the Bibliophile variant per
// theming-architecture.md §3.4 (`--bind-clasp-type: "horizontal-clasp"`).
// Curator and Cartographer use `"vertical-pin"` — when those themes ship,
// add a direction option here and dispatch from main.ts on the active
// theme's manifest.
//
// We render the clasps as inline-SVG sprites overlaid on the target's bounding
// rect, then remove them on completion.

import { isReducedMotion } from "./util";

export function playBrassClasp(target: HTMLElement, color = "var(--accent-secondary, #c9a85f)"): Promise<void> {
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
  // Horizontal clasps — short tall rects that slide in from each side.
  const claspW = 10;
  const claspH = 18;

  function makeClasp(side: "left" | "right"): HTMLElement {
    const el = document.createElement("div");
    Object.assign(el.style, {
      position: "fixed",
      width: `${claspW}px`,
      height: `${claspH}px`,
      top: `${rect.top + rect.height / 2 - claspH / 2}px`,
      left: side === "left"
        ? `${rect.left - claspW - 12}px`
        : `${rect.right + 2}px`,
      background: color,
      border: "1px solid rgba(0,0,0,0.5)",
      boxShadow: "inset 1px 0 0 rgba(255,255,255,0.25), 1px 0 2px rgba(0,0,0,0.4)",
      borderRadius: "1px",
      zIndex: "70",
      pointerEvents: "none",
    });
    document.body.appendChild(el);
    return el;
  }

  const left = makeClasp("left");
  const right = makeClasp("right");

  const easing = "cubic-bezier(0.4, 0, 0.2, 1)";
  const duration = 220;

  const aLeft = left.animate(
    [{ transform: "translateX(-20px)" }, { transform: "translateX(20px)" }],
    { duration, easing, fill: "forwards" },
  );
  const aRight = right.animate(
    [{ transform: "translateX(20px)" }, { transform: "translateX(-20px)" }],
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
    new Promise<void>((r) => { aLeft.onfinish = () => r(); }),
    new Promise<void>((r) => { aRight.onfinish = () => r(); }),
    new Promise<void>((r) => { tilePulse.onfinish = () => r(); }),
  ]).then(() => {
    // Hold the clasp visible for a beat, then dissolve.
    const fadeDuration = 240;
    const fadeLeft = left.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fadeDuration, fill: "forwards" });
    const fadeRight = right.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fadeDuration, fill: "forwards" });
    return Promise.all([
      new Promise<void>((r) => { fadeLeft.onfinish = () => r(); }),
      new Promise<void>((r) => { fadeRight.onfinish = () => r(); }),
    ]).then(() => {
      if (left.parentElement) left.parentElement.removeChild(left);
      if (right.parentElement) right.parentElement.removeChild(right);
    });
  });
}
