// Reusable animated glowing arrow trail. The trail points AT a target element from a direction
// — by default, originating to the right of the target and pointing left. Used at era end to
// guide the player from the workspace into the era-summary idea slot, but useful anywhere a
// directional cue is needed.
//
// Usage:
//   const trail = createArrowTrail({ target, direction: "left", color: "#ffd700" });
//   document.body.appendChild(trail.el);
//   trail.attach();   // start animating + repositioning on resize/scroll
//   trail.setActive(true);
//   ...
//   trail.setActive(false);  // freeze animation, fade out
//   trail.detach();           // remove from DOM and stop listeners

export type ArrowTrailDirection = "left" | "right" | "up" | "down";

export interface ArrowTrailOptions {
  /** Element the arrow points at. The trail will be re-positioned relative to this. */
  target: HTMLElement;
  /** Direction the arrow head points (i.e. the side of `target` the head touches). Default: "left". */
  direction?: ArrowTrailDirection;
  /** CSS color for the glow + arrow stroke. Default: gold. */
  color?: string;
  /** Length in px of the trail (from origin to arrowhead). Default: 180. */
  length?: number;
}

export interface ArrowTrailHandle {
  el: HTMLElement;
  setActive: (active: boolean) => void;
  attach: () => void;
  detach: () => void;
}

let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
.arrow-trail {
  position: fixed;
  pointer-events: none;
  z-index: 290;
  opacity: 0;
  transition: opacity 0.3s ease;
}
.arrow-trail.is-active {
  opacity: 1;
}
.arrow-trail-svg {
  display: block;
  overflow: visible;
  filter: drop-shadow(0 0 6px var(--arrow-color, #ffd700));
}
.arrow-trail-line {
  stroke: var(--arrow-color, #ffd700);
  stroke-width: 3;
  fill: none;
  stroke-linecap: round;
  stroke-dasharray: 12 10;
  animation: arrow-trail-march 0.9s linear infinite;
}
.arrow-trail-head {
  fill: var(--arrow-color, #ffd700);
  animation: arrow-trail-pulse 1.4s ease-in-out infinite;
  transform-origin: center;
}
.arrow-trail.is-paused .arrow-trail-line,
.arrow-trail.is-paused .arrow-trail-head {
  animation-play-state: paused;
}
@keyframes arrow-trail-march {
  to { stroke-dashoffset: -22; }
}
@keyframes arrow-trail-pulse {
  0%, 100% { transform: scale(1); opacity: 0.95; }
  50% { transform: scale(1.18); opacity: 1; }
}
`;
  document.head.appendChild(style);
}

export function createArrowTrail(options: ArrowTrailOptions): ArrowTrailHandle {
  ensureStyles();
  const direction: ArrowTrailDirection = options.direction ?? "left";
  const color = options.color ?? "#ffd700";
  const length = options.length ?? 180;

  const wrap = document.createElement("div");
  wrap.className = "arrow-trail";
  wrap.style.setProperty("--arrow-color", color);
  // Render the SVG so the body extends in the +x direction and the arrowhead sits at x=0;
  // we then rotate the wrapper based on direction so x=0 lands on the target's near edge.
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("class", "arrow-trail-svg");
  svg.setAttribute("width", String(length + 16));
  svg.setAttribute("height", "24");
  svg.setAttribute("viewBox", `-12 -12 ${length + 16} 24`);

  const line = document.createElementNS(svgNS, "line");
  line.setAttribute("class", "arrow-trail-line");
  line.setAttribute("x1", String(length));
  line.setAttribute("y1", "0");
  line.setAttribute("x2", "8");
  line.setAttribute("y2", "0");
  svg.appendChild(line);

  const head = document.createElementNS(svgNS, "polygon");
  head.setAttribute("class", "arrow-trail-head");
  head.setAttribute("points", "0,0 12,-7 12,7");
  svg.appendChild(head);

  wrap.appendChild(svg);

  const reposition = () => {
    if (!options.target.isConnected) return;
    const r = options.target.getBoundingClientRect();
    let originX = 0;
    let originY = 0;
    let rotateDeg = 0;
    // SVG is drawn with the arrowhead apex at (0,0) pointing in the -x direction, and the body
    // extending in the +x direction. `direction` names which side of the target the body
    // (origin/tail) extends toward; the arrowhead always lands on the target's near edge.
    switch (direction) {
      case "right":
        // tail extends to the right of the target → no rotation, head at r.right
        originX = r.right + 4;
        originY = r.top + r.height / 2;
        rotateDeg = 0;
        break;
      case "left":
        // tail extends to the left of the target → flip horizontally, head at r.left
        originX = r.left - 4;
        originY = r.top + r.height / 2;
        rotateDeg = 180;
        break;
      case "down":
        originX = r.left + r.width / 2;
        originY = r.bottom + 4;
        rotateDeg = 90;
        break;
      case "up":
        originX = r.left + r.width / 2;
        originY = r.top - 4;
        rotateDeg = -90;
        break;
    }
    wrap.style.left = `${originX}px`;
    wrap.style.top = `${originY}px`;
    wrap.style.transform = `translate(0, -50%) rotate(${rotateDeg}deg)`;
    wrap.style.transformOrigin = "0 50%";
  };

  let attached = false;
  const onResize = () => reposition();
  const onScroll = () => reposition();

  return {
    el: wrap,
    attach() {
      if (attached) return;
      attached = true;
      window.addEventListener("resize", onResize);
      window.addEventListener("scroll", onScroll, true);
      reposition();
    },
    detach() {
      attached = false;
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
      wrap.remove();
    },
    setActive(active: boolean) {
      // Pause animation when inactive instead of just hiding, to spare CPU.
      wrap.classList.toggle("is-active", active);
      wrap.classList.toggle("is-paused", !active);
      if (active) reposition();
    },
  };
}
