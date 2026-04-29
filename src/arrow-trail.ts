// Arrow trail — single arrow stepping along a quadratic Bézier curve.
//
// One small calligraphic arrow ("quill nib") teleports between three points on
// the curve, fading out and back in at each step. Dashes along the trail
// reveal only after the arrow passes their position. A small target circle
// at the terminal point appears with the arrow's arrival and fades 1s later
// alongside the arrow itself.
//
// Cycle (~3.3s):
//   0.0s   Arrow fades in at t=0.50; dashes for t≤0.50 reveal.
//   1.0s   Arrow fades out, repositions to t=0.75, fades in;
//          dashes for 0.50 < t ≤ 0.75 reveal.
//   2.0s   Arrow fades out, repositions to t=1.00 (destination), fades in;
//          remaining dashes reveal; target circle fades in at the terminal.
//   3.0s   Arrow + target + dashes all fade out together.
//
// While `active`, the cycle loops with a small gap between repeats.
//
// API:
//   const trail = createArrowTrail({ from: workspaceEl, to: slotEl });
//   document.body.appendChild(trail.el);
//   trail.attach();
//   trail.setActive(true);   // start looping
//   trail.setActive(false);  // stop after the current cycle's fade-out
//   trail.detach();          // remove from DOM, stop listeners

export type ArrowTrailEndpoint =
  | HTMLElement
  | { readonly x: number; readonly y: number }
  | (() => { x: number; y: number });

export interface ArrowTrailOptions {
  from: ArrowTrailEndpoint;
  to: ArrowTrailEndpoint;
  /** CSS color for arrow + dashes + target. Default: gilt. */
  color?: string;
  /** Bow magnitude as a fraction of from→to distance. Default 0.22. */
  curveAmount?: number;
  /** Which side of the from→to line the curve bows toward.
   *  - "auto" (default): pleasing upward bow
   *  - "left":  bow to the walker's left (math CW perpendicular)
   *  - "right": bow to the walker's right (math CCW perpendicular) */
  curveBias?: "auto" | "left" | "right";
}

export interface ArrowTrailHandle {
  el: HTMLElement;
  setActive: (active: boolean) => void;
  attach: () => void;
  detach: () => void;
  refresh: () => void;
}

/** Three discrete positions the arrow steps through along the curve. */
const STEP_TS = [0.5, 0.75, 1.0] as const;
/** Per-step arrow scale — arrow grows as it approaches the target so the
 *  final impact reads as the "loudest" beat (1.0× → 1.5× → 2.0×). */
const STEP_SCALES = [1.0, 1.5, 2.0] as const;
/** Per-step extent of the straight-line shadow (0–1 fraction of the line
 *  length). Decoupled from STEP_TS so the shadow grows from a third to
 *  full length while the arrow itself starts halfway down the curve. */
const STEP_SHADOW_EXTENTS = [1 / 3, 2 / 3, 1.0] as const;
const STEP_MS = 1000;       // wall-clock between step starts
const FADE_MS = 200;        // arrow / dash / target fade-in/out duration
const HOLD_AFTER_FINAL_MS = 1000; // time the arrow + target linger at the destination
const DASH_COUNT = 14;      // dashes evenly spaced along the path

let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
.arrow-trail {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 290;
  opacity: 0;
  transition: opacity 0.3s ease;
}
.arrow-trail.is-active { opacity: 1; }
.arrow-trail-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
/* Fuzzy black shadow underlay — a STRAIGHT line from "from" to "to",
   blurred so it reads as a soft shadow under the curve. Rendered first
   in the SVG so it z-stacks below the dashes / target / arrow above. */
