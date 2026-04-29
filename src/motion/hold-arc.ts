// Hold-arc — the master interaction primitive. See spec §2.4, §6.
//
// An SVG arc drawn beneath/around a target element that fills clockwise over a
// fixed duration (2.5s). On full fill the gesture is "committed"; on early lift
// it's "cancelled" and the arc fades.
//
// The arc is the visual contract that lets the player feel the cello phrase —
// it runs LINEAR (no easing) because it's a clock, not an animation.

import { isReducedMotion } from "./util";

export interface HoldArcOptions {
  /** Element the arc circles. Used to derive arc size + position. */
  target: HTMLElement;
  /** Hold duration. Spec default: 2500ms (matches cello phrase). */
  durationMs?: number;
  /** Stroke color. Defaults to var(--accent-secondary) (Bibliophile = gilt). */
  color?: string;
  /** Stroke width. Defaults to 4px. */
  thickness?: number;
  /** Inset from the target's bounds. Negative = arc draws outside. Default -8. */
  inset?: number;
  /** Opacity of the unfilled ("idle") track stroke. Default 0.3. */
  idleOpacity?: number;
  /** Container to render the SVG into. Default: document.body. */
  parent?: HTMLElement;
}

export interface HoldArcHandle {
  /** Cancel an in-progress hold. Triggers the cancel animation + resolves with "cancel". */
  cancel(): void;
  /** Force-complete the arc immediately (skips remaining time). Resolves with "complete". */
  forceComplete(): void;
  /** Remove the SVG from the DOM. Idempotent. */
  destroy(): void;
  /** Resolves when the hold concludes. */
  promise: Promise<"complete" | "cancel">;
}

export function startHoldArc(options: HoldArcOptions): HoldArcHandle {
  const {
    target,
    durationMs = 2500,
    color = "var(--accent-secondary, #c9a85f)",
    thickness = 4,
    inset = -8,
    idleOpacity = 0.3,
    parent = document.body,
  } = options;

  const reduced = isReducedMotion();

  // Compute geometry from the target's screen-rect. The SVG itself is positioned
  // absolutely on top of the page so the arc sits exactly around the target.
  const rect = target.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) - inset * 2;
  const radius = size / 2 - thickness;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  Object.assign(svg.style, {
    position: "fixed",
    left: `${cx - size / 2}px`,
    top: `${cy - size / 2}px`,
    pointerEvents: "none",
    zIndex: "60",
    overflow: "visible",
  });

  // Idle track — full circle at low alpha so the player can see where the arc will fill to.
  const track = document.createElementNS(svgNS, "circle");
  track.setAttribute("cx", String(size / 2));
  track.setAttribute("cy", String(size / 2));
  track.setAttribute("r", String(radius));
  track.setAttribute("fill", "none");
  track.setAttribute("stroke", color);
  track.setAttribute("stroke-width", String(thickness));
  track.setAttribute("stroke-opacity", String(idleOpacity));

  // Filled arc — same geometry, animated via stroke-dashoffset.
  const arc = document.createElementNS(svgNS, "circle");
  arc.setAttribute("cx", String(size / 2));
  arc.setAttribute("cy", String(size / 2));
  arc.setAttribute("r", String(radius));
  arc.setAttribute("fill", "none");
  arc.setAttribute("stroke", color);
  arc.setAttribute("stroke-width", String(thickness));
  arc.setAttribute("stroke-linecap", "round");
  arc.setAttribute("transform", `rotate(-90 ${size / 2} ${size / 2})`);
  const circumference = 2 * Math.PI * radius;
  arc.setAttribute("stroke-dasharray", String(circumference));
  arc.setAttribute("stroke-dashoffset", String(circumference));

  svg.appendChild(track);
  svg.appendChild(arc);
  parent.appendChild(svg);

  let resolved: "complete" | "cancel" | null = null;
  let resolvePromise!: (v: "complete" | "cancel") => void;
  const promise = new Promise<"complete" | "cancel">((r) => { resolvePromise = r; });

  // Animate the stroke-dashoffset from `circumference` down to 0. Linear easing —
  // the arc is a clock, not a curve.
  let animation: Animation | null = null;
  if (reduced) {
    // Reduced motion: skip the visual sweep but still honor the duration.
    arc.setAttribute("stroke-dashoffset", "0");
    arc.style.opacity = "0.7";
    setTimeout(() => {
      if (resolved) return;
      resolved = "complete";
      resolvePromise("complete");
    }, durationMs);
  } else {
    animation = arc.animate(
      [{ strokeDashoffset: circumference }, { strokeDashoffset: 0 }],
      { duration: durationMs, easing: "linear", fill: "forwards" },
    );
    animation.onfinish = () => {
      if (resolved) return;
      resolved = "complete";
      resolvePromise("complete");
    };
  }

  function destroy() {
    if (svg.parentElement) svg.parentElement.removeChild(svg);
  }

  function cancel() {
    if (resolved) return;
    resolved = "cancel";
    if (animation) animation.cancel();
    if (reduced) {
      arc.setAttribute("stroke-dashoffset", String(circumference));
      arc.style.opacity = "0";
      setTimeout(destroy, 160);
    } else {
      // Fade out the arc over 160ms, then remove.
      svg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "ease-out", fill: "forwards" })
        .onfinish = () => destroy();
    }
    resolvePromise("cancel");
  }

  function forceComplete() {
    if (resolved) return;
    resolved = "complete";
    if (animation) animation.finish();
    else arc.setAttribute("stroke-dashoffset", "0");
    resolvePromise("complete");
  }

  return { cancel, forceComplete, destroy, promise };
}