.arrow-trail-shadow {
  stroke: rgba(0, 0, 0, 0.30);
  stroke-width: 6;
  stroke-linecap: round;
  fill: none;
  filter: blur(4px);
  opacity: 0;
  transition: opacity ${FADE_MS}ms ease-out;
}
.arrow-trail-shadow.is-visible { opacity: 1; }
.arrow-trail-dash {
  stroke: var(--arrow-color, #c9a85f);
  stroke-width: 1.6;
  stroke-linecap: round;
  opacity: 0;
  transition: opacity ${FADE_MS}ms ease-out;
}
.arrow-trail-dash.is-revealed { opacity: 0.65; }
.arrow-trail-arrow {
  fill: var(--arrow-color, #c9a85f);
  opacity: 0;
  transition: opacity ${FADE_MS}ms ease-out;
}
.arrow-trail-arrow.is-visible { opacity: 1; }
/* Target: outer <g class="arrow-trail-target-position"> uses the SVG
   transform attribute to translate to the terminal point; inner
   <g class="arrow-trail-target-scale"> uses CSS transform to scale in/out.
   The two are split because CSS transform overrides SVG transform attribute
   in modern browsers — putting both on one element loses the translate. */
.arrow-trail-target-position {
  pointer-events: none;
}
.arrow-trail-target-scale {
  opacity: 0;
  transform-origin: 0 0;
  transform: scale(0.5);
  transition:
    opacity ${FADE_MS}ms ease-out,
    transform ${FADE_MS}ms ease-out;
}
.arrow-trail-target-scale.is-visible {
  opacity: 1;
  transform: scale(1);
}
/* Inner filled dot. Stacked drop-shadows: a dark outline (1px, ink-black)
   gives high contrast on light backgrounds, then a gilt halo on top. */
.arrow-trail-target-fill {
  fill: var(--arrow-color, #c9a85f);
  filter:
    drop-shadow(0 0 1px var(--ink-black, #1a1208))
    drop-shadow(0 0 1px var(--ink-black, #1a1208))
    drop-shadow(0 0 6px var(--arrow-color, #c9a85f));
}
.arrow-trail-target-ring {
  fill: none;
  stroke: var(--arrow-color, #c9a85f);
  stroke-width: 1.6;
  opacity: 0.95;
  filter:
    drop-shadow(0 0 1px var(--ink-black, #1a1208))
    drop-shadow(0 0 1px var(--ink-black, #1a1208))
    drop-shadow(0 0 4px var(--arrow-color, #c9a85f));
}
@media (prefers-reduced-motion: reduce) {
  .arrow-trail-dash, .arrow-trail-arrow, .arrow-trail-target {
    transition-duration: 80ms;
    filter: none;
  }
}
`;
  document.head.appendChild(style);
}

interface Point { x: number; y: number }

function endpointToPoint(ep: ArrowTrailEndpoint): Point {
  if (typeof ep === "function") return ep();
  if (ep instanceof HTMLElement) {
    const r = ep.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return { x: ep.x, y: ep.y };
}

/** Perpendicular to the from→to direction, biased toward `bias`:
 *  - "right": math CCW rotation — bow to the walker's right (e.g. for a
 *    road-turn arc that arcs further outward before closing in)
 *  - "left":  math CW rotation — bow to the walker's left
 *  - "auto":  pleasing upward bow (whichever side has smaller y in screen) */
function biasedPerpendicular(from: Point, to: Point, bias: "auto" | "left" | "right"): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return { x: 0, y: 0 };
  const ccw = { x: -dy / len, y:  dx / len };
  const cw  = { x:  dy / len, y: -dx / len };
  if (bias === "right") return ccw;
  if (bias === "left") return cw;
  if (cw.y < ccw.y) return cw;
  if (ccw.y < cw.y) return ccw;
  return { x: 0, y: -1 };
}

function bezier(p0: Point, p1: Point, p2: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function bezierTangentAngle(p0: Point, p1: Point, p2: Point, t: number): number {
  const u = 1 - t;
  const dx = 2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
  const dy = 2 * u * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
  return Math.atan2(dy, dx);
}

const SVG_NS = "http://www.w3.org/2000/svg";

export function createArrowTrail(options: ArrowTrailOptions): ArrowTrailHandle {
  ensureStyles();
  const color = options.color ?? "var(--gilt, #c9a85f)";
  const curveAmount = options.curveAmount ?? 0.22;
  const curveBias = options.curveBias ?? "auto";

  const wrap = document.createElement("div");
  wrap.className = "arrow-trail";
  wrap.style.setProperty("--arrow-color", color);

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "arrow-trail-svg");
  svg.setAttribute("preserveAspectRatio", "none");

  // Shadow line — straight (NOT curved) from p0 to p2, blurred, dark.
  // Appended FIRST so it z-stacks below dashes, target, and arrow.
  const shadowLine = document.createElementNS(SVG_NS, "line");
  shadowLine.setAttribute("class", "arrow-trail-shadow");
  svg.appendChild(shadowLine);

  // Dashes — short line segments along the tangent at each sampled point.
  const dashes: SVGLineElement[] = [];
  const dashTs: number[] = [];
  for (let i = 1; i <= DASH_COUNT; i++) {
    // Skip t=0 (arrow start) and exact t=1 (where target sits) by sampling
    // at fractions that avoid both ends.
    const t = i / (DASH_COUNT + 1);
    dashTs.push(t);
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("class", "arrow-trail-dash");
    svg.appendChild(line);
    dashes.push(line);
  }

  // Target — two nested <g> elements:
  //   targetPosition uses the SVG transform attribute to translate to (p2.x, p2.y)
  //   targetScale uses CSS transform to scale in/out
  // CSS transforms override SVG transform attributes, so they can't share an
  // element without the translate getting clobbered.
  const targetPosition = document.createElementNS(SVG_NS, "g");
  targetPosition.setAttribute("class", "arrow-trail-target-position");
  const targetScale = document.createElementNS(SVG_NS, "g");
  targetScale.setAttribute("class", "arrow-trail-target-scale");
  const targetFill = document.createElementNS(SVG_NS, "circle");
  targetFill.setAttribute("class", "arrow-trail-target-fill");
  targetFill.setAttribute("cx", "0");
  targetFill.setAttribute("cy", "0");
  targetFill.setAttribute("r", "4");
  const targetRing = document.createElementNS(SVG_NS, "circle");
  targetRing.setAttribute("class", "arrow-trail-target-ring");
  targetRing.setAttribute("cx", "0");
  targetRing.setAttribute("cy", "0");
  targetRing.setAttribute("r", "10");
  targetScale.appendChild(targetFill);
  targetScale.appendChild(targetRing);
  targetPosition.appendChild(targetScale);
  svg.appendChild(targetPosition);

  // Arrow rendered LAST so it stacks above the target circles — the final
  // step scales the arrow to 2× and we want the impact to land on top of
  // the rings, not get hidden behind them.
  const arrowEl = document.createElementNS(SVG_NS, "path");
  arrowEl.setAttribute("class", "arrow-trail-arrow");
  arrowEl.setAttribute("d", "M -10 -2.4 C -6 -1.6 -2 -1 0 0 C -2 1 -6 1.6 -10 2.4 C -7.5 0 -7.5 0 -10 -2.4 Z");
  svg.appendChild(arrowEl);

  wrap.appendChild(svg);

  // Path geometry (recomputed in recompute()).
  let p0: Point = { x: 0, y: 0 };
  let p1: Point = { x: 0, y: 0 };
  let p2: Point = { x: 0, y: 0 };
  // How far along the from→to straight line the shadow currently extends.
  // Steps 1/3 → 2/3 → full as the arrow advances; resets each cycle.
  let shadowExtentT: number = STEP_SHADOW_EXTENTS[0];

  const recompute = () => {
    const from = endpointToPoint(options.from);
    const to = endpointToPoint(options.to);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    const perp = biasedPerpendicular(from, to, curveBias);
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const offset = len * curveAmount;
    p0 = from;
    p1 = { x: mid.x + perp.x * offset, y: mid.y + perp.y * offset };
    p2 = to;
    svg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);

    // Straight-line shadow from p0 toward p2 — extends only as far as the
    // arrow has progressed. The arrow's first step lands at t=0.5, so the
    // shadow's initial reach is half the line length, then grows to 0.75
    // and full length on later steps.
    const ex = p0.x + (p2.x - p0.x) * shadowExtentT;
    const ey = p0.y + (p2.y - p0.y) * shadowExtentT;
    shadowLine.setAttribute("x1", String(p0.x));
    shadowLine.setAttribute("y1", String(p0.y));
    shadowLine.setAttribute("x2", String(ex));
    shadowLine.setAttribute("y2", String(ey));

    // Position dashes along the tangent at each sampled t. Length 4px.
    for (let i = 0; i < dashes.length; i++) {
      const t = dashTs[i];
      const pos = bezier(p0, p1, p2, t);
      const angle = bezierTangentAngle(p0, p1, p2, t);
      const dxL = Math.cos(angle) * 2;
      const dyL = Math.sin(angle) * 2;
      dashes[i].setAttribute("x1", String(pos.x - dxL));
      dashes[i].setAttribute("y1", String(pos.y - dyL));
      dashes[i].setAttribute("x2", String(pos.x + dxL));
      dashes[i].setAttribute("y2", String(pos.y + dyL));
    }

    // Position target anchor at p2 (terminal). The inner circle scales around
    // its own (0,0) origin, which is the anchor's translated position.
    targetPosition.setAttribute("transform", `translate(${p2.x} ${p2.y})`);
  };

  recompute();

  // ───────────────────────── animation cycle ────────────────────────────
  // Each cycle steps the arrow through STEP_TS, revealing dashes as it
  // arrives, then holds at the terminal for HOLD_AFTER_FINAL_MS, then fades.
  // setActive(true) plays ONE cycle then auto-deactivates — caller handles
  // any idle-gated re-triggering.

  let active = false;
  let cycleTimers: number[] = [];

  const clearTimers = () => {
    for (const t of cycleTimers) window.clearTimeout(t);
    cycleTimers = [];
  };

  const setArrowAt = (t: number, scale: number = 1) => {
    const pos = bezier(p0, p1, p2, t);
    const angle = bezierTangentAngle(p0, p1, p2, t) * 180 / Math.PI;
    arrowEl.setAttribute("transform", `translate(${pos.x} ${pos.y}) rotate(${angle}) scale(${scale})`);
  };

  const revealDashesUpTo = (t: number) => {
    for (let i = 0; i < dashes.length; i++) {
      if (dashTs[i] <= t + 0.001) dashes[i].classList.add("is-revealed");
    }
  };

  const hideAllDashes = () => {
    for (const d of dashes) d.classList.remove("is-revealed");
  };

  const fadeOutAll = () => {
    arrowEl.classList.remove("is-visible");
    targetScale.classList.remove("is-visible");
    shadowLine.classList.remove("is-visible");
    hideAllDashes();
  };

  const runCycle = () => {
    if (!active) return;
    // Reset shadow extent to its first-step value before recomputing the
    // geometry, so the line is drawn at one-third length when the cycle opens.
    shadowExtentT = STEP_SHADOW_EXTENTS[0];
    recompute();
    fadeOutAll();
    // Shadow line fades in with the first arrow step and stays visible
    // through the cycle's hold; the final fadeOutAll() (1s after the last
    // step) takes it down with the rest.
    cycleTimers.push(window.setTimeout(() => {
      if (active) shadowLine.classList.add("is-visible");
    }, 0));

    // Step k starts at k * STEP_MS. Each step:
    //   - swap to new position while still invisible (50ms cushion before fade-in)
    //   - fade in (200ms)
    //   - reveal dashes up to that t
    //   - last step also fades the target in
    STEP_TS.forEach((t, idx) => {
      const stepStart = idx * STEP_MS;
      // Fade out a beat before the position change so the arrow doesn't appear
      // to teleport — only applies to non-first steps.
      if (idx > 0) {
        cycleTimers.push(window.setTimeout(() => {
          arrowEl.classList.remove("is-visible");
        }, stepStart - FADE_MS));
      }
      cycleTimers.push(window.setTimeout(() => {
        if (!active) return;
        setArrowAt(t, STEP_SCALES[idx] ?? 1);
        arrowEl.classList.add("is-visible");
        revealDashesUpTo(t);
        // Extend the straight-line shadow to its per-step fraction
        // (1/3 → 2/3 → full) so the underlay grows alongside the arrow.
        shadowExtentT = STEP_SHADOW_EXTENTS[idx] ?? 1;
        recompute();
        if (idx === STEP_TS.length - 1) {
          targetScale.classList.add("is-visible");
        }
      }, stepStart));
    });

    // After HOLD_AFTER_FINAL_MS past the start of the last step, fade
    // everything out together.
    const fadeOutAt = (STEP_TS.length - 1) * STEP_MS + HOLD_AFTER_FINAL_MS;
    cycleTimers.push(window.setTimeout(() => {
      fadeOutAll();
    }, fadeOutAt));

    // One-shot: auto-deactivate after the fade-out completes. The caller
    // (main.ts) handles idle-gated re-triggering — the trail no longer
    // self-loops while active.
    cycleTimers.push(window.setTimeout(() => {
      active = false;
      wrap.classList.remove("is-active");
    }, fadeOutAt + FADE_MS));
  };

  // ───────────────────────── attach + lifecycle ─────────────────────────
  let attached = false;
  const onResize = () => recompute();
  const onScroll = () => recompute();

  return {
    el: wrap,
    attach() {
      if (attached) return;
      attached = true;
      window.addEventListener("resize", onResize);
      window.addEventListener("scroll", onScroll, true);
      recompute();
    },
    detach() {
      attached = false;
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
      clearTimers();
      active = false;
      wrap.remove();
    },
    setActive(next: boolean) {
      wrap.classList.toggle("is-active", next);
      if (next && !active) {
        active = true;
        runCycle();
      } else if (!next && active) {
        active = false;
        clearTimers();
        fadeOutAll();
      }
    },
    refresh() {
      recompute();
    },
  };
}
