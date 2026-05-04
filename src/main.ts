import type { Tier, ElementData, ModelId, ActionLogEntry, EraHistory, TapestryGameData, Era } from "./types";
import { recipeKey, MODELS } from "./types";
import { combineElements } from "./gemini";
import { InMemoryRecipeStore } from "./recipes";
import { FilePromptProvider } from "./prompt-loader";
import { EraManager } from "./era-manager";
import { log } from "./logger";
import { isLocalBuild } from "./env";
import { initDebugConsole } from "./debug-console";
import { saveGame, loadGame, clearSave, SAVE_KEY, SELECT_FIVE_SAVE_KEY } from "./save";
import type { SaveData } from "./save";
import { renderCombinationGraph } from "./combination-graph";
import { authStore } from "./store/auth";
import { isDiscordActivity } from "./discord";
import { getOrCreateAnonId } from "./identity";
import posthog from "posthog-js";
import { toPng } from "html-to-image";
import { createArrowTrail, type ArrowTrailHandle } from "./arrow-trail";
import type { EraIdeaTilePick } from "./types";
import { chapterTag, getTheme, setTheme, setThemeByName, THEMES } from "./theme";
import { chapterStripeColor } from "./theme/chapterColor";
import {
  startHoldArc,
  type HoldArcHandle,
  playBrassClasp,
  playBrushWipe,
  scratchIn,
  playInkPointDispersal,
  playWaxStamp,
} from "./motion";
import { audio, type CelloSustainHandle } from "./audio";
import { playFailedCombineShake, playPageTurn, wait } from "./motion";
import { startAiThinking } from "./ai-thinking-state";
import { initSettings, getSettings, setSetting } from "./settings";

// --- Types ---
interface CombineItem {
  id: string;
  name: string;
  color: string;
  tier: Tier;
  emoji: string;
  description: string;
  narrative: string;
  el: HTMLElement;
  x: number;
  y: number;
}

// Phase D dev hook: expose the theme switcher on window so DevTools can
// flip themes for testing before the Phase F settings drawer ships.
//   > setThemeByName("curator")  — switch to Curator
//   > setThemeByName("bibliophile")  — switch back
//   > THEMES                     — list registered themes
// Production safe: function is harmless even when shipped (only callable
// from a console with access to window).
declare global {
  interface Window {
    setTheme: typeof setTheme;
    setThemeByName: typeof setThemeByName;
    getTheme: typeof getTheme;
    THEMES: typeof THEMES;
  }
}
if (typeof window !== "undefined") {
  window.setTheme = setTheme;
  window.setThemeByName = setThemeByName;
  window.getTheme = getTheme;
  window.THEMES = THEMES;
}

export function mountGame(app: HTMLElement, selectFiveMode = false) {
// --- Providers ---
const recipeStore = new InMemoryRecipeStore();
const promptProvider = new FilePromptProvider();
const eraManager = new EraManager();

// --- State ---
let selectedModel: ModelId = MODELS[0].id;
const items: CombineItem[] = [];
const actionLog: ActionLogEntry[] = [];
let eraActionLog: ActionLogEntry[] = [];
let eraStartedAt: number = Date.now();
let eraSpawnCounts: Record<string, number> = {};
let eraSpawnByTier: Record<number, number> = {};
let pendingCombines = 0;
let eraAdvancing = false;
let pendingEraResult: { narrative: string } | null = null;
let victoryShown = false;
let restarting = false;
let idCounter = 0;
let dragItem: CombineItem | null = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let busy = false;

// --- Select-five mode state ---
type SelectionSlotItem = { name: string; tier: Tier; emoji: string; color: string };
interface SelectionSlot { index: number; el: HTMLElement; item: SelectionSlotItem | null; }
const selectionSlots: SelectionSlot[] = [];
let selectFiveEraIndex = 0;
let hasLoggedAllFilled = false;
let firstFinalizeFired = false;
let finalizeCount = 0;
let combinesSinceFinalize = 0;
let postFullSlotChanges = 0;
let sessionStartTime = Date.now();
let dragSourceSlotIndex: number | null = null;
let pendingS5SlotRestore: ({ name: string; tier: Tier; emoji?: string; color?: string } | null)[] | null = null;
const MAX_ACTION_LOG = 500;

// --- In-game era idea slot state ---
// One slot above #chart-era-btn ("Next Age →") in the era-objectives panel. Visible only while
// the era is ready to advance. Filled by dragging a workspace tile into it; #chart-era-btn is
// disabled until the slot is filled. On click the picked tile is captured, attached to the
// just-completed era's history record (after recordHistory runs), persisted server-side, and
// rendered above the corresponding cube in #era-progress.
type EraIdeaSlotItem = SelectionSlotItem & { description?: string; narrative?: string };
let pendingEraIdeaTile: EraIdeaSlotItem | null = null;
let eraIdeaArrowTrail: ArrowTrailHandle | null = null;
// Hold-to-commit handle, set when a tile is dropped into the bind slot. Resolves
// to "complete" after 2.5s (auto-commit) or "cancel" if the player releases the tile
// back to the workspace via the Release button. See spec §2.4, §3.3.
let bindHoldHandle: HoldArcHandle | null = null;
// Cello sustain that runs alongside the hold-arc (§7 master clock).
let bindHoldCello: CelloSustainHandle | null = null;
const eraNameForAnalytics = () => selectFiveMode ? "select-five" : eraManager.current.name;

// --- DOM setup ---
const modelOptions = MODELS.map(
  (m) => `<option value="${m.id}">${m.label}</option>`
).join("");

// Bibliophile strip: every chapter renders as a leather-bound cube. State per cube:
//   locked   — chapter not yet reached (dim leather, muted Roman numeral)
//   active   — current chapter, goals incomplete (gilt italic Roman, bright)
//   awaiting — current chapter, all goals met, awaiting bind (dashed inner border)
//   bound    — completed chapter, shows kept-tile face + binding stripe color
// See spec §4 "Strip behavior".
function renderEraProgress() {
  const el = document.getElementById("era-progress");
  if (!el) return;
  if (victoryShown) { el.innerHTML = ""; return; }

  const totalEras = eraManager.totalEras;
  const currentIdx = eraManager.history.length; // index into allEras of the active chapter

  const aiGoal = eraManager.current.goals.find((g) => g.minTier === undefined);
  const aiMet = aiGoal ? aiGoal.conditions.filter((c) => c.met).length >= aiGoal.requiredCount : true;
  const tierGoal = eraManager.current.goals.find((g) => g.minTier !== undefined);
  const tierMet = tierGoal?.conditions[0]?.met ?? true;
  const awaitingBinding = aiMet && tierMet;

  let html = "";

  for (let i = 0; i < totalEras; i++) {
    const era = eraManager.getEraByIndex(i);
    const roman = ROMAN_NUMERALS[i + 1] ?? String(i + 1);

    if (i < currentIdx) {
      // BOUND state — completed chapter
      const h = eraManager.history[i];
      const pick = h?.ideaTilePick;
      const stripe = pick ? chapterStripeColor(h.eraName, pick.name, runId) : getTheme().tokens.borderStrong;
      const ideaTile = pick
        ? `<div class="era-cube-idea" data-era-idea-idx="${i}" title="${esc(h.eraName)} — kept ${esc(pick.name)} (drag to spawn)">${esc(pick.emoji || "❓")}</div>`
        : "";
      html += `<div class="era-cube era-cube--bound" style="--stripe: ${stripe}" title="${esc(h.eraName)}">`
        + `<span class="era-cube-roman">${roman}</span>`
        + ideaTile
        + `</div>`;
    } else if (i === currentIdx) {
      const stateClass = awaitingBinding ? "era-cube--awaiting" : "era-cube--active";
      html += `<div class="era-cube ${stateClass}" title="${esc(era.name)}">`
        + `<span class="era-cube-roman">${roman}</span>`
        + `</div>`;
    } else {
      html += `<div class="era-cube era-cube--locked" title="${esc(era.name)}">`
        + `<span class="era-cube-roman">${roman}</span>`
        + `</div>`;
    }
  }

  el.innerHTML = html;
  // Scroll-anchor: keep the active cube visible (mid-strip preferred so the player sees a
  // chunk of past + future on either side rather than always anchoring the active to the right).
  const activeOffset = currentIdx * 60; // approximate; cube width ~56 + gap
  el.scrollLeft = Math.max(0, activeOffset - el.clientWidth / 2);
  wireEraCubeIdeaTiles();
}

// --- Shared drag-from-source-tile-to-workspace helper ---
//
// Used by:
//   - inventory bookplate cards (#palette-items > .palette-item) — Your Ideas tray
//   - bound-chapter-cube tiles (.era-cube-idea) — the strip
//
// Both surfaces sit inside horizontal scroll containers, so the touch behavior
// must distinguish "I'm scrolling the parent" from "I'm dragging this tile out".
//
// Decision model — asymmetric per-axis thresholds, mutually exclusive,
// mode-locking once committed:
//   Drag fires when vertical motion crosses VERTICAL_DRAG_THRESHOLD_PX (10px)
//     AND the gesture is inside the 50° wedge around vertical.
//   Scroll fires when horizontal motion crosses HORIZONTAL_SCROLL_THRESHOLD_PX
//     (16px) AND the gesture is inside the 40° wedge around horizontal.
//   The two wedges partition the plane (50° + 40° = 90° per quadrant), so
//   only one branch can fire. Whichever crosses its threshold first wins.
//   Once committed, the arming listener is detached and the gesture is
//   locked — no late motion in the other direction can switch modes.
//   - Mouse: drag begins immediately on pointerdown (no scroll race).
const VERTICAL_DRAG_THRESHOLD_PX = 10;
const HORIZONTAL_SCROLL_THRESHOLD_PX = 16;
// tan(40°) ≈ 0.839. ady > adx · this ⟺ motion is in the vertical 50°
// wedge ⟺ classify as drag (the complementary check classifies as scroll —
// motion within 40° of horizontal). Wider scroll wedge so a finger arcing
// down naturally as it moves sideways still routes to scroll.
const VERTICAL_WEDGE_TAN = Math.tan((40 * Math.PI) / 180);

// JS-owned horizontal scroll. The browser's native pan would race the
// arming logic and let scroll commit before drag classification finishes
// (see Apple HIG / WWDC 2014 #235: you cannot reliably win a gesture
// arena from movement direction alone). With `touch-action: none` on
// draggable items, the browser never starts a pan, and the scroll branch
// of attachDragToSpawn drives scrollLeft itself.
function findHorizontalScroller(el: HTMLElement): HTMLElement | null {
  let cur: HTMLElement | null = el.parentElement;
  while (cur) {
    const ox = getComputedStyle(cur).overflowX;
    if ((ox === "auto" || ox === "scroll") && cur.scrollWidth > cur.clientWidth) return cur;
    cur = cur.parentElement;
  }
  return null;
}

// While a JS scroll is active, the existing touchmove rubber-band handler
// on #palette-items would double-fire alongside beginJsScroll's own
// boundary handling. Gate it on this flag.
let jsScrollActivePointerId: number | null = null;

function beginJsScroll(scroller: HTMLElement, e: PointerEvent) {
  const startX = e.clientX;
  const startScrollLeft = scroller.scrollLeft;
  const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  let lastX = startX;
  let lastT = e.timeStamp;
  let velocity = 0; // px / ms, signed; positive = finger moving right

  // Three CSS properties on #palette-items fight per-frame JS scrollLeft
  // updates and have to be suspended for the gesture. Era cubes have none
  // of them, which is why the strip felt right and the inventory didn't.
  //   scroll-snap-type: x proximity — re-snaps to nearest tile on each update
  //   scroll-behavior: smooth — animates every scrollLeft assignment over
  //     ~250ms; with pointermove firing at 60Hz, each new target arrives
  //     mid-animation and the scroll barely advances ("doesn't move at all")
  //   -webkit-overflow-scrolling: touch — iOS hardware-scrolled layer that
  //     can ignore or lag behind JS scrollLeft updates
  const prevSnap = scroller.style.scrollSnapType;
  const prevBehavior = scroller.style.scrollBehavior;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prevWebkitScroll = (scroller.style as any).webkitOverflowScrolling;
  scroller.style.scrollSnapType = "none";
  scroller.style.scrollBehavior = "auto";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (scroller.style as any).webkitOverflowScrolling = "auto";

  const restore = () => {
    scroller.style.scrollSnapType = prevSnap;
    scroller.style.scrollBehavior = prevBehavior;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (scroller.style as any).webkitOverflowScrolling = prevWebkitScroll;
  };

  jsScrollActivePointerId = e.pointerId;
  try { scroller.setPointerCapture(e.pointerId); } catch {}

  const onMove = (m: PointerEvent) => {
    const dt = Math.max(1, m.timeStamp - lastT);
    const dxStep = m.clientX - lastX;
    velocity = velocity * 0.7 + (dxStep / dt) * 0.3;
    lastX = m.clientX;
    lastT = m.timeStamp;

    const target = startScrollLeft - (m.clientX - startX);
    const clamped = Math.max(0, Math.min(maxScroll, target));
    scroller.scrollLeft = clamped;

    // Past-boundary motion → rubber-band (inventory only). dxStep sign
    // already encodes pull direction: at left boundary, finger-right →
    // dxStep > 0 → positive overscroll; at right boundary, finger-left →
    // dxStep < 0 → negative overscroll.
    if (scroller === paletteItems && target !== clamped) {
      applyOverscroll(dxStep);
    }
    m.preventDefault();
  };

  const onEnd = (m: PointerEvent) => {
    scroller.removeEventListener("pointermove", onMove);
    scroller.removeEventListener("pointerup", onEnd);
    scroller.removeEventListener("pointercancel", onEnd);
    try { scroller.releasePointerCapture(m.pointerId); } catch {}
    jsScrollActivePointerId = null;
    if (scroller === paletteItems) scheduleOverscrollSnap(0);
    if (Math.abs(velocity) > 0.05) {
      // Restore the original styles only after coast settles; restoring
      // mid-coast would either re-snap to the nearest tile or smooth-
      // animate the per-frame updates and stall the inertia.
      coastScroll(scroller, velocity, restore);
    } else {
      restore();
    }
  };

  scroller.addEventListener("pointermove", onMove, { passive: false });
  scroller.addEventListener("pointerup", onEnd);
  scroller.addEventListener("pointercancel", onEnd);
}

function coastScroll(
  scroller: HTMLElement,
  initialVelocityPxPerMs: number,
  onSettle?: () => void,
) {
  const decay = 0.95; // per ~16ms frame
  let v = initialVelocityPxPerMs * 16; // px per frame
  const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  const step = () => {
    v *= decay;
    if (Math.abs(v) < 0.5) {
      onSettle?.();
      return;
    }
    scroller.scrollLeft = Math.max(0, Math.min(maxScroll, scroller.scrollLeft - v));
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

interface DragSpawnHookOptions {
  /** Pixels to offset the spawned tile's top-left from the pointer (default 36). */
  offsetX?: number;
  offsetY?: number;
  /** Fires when the drag actually begins (after threshold for touch, immediately
   *  for mouse). Use to record analytics, increment per-tile spawn counters, etc. */
  onBegin?: (data: ElementData) => void;
}

function attachDragToSpawn(
  targetEl: HTMLElement,
  getData: () => ElementData | null,
  opts: DragSpawnHookOptions = {},
): void {
  const offsetX = opts.offsetX ?? 36;
  const offsetY = opts.offsetY ?? 36;

  targetEl.addEventListener("pointerdown", (e) => {
    if (busy) return;
    // Multi-touch lock: if a tile is already in flight or a JS scroll is
    // capturing a pointer, ignore additional pointerdowns from draggable
    // surfaces. Without this, a second finger could overwrite dragItem
    // (orphaning the first tile) or fire its pointermoves into the
    // document-level handler while the first finger is scrolling.
    if (dragItem || jsScrollActivePointerId !== null) return;
    const data = getData();
    if (!data) return;

    const beginDrag = (clientX: number, clientY: number) => {
      // If a workspace-tile long-press popped the bookplate, close it as
      // soon as any drag begins (matches the workspace tile's own behavior).
      closeTileInfo();
      const wsRect = workspace.getBoundingClientRect();
      const item = spawnItem(
        data,
        clientX - wsRect.left - offsetX,
        clientY - wsRect.top - offsetY,
      );
      dragItem = item;
      dragSourceSlotIndex = null;
      dragOffsetX = offsetX;
      dragOffsetY = offsetY;
      item.el.style.position = "fixed";
      item.el.style.left = `${clientX - offsetX}px`;
      item.el.style.top = `${clientY - offsetY}px`;
      item.el.style.zIndex = "100";
      // Lock the gesture to the spawned tile. Without this, the browser
      // can reclaim the pointer for a horizontal scroll partway through a
      // diagonal pull, fire pointercancel, and leave the tile dropped at
      // its last position. Capture also routes pointerup through item.el,
      // which still bubbles to the document-level handlePointerUp.
      try { item.el.setPointerCapture(e.pointerId); } catch {}
      // Set the dragging flag at the actual drag-begin moment (not on the
      // first handlePointerMove tick) so the inventory + strip scroll lock
      // applies before any subsequent motion can scroll them.
      document.body.setAttribute("data-dragging", "true");
      opts.onBegin?.(data);
    };

    if (e.pointerType === "mouse") {
      e.preventDefault();
      e.stopPropagation();
      beginDrag(e.clientX, e.clientY);
      return;
    }

    const startX = e.clientX;
    const startY = e.clientY;
    let armed = true;
    const onMove = (moveEvent: PointerEvent) => {
      if (!armed) return;
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      const inVerticalWedge = ady > adx * VERTICAL_WEDGE_TAN;
      // Drag — gesture inside the 50° vertical wedge AND vertical motion
      // has crossed 10px.
      if (inVerticalWedge && ady >= VERTICAL_DRAG_THRESHOLD_PX) {
        armed = false;
        cleanup();
        moveEvent.preventDefault();
        beginDrag(moveEvent.clientX, moveEvent.clientY);
        return;
      }
      // Scroll — gesture inside the 40° horizontal wedge AND horizontal
      // motion has crossed 16px.
      if (!inVerticalWedge && adx >= HORIZONTAL_SCROLL_THRESHOLD_PX) {
        armed = false;
        cleanup();
        // Take ownership of horizontal scroll. Draggable items have
        // touch-action: none, so the browser doesn't pan natively — we
        // drive scrollLeft on the nearest scrollable ancestor for the
        // rest of the gesture. armed = false ensures we can't switch
        // back to drag mid-gesture.
        const scroller = findHorizontalScroller(targetEl);
        if (scroller) beginJsScroll(scroller, moveEvent);
        return;
      }
      // Otherwise: gesture hasn't committed yet — keep waiting.
    };
    const onCancel = () => {
      armed = false;
      cleanup();
    };
    const cleanup = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onCancel);
      document.removeEventListener("pointercancel", onCancel);
    };
    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onCancel);
    document.addEventListener("pointercancel", onCancel);
  });
}

// Touch-only long-press → opens the bookplate narrative card (Phase 8 / spec §6).
// Mouse users get the same content via the hover .tooltip on each palette-item.
function attachLongPress(
  el: HTMLElement,
  getData: () => ElementData | null,
  durationMs = 600,
  moveThresholdPx = 8,
): void {
  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    if (busy) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let timer: number | null = window.setTimeout(() => {
      const data = getData();
      if (data) {
        openTileInfo(data);
        // Cancel the sibling drag-arming so a subsequent finger-lift doesn't spawn.
        document.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true }));
      }
      cleanup();
    }, durationMs);
    const onMove = (m: PointerEvent) => {
      const dx = Math.abs(m.clientX - startX);
      const dy = Math.abs(m.clientY - startY);
      if (dx > moveThresholdPx || dy > moveThresholdPx) cleanup();
    };
    const onUp = () => cleanup();
    const cleanup = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  });
}

// Make each idea tile attached to a completed era cube draggable: spawning a workspace copy
// without depleting the cube tile (inventory-style, like the select-five carry-over slots).
function wireEraCubeIdeaTiles() {
  document.querySelectorAll<HTMLElement>(".era-cube-idea[data-era-idea-idx]").forEach((el) => {
    const idx = Number(el.dataset.eraIdeaIdx);
    attachDragToSpawn(el, () => {
      const h = eraManager.history[idx];
      const pick = h?.ideaTilePick;
      if (!pick) return null;
      return {
        name: pick.name,
        tier: pick.tier,
        emoji: pick.emoji || "❓",
        color: pick.color || getTheme().tokens.borderFaint,
        description: pick.description ?? "",
        narrative: pick.narrative ?? "",
      };
    });
  });
}

function renderGoals() {
  const goalsEl = document.getElementById("era-goals")!;
  const goals = eraManager.current.goals;
  const aiGoal = goals.find((g) => g.minTier === undefined);
  const tierGoal = goals.find((g) => g.minTier !== undefined);
  if (!aiGoal && !tierGoal) { goalsEl.innerHTML = ""; return; }
  const metCount = aiGoal ? aiGoal.conditions.filter((c) => c.met).length : 0;
  const counterEl = document.getElementById("era-goal-counter");
  if (counterEl) counterEl.textContent = aiGoal ? `(${metCount}/${aiGoal.requiredCount})` : "";
  const aiRequiredMet = aiGoal ? metCount >= aiGoal.requiredCount : false;
  // The tier-floor goal is rendered as a badge in the chapter title bar (see renderEraName).
  // The objectives card surfaces narrative-milestone (AI-judged) conditions only.
  goalsEl.innerHTML = `
    ${aiGoal ? `<div class="era-goal-header">${aiRequiredMet ? `✔ ` : ``}Complete ${aiGoal.requiredCount} of ${aiGoal.conditions.length} tasks${aiRequiredMet ? `` : ` (${metCount} done)`}</div>
    ${aiGoal.conditions
      .map((c) => {
        const classes = c.met ? " met" : (aiRequiredMet ? " skipped" : "");
        return `
        <div class="era-goal${classes}"${c.met && c.narrative ? ` data-narrative="${c.narrative.replace(/"/g, '&quot;')}"` : ""}>
          ${c.description}
          ${c.met && c.narrative ? `<span class="era-goal-info">ⓘ</span>` : ""}
        </div>
      `;
      })
      .join("")}` : ""}
  `;
  renderEraName();  // refresh tier-floor badge if the tier goal flipped
  renderEraProgress();
}

// Roman numerals for chapters I–XX (we have 11 chapters; XX is generous overhead).
const ROMAN_NUMERALS = [
  "", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
];

function renderEraName() {
  const era = eraManager.current;
  const chapterNum = era.order + 1;
  const roman = ROMAN_NUMERALS[chapterNum] ?? String(chapterNum);

  const eraNameEl = document.getElementById("era-name")!;
  eraNameEl.textContent = era.name;

  const romanEl = document.getElementById("era-roman");
  if (romanEl) romanEl.textContent = victoryShown ? "" : `Chapter ${roman}`;

  // Italic chapter-theme tag from the active theme manifest (e.g. "Craft · Survival")
  const tagEl = document.getElementById("era-theme-tag");
  if (tagEl) tagEl.textContent = victoryShown ? "" : chapterTag(era.name);

  // Tier-floor badge — surfaces the deterministic minTier goal as a subtle marker.
  // Spec §3.2 "Goal model": tier-floor lives in the title bar; AI conditions live in the
  // objectives card.
  const tierBadgeEl = document.getElementById("era-tier-badge");
  if (tierBadgeEl) {
    const tierGoal = era.goals.find((g) => g.minTier !== undefined);
    if (!victoryShown && tierGoal && tierGoal.minTier) {
      const stars = "★".repeat(tierGoal.minTier);
      tierBadgeEl.textContent = `requires ${stars}`;
      tierBadgeEl.classList.toggle("met", tierGoal.conditions[0]?.met === true);
      tierBadgeEl.hidden = false;
    } else {
      tierBadgeEl.hidden = true;
      tierBadgeEl.textContent = "";
    }
  }
}

const SAVE_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

async function saveImage(dataUrl: string, filename: string) {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
  } catch { /* fall through to anchor download */ }
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

const DISCORD_INVITE = "https://discord.gg/jMdRx9ZjyC";
const DISCORD_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.101 18.079.105 18.1.111 18.12a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`;

app.innerHTML = `
  <div id="palette">
    <div id="era-display">
      <div id="era-name-row">
        <div id="era-name-stack">
          <span id="era-roman"></span>
          <span id="era-name"></span>
          <span id="era-theme-tag"></span>
        </div>
        <div id="era-name-right">
          <span id="era-tier-badge"></span>
          <span id="era-goal-counter"></span>
          <button id="era-name-toggle" aria-expanded="true">
            <span id="era-toggle-icon">\u25BE</span>
          </button>
        </div>
      </div>
      <div id="era-goals"></div>
      <div id="era-idea-slot-wrapper" hidden>
        <div class="era-idea-prompt">${getTheme().copy.slotPrompts.saveTilePrompt}</div>
        <div id="era-idea-slot" class="era-idea-slot"></div>
      </div>
      <button id="chart-era-btn" disabled>Next Age →</button>
    </div>
    <div id="inventory-header">
      <span id="inventory-caption">${getTheme().copy.inventoryCaption}</span>
      <button id="card-catalog-btn">${getTheme().copy.cardCatalogButton}</button>
      <div id="palette-zoom-controls">
        <span id="palette-zoom-icon">\uD83D\uDD0D</span>
        <button id="palette-zoom-out">&#8722;</button>
        <button id="palette-zoom-in">&#43;</button>
      </div>
    </div>
    <div id="idea-tray-row">
      <button id="tray-prev" class="tray-paginate" aria-label="Previous page" type="button">&#8249;</button>
      <div id="palette-items"></div>
      <button id="tray-next" class="tray-paginate" aria-label="Next page" type="button">&#8250;</button>
    </div>
    <div id="bari"><span id="bari-char">👦</span><span id="bari-tool">🔨</span></div>
    <button id="menu-btn" type="button" aria-haspopup="menu" aria-expanded="false">Menu</button>
    <div id="menu-overlay" hidden>
      <div id="menu-panel" role="menu" aria-label="Main menu">
        <button class="menu-item" role="menuitem" data-menu="scoreboard">Scoreboard</button>
        <button class="menu-item" role="menuitem" data-menu="how-to-play">How to Play</button>
        <button class="menu-item" role="menuitem" data-menu="account" id="menu-item-account">Sign in</button>
        <hr class="menu-divider" aria-hidden="true">
        <button class="menu-item menu-item--destructive" role="menuitem" data-menu="restart">Restart game</button>
        <button class="menu-item menu-item--debug" role="menuitem" data-menu="debug" id="menu-item-debug" hidden>Debug console</button>
      </div>
    </div>
    <button id="restart-btn" hidden>Restart Game</button>
  </div>
  <div id="demo-reset-overlay">
    <div id="demo-reset-modal">
      <h3>Reset Player?</h3>
      <p>This will erase all game progress and sign you out if you're logged in.</p>
      <div class="demo-reset-actions">
        <button id="demo-reset-cancel-btn">Cancel</button>
        <button id="demo-reset-confirm-btn">Reset</button>
      </div>
    </div>
  </div>
  <div id="workspace">
    <p id="workspace-caption">${getTheme().copy.workspaceCaption}</p>
    <p id="workspace-hint">${getTheme().copy.writingDeskHint}</p>
    <div id="era-progress"></div>
  </div>
  <div id="card-catalog-overlay">
    <div id="card-catalog-modal">
      <div id="card-catalog-header">
        <span id="card-catalog-title">Catalog</span>
        <button id="card-catalog-close">&times;</button>
      </div>
      <div id="card-catalog-body">
        <p class="card-catalog-empty">Your full catalog will appear here. Phase 4 wires the grid + search.</p>
      </div>
    </div>
  </div>
  <div id="retirement-overlay">
    <div id="retirement-modal">
      <div id="retirement-bound-tile-frame">
        <div id="retirement-bound-tile"></div>
      </div>
      <h2 id="retirement-title">twenty-four spaces. one must yield.</h2>
      <p id="retirement-prompt">press and hold a tile to give it back to the world</p>
      <div id="retirement-library-grid"></div>
    </div>
  </div>
  <button id="settings-btn" type="button" aria-label="Settings" title="Settings">⚙</button>
  <div id="settings-overlay">
    <div id="settings-modal">
      <header id="settings-header">
        <h2 id="settings-title">Settings</h2>
        <button id="settings-close" type="button" aria-label="Close">&times;</button>
      </header>
      <ul id="settings-list">
        <li class="settings-row">
          <div>
            <span class="settings-label">Reduced motion</span>
            <span class="settings-hint">Replaces ink-bloom and brush-wipe with short fades.</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settings-reduced-motion" />
            <span class="settings-toggle-slider"></span>
          </label>
        </li>
        <li class="settings-row">
          <div>
            <span class="settings-label">Tap to commit</span>
            <span class="settings-hint">Bind by tap-tap instead of holding for 2.5s.</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settings-tap-to-commit" />
            <span class="settings-toggle-slider"></span>
          </label>
        </li>
        <li class="settings-row">
          <div>
            <span class="settings-label">High contrast</span>
            <span class="settings-hint">Swaps vellum and ink, thicker borders, no marble texture.</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settings-high-contrast" />
            <span class="settings-toggle-slider"></span>
          </label>
        </li>
        <li class="settings-row">
          <div>
            <span class="settings-label">Workshop room tone</span>
            <span class="settings-hint">Quiet ambient loop under the play screen.</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settings-room-tone" />
            <span class="settings-toggle-slider"></span>
          </label>
        </li>
        <li class="settings-section-header" aria-hidden="true">Appearance</li>
        <li class="settings-row settings-row--theme">
          <div>
            <span class="settings-label">Theme</span>
            <span class="settings-hint">Re-skins the chrome instantly. Library tiles re-color too.</span>
          </div>
          <fieldset class="settings-theme-picker" aria-label="Theme">
            <label class="settings-theme-option">
              <input type="radio" name="settings-theme" value="bibliophile" />
              <span class="settings-theme-label">Bibliophile</span>
              <span class="settings-theme-sub">leather + gilt</span>
            </label>
            <label class="settings-theme-option">
              <input type="radio" name="settings-theme" value="curator" />
              <span class="settings-theme-label">Curator</span>
              <span class="settings-theme-sub">archival + restraint</span>
            </label>
            <label class="settings-theme-option">
              <input type="radio" name="settings-theme" value="cartographer" />
              <span class="settings-theme-label">Cartographer</span>
              <span class="settings-theme-sub">vellum + sepia</span>
            </label>
          </fieldset>
        </li>
      </ul>
    </div>
  </div>
  <div id="tile-info-overlay" hidden>
    <div id="tile-info-sheet" class="bookplate-sheet" role="dialog" aria-modal="true" aria-label="Tile details"></div>
  </div>
  <div id="heatmap-overlay">
    <div id="heatmap-modal">
      <div id="heatmap-header">
        <span id="heatmap-title">Tile Density Map</span>
        <button id="heatmap-close">&times;</button>
      </div>
      <div id="heatmap-filter-bar">
        <button id="heatmap-filter-all">None</button>
        <div id="heatmap-filters"></div>
      </div>
      <canvas id="heatmap-canvas"></canvas>
    </div>
  </div>
  <div id="goal-tooltip"></div>
  <div id="result-toast"></div>
  <div id="thanks-toast">
    <div id="thanks-toast-body">
      <div id="thanks-toast-title">Thanks for playing!</div>
      <a id="thanks-toast-discord" href="${DISCORD_INVITE}" target="_blank" rel="noopener noreferrer">Join our Discord to keep updated!</a>
      <div id="thanks-toast-feedback">Send us feedback at <a href="mailto:info@alwayshungrygames.com">info@alwayshungrygames.com</a></div>
    </div>
    <button id="thanks-toast-close">&times;</button>
  </div>
  <div id="era-toast">
    <h3 id="era-toast-title"></h3>
    <div id="era-toast-stats"></div>
    <p id="era-toast-text"></p>
    <button id="era-toast-btn">Continue</button>
  </div>
  <div id="scoreboard-overlay">
    <div id="scoreboard-panel">
      <div class="scoreboard-header">
        <h2>Civilization Progress</h2>
        <p class="scoreboard-subtitle"></p>
        <button id="scoreboard-tapestries-btn">Your Tapestries</button>
      </div>
      <button id="scoreboard-close-btn">\u2715</button>
      <div id="scoreboard-timeline"></div>
    </div>
  </div>
  <button id="scoreboard-btn" title="View Scoreboard">\uD83D\uDCDC</button>
  <div id="era-summary-overlay">
    <div id="era-summary-panel">
      <div class="era-summary-next">
        <div class="era-summary-next-label">\u2191 Next Era</div>
        <h3 id="era-summary-next-name"></h3>
        <p class="era-summary-next-text" id="era-summary-next-text"></p>
      </div>
      <div class="era-summary-completed">
        <div class="era-summary-completed-label">\u2714 Era Complete</div>
        <div class="era-summary-header">
          <h2 id="era-summary-era-name"></h2>
        </div>
        <div id="era-summary-frontispiece-frame">
          <div id="era-summary-frontispiece-spinner">Painting the frontispiece\u2026</div>
          <img id="era-summary-frontispiece" alt="" hidden />
        </div>
        <div id="era-summary-stat-cards"></div>
        <div id="era-summary-tile-detail"></div>
        <p class="era-summary-narrative" id="era-summary-narrative"></p>
        <div class="era-summary-discovered" id="era-summary-discovered"></div>
      </div>
      <button id="era-summary-continue-btn"></button>
    </div>
  </div>
  <div id="victory-overlay">
    <div id="victory-panel">
      <h2>The Age of Plenty</h2>
      <h3 class="victory-subtitle">Your civilization has transcended the ages</h3>
      <p id="victory-narrative"></p>
      <div id="victory-timeline"></div>
      <div class="victory-actions">
        <a id="victory-library-link" href="/library">Open the library →</a>
        <button id="victory-share-btn" aria-label="Save victory screen"></button>
        <a id="victory-discord-btn" href="${DISCORD_INVITE}" target="_blank" rel="noopener noreferrer">${DISCORD_SVG} Join our Discord</a>
        <button id="victory-continue-btn">Continue</button>
      </div>
    </div>
  </div>
  <div id="tapestry-overlay">
    <div id="tapestry-modal">
      <button id="tapestry-close">&times;</button>
      <div id="tapestry-content">
        <div id="tapestry-spinner">Weaving the tapestry\u2026</div>
      </div>
      <div id="tapestry-actions">
        <button id="tapestry-heart-btn" aria-label="Love this tapestry">\u2665</button>
        <button id="tapestry-share-btn" aria-label="Save tapestry"></button>
      </div>
    </div>
  </div>
`;

const paletteItems = document.getElementById("palette-items")!;
const workspace = document.getElementById("workspace")!;
const chartEraBtn = document.getElementById("chart-era-btn")!;
const toast = document.getElementById("result-toast")!;
const bari = document.getElementById("bari")!;
const eraToast = document.getElementById("era-toast")!;
const eraToastTitle = document.getElementById("era-toast-title")!;
const eraToastText = document.getElementById("era-toast-text")!;
const eraToastBtn = document.getElementById("era-toast-btn")!;

const victoryOverlay = document.getElementById("victory-overlay")!;
const victoryPanel = document.getElementById("victory-panel")!;
const victoryTimeline = document.getElementById("victory-timeline")!;
const victoryShareBtn = document.getElementById("victory-share-btn")!;
victoryShareBtn.innerHTML = SAVE_SVG;
document.getElementById("tapestry-share-btn")!.innerHTML = SAVE_SVG;
const restartButton = document.getElementById("restart-btn")!;
let modelSelect: HTMLSelectElement | null = null;
const demoResetOverlay = document.getElementById("demo-reset-overlay")!;
const demoResetConfirmBtn = document.getElementById("demo-reset-confirm-btn")!;
const demoResetCancelBtn = document.getElementById("demo-reset-cancel-btn")!;
const scoreboardOverlay = document.getElementById("scoreboard-overlay")!;
const scoreboardTimeline = document.getElementById("scoreboard-timeline")!;
const eraSummaryOverlay = document.getElementById("era-summary-overlay")!;
const scoreboardBtn = document.getElementById("scoreboard-btn")!;
const scoreboardCloseBtn = document.getElementById("scoreboard-close-btn")!;
const tapestryOverlay = document.getElementById("tapestry-overlay")!;
const tapestryContent = document.getElementById("tapestry-content")!;
const tapestryClose = document.getElementById("tapestry-close")!;
const tapestryActions = document.getElementById("tapestry-actions")!;
const heatmapOverlay = document.getElementById("heatmap-overlay")!;
const heatmapCanvas = document.getElementById("heatmap-canvas") as HTMLCanvasElement;
const heatmapClose = document.getElementById("heatmap-close")!;

const handleModelChange = (id: string) => {
  selectedModel = id as ModelId;
  log.info("system", `Model switched to ${selectedModel}`);
  posthog.capture('model_changed', { model: selectedModel });
};

const handleEraToastClose = () => {
  eraToast.classList.remove("visible");
};

// --- Tapestry ---
let tapestryPromise: Promise<{ base64: string; mimeType: string; tapestryId?: string | null; sharePath?: string | null; ssoExpired?: boolean } | null> | null = null;
let tapestrySharePath: string | null = null;
let runId: string = crypto.randomUUID();

// --- Era advancement pipeline ---
type EraSnapshot = {
  fromEra: string;
  completedAt: number;
  actions: ActionLogEntry[];
  inventory: string[];
  tapestryGameData: ReturnType<typeof buildTapestryGameData>;
  eraStartedAt: number;
  spawnCounts: Record<string, number>;
  spawnByTier: Record<number, number>;
};
let latestEraSnapshot: EraSnapshot | null = null;
let latestEraChoice: { era: Era; narrative: string } | null = null;
let latestTapestryPromise: Promise<{ base64: string; mimeType: string; tapestryId?: string | null; sharePath?: string | null; ssoExpired?: boolean } | null> | null = null;
let eraAdvancementDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// --- Pipeline debug HUD (non-prod only) ---
type PipelineRun = {
  id: number;
  snapshotAt: number;
  eraStatus: 'pending' | 'done' | 'error';
  eraName?: string;
  tapestryStatus: 'waiting' | 'inflight' | 'done' | 'error';
};
const pipelineRuns: PipelineRun[] = [];
let pipelineRunSeq = 0;
let pipelineHudEl: HTMLElement | null = null;
let pipelineDebounceIndicator = false;

function initPipelineHud() {
  if (!isLocalBuild) return;
  const el = document.createElement("div");
  el.id = "pipeline-hud";
  document.body.appendChild(el);
  pipelineHudEl = el;
  updatePipelineHud();
}

function updatePipelineHud() {
  if (!pipelineHudEl) return;
  if (!eraAdvancing && pipelineRuns.length === 0) {
    pipelineHudEl.style.display = "none";
    return;
  }
  pipelineHudEl.style.display = "block";

  const debounceRow = pipelineDebounceIndicator
    ? `<div class="ph-debounce">⏱ debouncing…</div>`
    : "";

  const rows = pipelineRuns.map(r => {
    const eraCell = r.eraStatus === 'pending'
      ? `<span class="ph-pending">era ⟳</span>`
      : r.eraStatus === 'done'
      ? `<span class="ph-done">era ✓ <em>${r.eraName ?? ""}</em></span>`
      : `<span class="ph-error">era ✗</span>`;

    const tapCell = r.tapestryStatus === 'waiting'
      ? `<span class="ph-waiting">tap —</span>`
      : r.tapestryStatus === 'inflight'
      ? `<span class="ph-inflight">tap ⟳</span>`
      : r.tapestryStatus === 'done'
      ? `<span class="ph-done">tap ✓</span>`
      : `<span class="ph-error">tap ✗</span>`;

    return `<div class="ph-row">#${r.id} ${eraCell} ${tapCell}</div>`;
  }).join("");

  pipelineHudEl.innerHTML = `<div class="ph-title">era pipeline</div>${debounceRow}${rows}`;
}

function clearPipelineHud() {
  pipelineRuns.length = 0;
  pipelineDebounceIndicator = false;
  updatePipelineHud();
}

function startTapestryGeneration(
  narrative: string,
  eraName: string,
  nextEraName: string,
  gameData: TapestryGameData
) {
  tapestryPromise = fetch("/api/generate-tapestry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      narrative,
      eraName,
      nextEraName,
      anonId: getOrCreateAnonId(),
      runId,
      gameData,
    }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
}

async function showTapestry() {
  tapestryOverlay.classList.remove("tapestry-closeable");
  tapestryContent.innerHTML = `<div id="tapestry-spinner">Weaving the tapestry\u2026</div>`;
  tapestryActions.style.display = "none";
  tapestryOverlay.classList.add("visible");

  // After 60s with no result, enable close and warn
  const timeoutId = setTimeout(() => {
    tapestryOverlay.classList.add("tapestry-closeable");
    const spinner = document.getElementById("tapestry-spinner");
    if (spinner) spinner.textContent = "Weaving taking longer than expected\u2026";
  }, 60_000);

  // Show tapestry after result arrives AND at least 2s have passed
  const [result] = await Promise.all([
    tapestryPromise,
    new Promise<void>((resolve) => setTimeout(resolve, 2_000)),
  ]);

  clearTimeout(timeoutId);
  tapestryPromise = null;
  tapestryOverlay.classList.add("tapestry-closeable");

  if (!result?.base64) {
    tapestrySharePath = null;
    tapestryOverlay.classList.remove("visible");
    return;
  }

  tapestrySharePath = result.sharePath ?? null;
  if (result.ssoExpired) {
    showEraToast("⚠️ Auth Expired", "AWS SSO token has expired. Run this in your terminal:\n\naws sso login --sso-session sxxx-sso\n\nTapestry was generated but not saved.");
  }
  tapestryContent.innerHTML = `<img id="tapestry-img" src="data:${result.mimeType};base64,${result.base64}" alt="Era tapestry">`;
  tapestryActions.style.display = "flex";
}

function closeTapestry() {
  tapestryOverlay.classList.remove("visible", "tapestry-closeable");
  tapestryContent.innerHTML = "";
  tapestryActions.style.display = "none";
}

function buildTapestryGameData(input: {
  completedAt: number;
  discoveredItems: string[];
  completedEraActions: ActionLogEntry[];
}): TapestryGameData {
  const eraState = eraManager.exportState();

  return {
    selectedModel,
    totalCombinations: actionLog.length,
    eraCurrentIndex: eraState.currentIndex,
    eraHistory: [...eraState.history],
    eraActionLog: input.completedEraActions,
    discoveredItems: input.discoveredItems,
    eraStartedAt,
    eraCompletedAt: input.completedAt,
  };
}

// --- Heatmap ---
let heatmapFilter: Set<string> | null = null; // null = all tiles

function renderHeatmapCanvas() {
  // Use the canvas's actual CSS layout size so the buffer exactly matches the display —
  // this avoids the fractional-pixel bug where getBoundingClientRect() returns non-integer
  // workspace dimensions, causing buf[py * W + px] indexing to drift off the ImageData bounds.
  // clientWidth/clientHeight are always integers and reflect the post-flex-layout dimensions.
  const W = heatmapCanvas.clientWidth;
  const H = heatmapCanvas.clientHeight;

  if (W === 0 || H === 0) return;

  // Scale tile coordinates from workspace space into canvas space
  const wsRect = workspace.getBoundingClientRect();
  const wsW = wsRect.width || W;
  const wsH = wsRect.height || H;
  const scaleX = W / wsW;
  const scaleY = H / wsH;

  heatmapCanvas.width = W;
  heatmapCanvas.height = H;
  const ctx = heatmapCanvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);

  const visible = heatmapFilter
    ? items.filter((it) => heatmapFilter!.has(it.name))
    : items;

  document.getElementById("heatmap-title")!.textContent =
    `Tile Density Map — ${visible.length} tile${visible.length !== 1 ? "s" : ""}${heatmapFilter ? ` (filtered)` : ""}`;

  if (visible.length === 0) {
    ctx.fillStyle = "#8090b0";
    ctx.font = "16px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("No tiles on workspace — drag tiles from the palette first", W / 2, H / 2);
    return;
  }

  // Pass 1 — accumulate intensity into a Float32 buffer (no clipping)
  const radius = Math.max(60, Math.min(W, H) * 0.14);
  const buf = new Float32Array(W * H);

  for (const item of visible) {
    const cx = (item.x + 32) * scaleX;
    const cy = (item.y + 32) * scaleY;
    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(W - 1, Math.ceil(cx + radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const y1 = Math.min(H - 1, Math.ceil(cy + radius));
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const dx = px - cx, dy = py - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= radius) continue;
        // Gaussian-like falloff: 1 at center → 0 at radius
        const t = 1 - d / radius;
        buf[py * W + px] += t * t;
      }
    }
  }

  // Find max for normalization
  let maxVal = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] > maxVal) maxVal = buf[i];
  if (maxVal === 0) return;

  // Pass 2 — apply normalized color ramp: blue→cyan→green→yellow→red
  const outData = ctx.createImageData(W, H);
  const dst = outData.data;

  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0) continue;
    const intensity = buf[i] / maxVal; // 0..1 relative to densest point

    let r = 0, g = 0, b = 0;
    if (intensity < 0.25) {
      const t = intensity / 0.25;
      r = 0; g = Math.round(255 * t); b = 255;
    } else if (intensity < 0.5) {
      const t = (intensity - 0.25) / 0.25;
      r = 0; g = 255; b = Math.round(255 * (1 - t));
    } else if (intensity < 0.75) {
      const t = (intensity - 0.5) / 0.25;
      r = Math.round(255 * t); g = 255; b = 0;
    } else {
      const t = (intensity - 0.75) / 0.25;
      r = 255; g = Math.round(255 * (1 - t)); b = 0;
    }

    const p = i * 4;
    dst[p] = r;
    dst[p + 1] = g;
    dst[p + 2] = b;
    dst[p + 3] = Math.round(intensity * 200 + 30);
  }

  ctx.putImageData(outData, 0, 0);

  // Pass 3 — white dot at each tile center for reference
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  for (const item of visible) {
    ctx.beginPath();
    ctx.arc((item.x + 32) * scaleX, (item.y + 32) * scaleY, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function showHeatmap() {
  // Build filter UI from unique tile names currently on field
  const unique = [...new Map(items.map((it) => [it.name, it])).values()]
    .sort((a, b) => a.name.localeCompare(b.name));

  heatmapFilter = null; // reset to all on open

  const filterEl = document.getElementById("heatmap-filters")!;
  filterEl.innerHTML = unique.map((it) =>
    `<label class="heatmap-filter-label" title="${it.name}">
      <input type="checkbox" data-tile="${it.name}" checked>
      <span>${it.emoji}</span>
      <span class="heatmap-filter-name">${it.name}</span>
    </label>`
  ).join("");

  // "All" toggle
  const allBtn = document.getElementById("heatmap-filter-all")!;
  allBtn.textContent = "All";

  function syncFilter() {
    const checked = [...filterEl.querySelectorAll<HTMLInputElement>("input[data-tile]:checked")]
      .map((cb) => cb.dataset.tile!);
    const all = checked.length === unique.length;
    heatmapFilter = all ? null : new Set(checked);
    allBtn.textContent = all ? "None" : "All";
    renderHeatmapCanvas();
  }

  allBtn.onclick = () => {
    const allChecked = heatmapFilter === null;
    filterEl.querySelectorAll<HTMLInputElement>("input[data-tile]").forEach((cb) => {
      cb.checked = !allChecked;
    });
    syncFilter();
  };

  filterEl.addEventListener("change", syncFilter);

  // Show the modal first so the canvas has layout dimensions, then render
  heatmapOverlay.classList.add("visible");
  requestAnimationFrame(() => renderHeatmapCanvas());
}

function closeHeatmap() {
  heatmapOverlay.classList.remove("visible");
}

const handleRestart = () => {
  if (!confirm("Start a new game? All progress will be lost.")) return;
  posthog.capture('game_restarted', {
    current_era: eraManager.current.name,
    combinations_so_far: actionLog.length,
  });
  restarting = true;
  clearSave();
  // Replay onboarding on the next load — see OnboardingOverlay.tsx.
  try { localStorage.removeItem("idea-collector-onboarded"); } catch {}
  location.reload();
};

const handleDemoReset = () => demoResetOverlay.classList.add("visible");
const handleDemoResetConfirm = () => {
  restarting = true;
  posthog.reset();
  localStorage.removeItem('bari-anon-id');
  const resetPlayer = authStore.getState().resetPlayer;
  if (resetPlayer) {
    resetPlayer().catch(() => { restarting = true; clearSave(); location.reload(); });
  } else {
    clearSave();
    location.reload();
  }
};
const handleDemoResetCancel = () => demoResetOverlay.classList.remove("visible");

eraToastBtn.addEventListener("click", handleEraToastClose);
restartButton.addEventListener("click", handleRestart);

// Goal narrative tooltip (fixed-position, shared)
const goalTooltipEl = document.getElementById("goal-tooltip")!;
let pinnedGoalInfo: HTMLElement | null = null;

function positionGoalTooltip(info: HTMLElement) {
  const text = info.dataset.narrative;
  if (!text) return;
  const rect = info.getBoundingClientRect();
  goalTooltipEl.textContent = text;
  goalTooltipEl.classList.add("visible");
  const tipW = goalTooltipEl.offsetWidth;
  const tipH = goalTooltipEl.offsetHeight;
  const margin = 6;
  const centeredLeft = rect.left + rect.width / 2;
  const clampedLeft = Math.max(tipW / 2 + margin, Math.min(window.innerWidth - tipW / 2 - margin, centeredLeft));
  const fitsAbove = rect.top - tipH - margin > 0;
  const top = fitsAbove ? rect.top - margin : rect.bottom + margin + tipH;
  goalTooltipEl.style.left = `${clampedLeft}px`;
  goalTooltipEl.style.top = `${top}px`;
}

const eraGoalsForTooltip = document.getElementById("era-goals")!;
eraGoalsForTooltip.addEventListener("mouseover", (e) => {
  if (pinnedGoalInfo) return;
  const goal = (e.target as HTMLElement).closest(".era-goal[data-narrative]") as HTMLElement | null;
  if (goal) positionGoalTooltip(goal);
});
eraGoalsForTooltip.addEventListener("mouseout", (e) => {
  if (pinnedGoalInfo) return;
  const goal = (e.target as HTMLElement).closest(".era-goal[data-narrative]");
  if (goal) goalTooltipEl.classList.remove("visible");
});
eraGoalsForTooltip.addEventListener("click", (e) => {
  const goal = (e.target as HTMLElement).closest(".era-goal[data-narrative]") as HTMLElement | null;
  if (!goal) return;
  e.stopPropagation();
  if (pinnedGoalInfo === goal) {
    pinnedGoalInfo = null;
    goalTooltipEl.classList.remove("visible");
  } else {
    pinnedGoalInfo = goal;
    positionGoalTooltip(goal);
  }
});
document.addEventListener("click", () => {
  if (pinnedGoalInfo) {
    pinnedGoalInfo = null;
    goalTooltipEl.classList.remove("visible");
  }
});

// When a goal newly transitions met, spawn a per-goal narrative popup that
// floats above the goal row for 5s, then fades. Multiple popups stack
// (each anchored to its own row); cascade interval is 2.5s between starts
// so a burst of newly-met goals shows as a sequence rather than all at once.
// Click a popup to pin it (cancel the auto-fade); click again to dismiss.
// On fade, the goal's characters pulse left-to-right with extra pop on the
// trailing ⓘ to advertise that the goal can be clicked to re-read.
let goalFlashSpawnAt = 0;
const GOAL_FLASH_DISPLAY_MS = 5000;
const GOAL_FLASH_FADE_MS = 300;
const GOAL_FLASH_CASCADE_MS = 2500;

function flashGoalNarrative(narrative: string): void {
  const now = Date.now();
  const startAt = Math.max(now, goalFlashSpawnAt);
  goalFlashSpawnAt = startAt + GOAL_FLASH_CASCADE_MS;
  setTimeout(() => spawnGoalFlash(narrative), Math.max(0, startAt - now));
}

function findGoalEl(narrative: string): HTMLElement | null {
  const goals = document.querySelectorAll<HTMLElement>(".era-goal[data-narrative]");
  for (const g of goals) if (g.dataset.narrative === narrative) return g;
  return null;
}

function spawnGoalFlash(narrative: string): void {
  const found = findGoalEl(narrative);
  if (!found) return;
  const target: HTMLElement = found;

  const tip = document.createElement("div");
  tip.className = "goal-popup";
  tip.textContent = narrative;
  document.body.appendChild(tip);

  // Position above the goal row, centered horizontally, viewport-clamped.
  const rect = target.getBoundingClientRect();
  // Force layout to read offsetWidth/Height after textContent is set.
  const tipW = tip.offsetWidth;
  const tipH = tip.offsetHeight;
  const margin = 6;
  const center = rect.left + rect.width / 2;
  const left = Math.max(tipW / 2 + margin, Math.min(window.innerWidth - tipW / 2 - margin, center));
  const fitsAbove = rect.top - tipH - margin > 0;
  const top = fitsAbove ? rect.top - margin : rect.bottom + margin + tipH;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;

  // Fade-in next frame so the CSS transition catches the toggle.
  requestAnimationFrame(() => tip.classList.add("visible"));

  let pinned = false;
  let autoFadeTimer: number | null = window.setTimeout(fadeAndCleanup, GOAL_FLASH_DISPLAY_MS);

  function fadeAndCleanup() {
    if (autoFadeTimer !== null) { clearTimeout(autoFadeTimer); autoFadeTimer = null; }
    tip.classList.remove("visible");
    setTimeout(() => {
      tip.remove();
      // After the popup disappears, advertise re-readability by glowing the
      // goal text left-to-right and popping the trailing ⓘ marker.
      pulseGoalAffordance(target);
    }, GOAL_FLASH_FADE_MS + 20);
  }

  tip.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!pinned) {
      pinned = true;
      if (autoFadeTimer !== null) { clearTimeout(autoFadeTimer); autoFadeTimer = null; }
      tip.classList.add("goal-popup--pinned");
    } else {
      fadeAndCleanup();
    }
  });
}

function pulseGoalAffordance(goalEl: HTMLElement): void {
  // Wrap the description text node's characters in spans with staggered
  // animation-delay so the gilt highlight runs left-to-right. The trailing
  // ⓘ span gets its own larger pop. Restore plain text after the animation
  // completes so subsequent renderGoals() rounds aren't affected.
  if (!goalEl.isConnected) return;
  const infoEl = goalEl.querySelector<HTMLElement>(".era-goal-info");
  // The description sits as the first text node before the optional ⓘ.
  let textNode: Text | null = null;
  for (const n of Array.from(goalEl.childNodes)) {
    if (n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim().length > 0) {
      textNode = n as Text;
      break;
    }
  }
  if (!textNode) return;
  const original = textNode.textContent ?? "";
  const frag = document.createDocumentFragment();
  const perCharMs = 28;
  const charSpans: HTMLSpanElement[] = [];
  for (let i = 0; i < original.length; i++) {
    const span = document.createElement("span");
    span.className = "era-goal-glow";
    span.style.animationDelay = `${i * perCharMs}ms`;
    span.textContent = original[i];
    frag.appendChild(span);
    charSpans.push(span);
  }
  textNode.replaceWith(frag);

  // Extra pop on the trailing affordance marker, timed to land just after
  // the last character lights up.
  const totalCharsMs = original.length * perCharMs + 600;
  if (infoEl) {
    setTimeout(() => infoEl.classList.add("era-goal-info--pop"), totalCharsMs - 200);
    setTimeout(() => infoEl.classList.remove("era-goal-info--pop"), totalCharsMs + 700);
  }

  // Restore a plain text node once the animation finishes — but BAIL if our
  // spans were already removed (e.g. by a renderEraIdeaSlot textContent
  // replacement). Otherwise the delayed insertBefore would APPEND the old
  // original text alongside whatever new content replaced it, producing
  // glued strings like "Save an idea tile for this eraPress and hold to bind".
  setTimeout(() => {
    if (!goalEl.isConnected) return;
    if (charSpans[0]?.parentNode !== goalEl) return;
    const restored = document.createTextNode(original);
    goalEl.insertBefore(restored, charSpans[0]);
    for (const s of charSpans) s.remove();
  }, totalCharsMs + 800);
}

// Era goals toggle
const eraGoalsEl = document.getElementById("era-goals")!;
const eraToggleBtn = document.getElementById("era-name-toggle")!;
const eraToggleIcon = document.getElementById("era-toggle-icon")!;
let eraGoalsCollapsed = false;

// Onboarding directional arrow — fires on each idle-hint tick from the
// OnboardingOverlay. Picks endpoints based on current Fire/Wood locations:
//   - no Fire on workspace → inventory Fire → workspace center
//   - Fire on workspace, no Wood → inventory Wood → workspace center
//   - both on workspace → workspace Wood → workspace Fire (teach combine)
// The arrow lives for ~2.6s then self-fades; a fresh one is created on the
// next 4s tick if onboarding is still in guide frame.
let onboardingArrowTrail: ArrowTrailHandle | null = null;
let onboardingArrowFadeTimer: number | null = null;
let onboardingArrowDetachTimer: number | null = null;

// Idle-gated hint loop — invokes `play()` after `idleMs` of pointer-quiet
// time, then waits another `idleMs` past the cycle's end before the next
// play. With `playImmediate: true`, the FIRST play fires right away and
// only subsequent plays are idle-gated (used by the bind arrow so the
// arrow appears the moment the slot becomes available).
function startIdleHintLoop(
  play: () => void,
  cycleMs: number,
  options: { idleMs?: number; playImmediate?: boolean } = {},
): () => void {
  const idleMs = options.idleMs ?? 4000;
  const playImmediate = options.playImmediate ?? false;
  let lastInputAt = Date.now();
  let isPlaying = false;
  const onInput = () => { lastInputAt = Date.now(); };
  document.addEventListener("pointermove", onInput, { passive: true });
  document.addEventListener("pointerdown", onInput, { passive: true });
  document.addEventListener("touchstart", onInput, { passive: true });
  const fire = () => {
    if (isPlaying) return;
    isPlaying = true;
    play();
    window.setTimeout(() => {
      isPlaying = false;
      // Reset the idle counter so the next play needs another idleMs of
      // pointer-quiet time after this cycle ends.
      lastInputAt = Date.now();
    }, cycleMs);
  };
  if (playImmediate) fire();
  const tick = () => {
    if (isPlaying) return;
    if (Date.now() - lastInputAt < idleMs) return;
    fire();
  };
  const intervalId = window.setInterval(tick, 500);
  return () => {
    document.removeEventListener("pointermove", onInput);
    document.removeEventListener("pointerdown", onInput);
    document.removeEventListener("touchstart", onInput);
    window.clearInterval(intervalId);
  };
}

// Press-and-hold prompt pulse loop — runs while a tile is parked in the bind
// slot but the hold hasn't begun, to draw the player's eye to the
// "Press and hold to bind" text. Reuses the same per-character left-to-right
// gilt glow used for newly-met objectives.
const PRESS_AND_HOLD_PULSE_INTERVAL_MS = 3000;
let pressAndHoldPulseTimer: number | null = null;
function pulsePressAndHoldPrompt(): void {
  const promptEl = document.querySelector<HTMLElement>("#era-idea-slot-wrapper .era-idea-prompt");
  if (!promptEl || !promptEl.textContent?.trim()) return;
  pulseGoalAffordance(promptEl);
}
function startPressAndHoldPulses(): void {
  stopPressAndHoldPulses();
  const tick = () => {
    if (!pendingEraIdeaTile || bindHoldHandle) {
      stopPressAndHoldPulses();
      return;
    }
    pulsePressAndHoldPrompt();
    pressAndHoldPulseTimer = window.setTimeout(tick, PRESS_AND_HOLD_PULSE_INTERVAL_MS);
  };
  // Small delay so the slot-occupied transition lands before the first pulse.
  pressAndHoldPulseTimer = window.setTimeout(tick, 350);
}
function stopPressAndHoldPulses(): void {
  if (pressAndHoldPulseTimer !== null) {
    window.clearTimeout(pressAndHoldPulseTimer);
    pressAndHoldPulseTimer = null;
  }
}

function getInventoryTileEl(name: string): HTMLElement | null {
  return paletteItems.querySelector<HTMLElement>(`.palette-item[data-name="${name}"]`);
}

function getWorkspaceTileByName(name: string): HTMLElement | null {
  for (const it of items) if (it.name === name) return it.el;
  return null;
}

function workspaceCenter(): { x: number; y: number } {
  const r = workspace.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Find the point on the element's bounding-rect edge that lies on the line
 *  from the element's center to `target`. Used for arrow endpoints anchored
 *  to tiles so the arrow start/end sits on the card's edge instead of inside
 *  it (inside is hidden behind the tile face). */
function tileEdgePointTowards(el: HTMLElement, target: { x: number; y: number }): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return { x: cx, y: cy };
  const halfW = r.width / 2;
  const halfH = r.height / 2;
  const tx = dx === 0 ? Infinity : halfW / Math.abs(dx);
  const ty = dy === 0 ? Infinity : halfH / Math.abs(dy);
  const t = Math.min(tx, ty);
  return { x: cx + t * dx, y: cy + t * dy };
}

/** Where the arrow lands inside a destination card: horizontal center, but
 *  in the bottom third vertically. Reads as "bring it here" landing on the
 *  card face rather than at its top edge or center. */
function tileTargetPoint(el: HTMLElement): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height * (2 / 3) };
}

/** Move the gilt halo pulse to the right tile based on board state.
 *  - Fire NOT on board → pulse inventory Fire
 *  - Fire ON board     → pulse all workspace Fires (drop the inventory glow)
 *  - same logic for Wood
 *  Called whenever the workspace items list changes (spawn / removeItem) and
 *  whenever the onboarding frame transitions, so the highlight tracks the
 *  player's progress in real time. */
function updateOnboardingPulses(): void {
  const onboardingFrame = document.documentElement.dataset.onboarding;
  // Clear any existing pulses first.
  document.querySelectorAll(".onboarding-pulse").forEach((el) => el.classList.remove("onboarding-pulse"));
  if (onboardingFrame !== "guide") return;

  const fireWs = items.filter((it) => it.name === "Fire");
  const woodWs = items.filter((it) => it.name === "Wood");
  const fireInv = getInventoryTileEl("Fire");
  const woodInv = getInventoryTileEl("Wood");

  if (fireWs.length > 0) {
    for (const it of fireWs) it.el.classList.add("onboarding-pulse");
  } else if (fireInv) {
    fireInv.classList.add("onboarding-pulse");
  }

  if (woodWs.length > 0) {
    for (const it of woodWs) it.el.classList.add("onboarding-pulse");
  } else if (woodInv) {
    woodInv.classList.add("onboarding-pulse");
  }
}

function showOnboardingArrow(): void {
  if (document.documentElement.dataset.onboarding !== "guide") return;
  const fireWs = getWorkspaceTileByName("Fire");
  const woodWs = getWorkspaceTileByName("Wood");
  const fireInv = getInventoryTileEl("Fire");
  const woodInv = getInventoryTileEl("Wood");

  // Decide source + destination ELEMENTS / POINTS based on board state.
  // Then build endpoint callbacks that anchor onto each element's edge
  // (not center) so the arrow starts/ends just outside the tile face.
  //
  // Cases:
  //   Fire on board, no Wood   → inv Wood → ws Fire     (combine teaching)
  //   Wood on board, no Fire   → inv Fire → ws Wood     (combine teaching)
  //   Both on board            → ws Wood → ws Fire      (combine teaching)
  //   Neither (or only Fire... covered above; only Wood covered above)
  //   Otherwise (no Fire on board, no Wood on board, but inventory has both):
  //                              inv Fire → workspace center
  let sourceEl: HTMLElement | null = null;
  let destEl: HTMLElement | null = null;
  let destPoint: { x: number; y: number } | null = null;
  if (fireWs && !woodWs && woodInv) {
    sourceEl = woodInv;
    destEl = fireWs;
  } else if (woodWs && !fireWs && fireInv) {
    sourceEl = fireInv;
    destEl = woodWs;
  } else if (fireWs && woodWs) {
    sourceEl = woodWs;
    destEl = fireWs;
  } else if (!fireWs && fireInv) {
    sourceEl = fireInv;
    destPoint = workspaceCenter();
  } else if (!woodWs && woodInv) {
    sourceEl = woodInv;
    destPoint = workspaceCenter();
  }
  if (!sourceEl) return;
  if (!destEl && !destPoint) return;

  // Build endpoint callbacks. When the destination is a card, the arrow
  // tip lands at the card's middle-x / bottom-third-y (per spec — reads as
  // a landing point on the face rather than the top edge). The source
  // anchors to its own card edge in the direction of that target point.
  const sEl = sourceEl;
  let from: () => { x: number; y: number };
  let to: () => { x: number; y: number };
  if (destEl) {
    const dEl = destEl;
    to = () => tileTargetPoint(dEl);
    from = () => tileEdgePointTowards(sEl, tileTargetPoint(dEl));
  } else {
    const dPt = destPoint!;
    from = () => tileEdgePointTowards(sEl, dPt);
    to = () => dPt;
  }

  // Tear down any previous arrow before spawning a new one.
  if (onboardingArrowTrail) {
    onboardingArrowTrail.detach();
    onboardingArrowTrail = null;
  }
  if (onboardingArrowFadeTimer !== null) clearTimeout(onboardingArrowFadeTimer);
  if (onboardingArrowDetachTimer !== null) clearTimeout(onboardingArrowDetachTimer);

  onboardingArrowTrail = createArrowTrail({
    from,
    to,
    color: "var(--accent-secondary, #c9a85f)",
  });
  document.body.appendChild(onboardingArrowTrail.el);
  onboardingArrowTrail.attach();
  onboardingArrowTrail.setActive(true);

  // The trail's cycle is 3 steps × 1s + 1s hold ≈ 3.2s with fade. Cancel just
  // after fade-out so the loop doesn't restart before the next idle-tick.
  onboardingArrowFadeTimer = window.setTimeout(() => {
    onboardingArrowTrail?.setActive(false);
  }, 3300);
  onboardingArrowDetachTimer = window.setTimeout(() => {
    onboardingArrowTrail?.detach();
    onboardingArrowTrail = null;
  }, 3700);
}

document.addEventListener("onboarding:idle-hint", showOnboardingArrow);
// Tear down on leaving guide (the OnboardingOverlay clears data-onboarding on
// frame change; observe so a stale arrow doesn't bleed into combine/reveal).
// Also refresh pulse highlights so they don't bleed across frame changes.
const onboardingObserver = new MutationObserver(() => {
  if (document.documentElement.dataset.onboarding !== "guide" && onboardingArrowTrail) {
    onboardingArrowTrail.detach();
    onboardingArrowTrail = null;
  }
  updateOnboardingPulses();
});
onboardingObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-onboarding"] });

function applyEraGoalsState() {
  eraGoalsEl.classList.toggle("era-goals--collapsed", eraGoalsCollapsed);
  eraToggleIcon.textContent = eraGoalsCollapsed ? "\u25B8" : "\u25BE";
  eraToggleBtn.setAttribute("aria-expanded", String(!eraGoalsCollapsed));
}
applyEraGoalsState();

eraToggleBtn.addEventListener("click", () => {
  eraGoalsCollapsed = !eraGoalsCollapsed;
  applyEraGoalsState();
});

// --- Settings drawer (Phase 7) ---
initSettings();
const settingsBtn = document.getElementById("settings-btn");
const settingsOverlay = document.getElementById("settings-overlay")!;
const settingsClose = document.getElementById("settings-close");
const inputReducedMotion = document.getElementById("settings-reduced-motion") as HTMLInputElement | null;
const inputTapToCommit = document.getElementById("settings-tap-to-commit") as HTMLInputElement | null;
const inputHighContrast = document.getElementById("settings-high-contrast") as HTMLInputElement | null;
const inputRoomTone = document.getElementById("settings-room-tone") as HTMLInputElement | null;
const themeRadios = Array.from(
  document.querySelectorAll<HTMLInputElement>('input[name="settings-theme"]'),
);

function syncSettingsInputs() {
  const s = getSettings();
  if (inputReducedMotion) inputReducedMotion.checked = s.prefersReducedMotion;
  if (inputTapToCommit) inputTapToCommit.checked = s.prefersTapToCommit;
  if (inputHighContrast) inputHighContrast.checked = s.prefersHighContrast;
  if (inputRoomTone) inputRoomTone.checked = s.roomToneEnabled;
  for (const r of themeRadios) r.checked = r.value === s.themePreference;
}
syncSettingsInputs();

const openSettings = () => {
  syncSettingsInputs();
  settingsOverlay.classList.add("visible");
};
const closeSettings = () => settingsOverlay.classList.remove("visible");
settingsBtn?.addEventListener("click", openSettings);
settingsClose?.addEventListener("click", closeSettings);
settingsOverlay.addEventListener("click", (e) => {
  if (e.target === settingsOverlay) closeSettings();
});

inputReducedMotion?.addEventListener("change", (e) => {
  setSetting("prefersReducedMotion", (e.target as HTMLInputElement).checked);
});
inputTapToCommit?.addEventListener("change", (e) => {
  setSetting("prefersTapToCommit", (e.target as HTMLInputElement).checked);
});
inputHighContrast?.addEventListener("change", (e) => {
  setSetting("prefersHighContrast", (e.target as HTMLInputElement).checked);
});
inputRoomTone?.addEventListener("change", (e) => {
  setSetting("roomToneEnabled", (e.target as HTMLInputElement).checked);
});
for (const radio of themeRadios) {
  radio.addEventListener("change", (e) => {
    const value = (e.target as HTMLInputElement).value;
    if (value === "bibliophile" || value === "curator" || value === "cartographer") {
      setSetting("themePreference", value);
    }
  });
}

// --- Tile-info bookplate sheet (Phase 8) ---
const tileInfoOverlay = document.getElementById("tile-info-overlay")!;
const tileInfoSheet = document.getElementById("tile-info-sheet")!;

function openTileInfo(entry: ElementData) {
  const stars = entry.tier > 0 ? "★".repeat(Math.min(entry.tier, 5)) : "";
  tileInfoSheet.innerHTML = `
    <div class="bookplate-stripe" style="background: var(--border-strong);"></div>
    <div class="bookplate-content">
      <div class="bookplate-emoji" aria-hidden="true">${esc(entry.emoji)}</div>
      <div class="bookplate-name">${esc(entry.name)}</div>
      ${stars ? `<div class="bookplate-tier">${stars}</div>` : ""}
      ${entry.narrative ? `<p class="bookplate-narrative">&ldquo;${esc(entry.narrative)}&rdquo;</p>` : ""}
      ${entry.description ? `<p class="bookplate-description">${esc(entry.description)}</p>` : ""}
    </div>
  `;
  tileInfoOverlay.removeAttribute("hidden");
  requestAnimationFrame(() => tileInfoOverlay.classList.add("visible"));
}

function closeTileInfo() {
  tileInfoOverlay.classList.remove("visible");
  setTimeout(() => {
    if (!tileInfoOverlay.classList.contains("visible")) {
      tileInfoOverlay.setAttribute("hidden", "");
    }
  }, 220);
}

tileInfoOverlay.addEventListener("click", (e) => {
  if (e.target === tileInfoOverlay) closeTileInfo();
});

// --- Main menu (Phase 8 polish) ---
// Single entry-point button at top-right consolidates Scoreboard, How to Play,
// Account/Sign in, Restart, Debug (dev only). Standalone floating buttons
// remain in the DOM (some carry handler bindings) but are visually hidden.
const menuBtn = document.getElementById("menu-btn") as HTMLButtonElement | null;
const menuOverlay = document.getElementById("menu-overlay")!;
const menuItemAccount = document.getElementById("menu-item-account") as HTMLButtonElement | null;
const menuItemDebug = document.getElementById("menu-item-debug") as HTMLButtonElement | null;
if (menuItemDebug && isLocalBuild) menuItemDebug.hidden = false;

function syncMenuAccountLabel() {
  if (!menuItemAccount) return;
  const s = authStore.getState();
  menuItemAccount.textContent = s.isLoggedIn ? "Sign out" : "Sign in";
}
syncMenuAccountLabel();
authStore.subscribe(syncMenuAccountLabel);

function openMenu() {
  syncMenuAccountLabel();
  menuOverlay.removeAttribute("hidden");
  requestAnimationFrame(() => menuOverlay.classList.add("visible"));
  menuBtn?.setAttribute("aria-expanded", "true");
}
function closeMenu() {
  menuOverlay.classList.remove("visible");
  menuBtn?.setAttribute("aria-expanded", "false");
  setTimeout(() => {
    if (!menuOverlay.classList.contains("visible")) menuOverlay.setAttribute("hidden", "");
  }, 220);
}
menuBtn?.addEventListener("click", () => {
  if (menuOverlay.classList.contains("visible")) closeMenu();
  else openMenu();
});
menuOverlay.addEventListener("click", (e) => {
  if (e.target === menuOverlay) closeMenu();
});
menuOverlay.addEventListener("click", (e) => {
  const item = (e.target as HTMLElement).closest<HTMLElement>(".menu-item");
  if (!item) return;
  const action = item.dataset.menu;
  closeMenu();
  switch (action) {
    case "scoreboard":
      // Existing #scoreboard-btn carries the open-on-click handler.
      document.getElementById("scoreboard-btn")?.click();
      break;
    case "how-to-play":
      authStore.getState().openHowToPlay?.();
      break;
    case "account": {
      const s = authStore.getState();
      if (s.isLoggedIn) void s.signOut?.();
      else s.openLogin?.();
      break;
    }
    case "restart":
      handleRestart();
      break;
    case "debug":
      // The dev-only debug-toggle injects itself into the body on initDebugConsole.
      document.getElementById("debug-toggle")?.click();
      break;
  }
});

// Palette zoom
const palette = document.getElementById("palette")!;
let paletteZoom = 1.0;
const PALETTE_ZOOM_STEP = 0.1;
const PALETTE_ZOOM_MIN = 0.25;
const PALETTE_ZOOM_MAX = 1.5;

function applyPaletteZoom() {
  palette.style.zoom = String(paletteZoom);
}

document.getElementById("palette-zoom-in")!.addEventListener("click", () => {
  paletteZoom = Math.min(PALETTE_ZOOM_MAX, Math.round((paletteZoom + PALETTE_ZOOM_STEP) * 10) / 10);
  applyPaletteZoom();
});
document.getElementById("palette-zoom-out")!.addEventListener("click", () => {
  paletteZoom = Math.max(PALETTE_ZOOM_MIN, Math.round((paletteZoom - PALETTE_ZOOM_STEP) * 10) / 10);
  applyPaletteZoom();
});

// Idea-tray pagination + wheel scroll (mouse wheel scrolls horizontally, ‹ › buttons
// flip a near-page worth of cards). Touch users scroll natively; the drag handler
// only commits on vertical motion (see addToPalette).
const trayPrev = document.getElementById("tray-prev") as HTMLButtonElement | null;
const trayNext = document.getElementById("tray-next") as HTMLButtonElement | null;

function updateTrayPaginationVisibility() {
  if (!trayPrev || !trayNext) return;
  const overflow = paletteItems.scrollWidth > paletteItems.clientWidth + 1;
  trayPrev.hidden = !overflow;
  trayNext.hidden = !overflow;
  if (!overflow) return;
  trayPrev.disabled = paletteItems.scrollLeft <= 0;
  trayNext.disabled =
    paletteItems.scrollLeft + paletteItems.clientWidth >= paletteItems.scrollWidth - 1;
}

trayPrev?.addEventListener("click", () => {
  paletteItems.scrollBy({ left: -paletteItems.clientWidth * 0.85, behavior: "smooth" });
});
trayNext?.addEventListener("click", () => {
  paletteItems.scrollBy({ left: paletteItems.clientWidth * 0.85, behavior: "smooth" });
});
paletteItems.addEventListener("scroll", updateTrayPaginationVisibility, { passive: true });

// --- Idea-tray rubber-band overscroll ---
// At a boundary (start or end), wheel + touch attempts to scroll past trigger a
// diminishing-return transform on #palette-items. On idle, the transform animates
// back to 0. Bidirectional, visible on both touch and mouse wheel.
const OVERSCROLL_MAX_PX = 64;
const OVERSCROLL_FACTOR = 0.45;
let overscrollPx = 0;
let overscrollSnapTimer: ReturnType<typeof setTimeout> | null = null;
let overscrollSnapping = false;

function applyOverscroll(deltaPx: number) {
  if (overscrollSnapping) {
    paletteItems.style.transition = "";
    overscrollSnapping = false;
  }
  // Diminishing returns — once we're near the cap, additional input has less effect.
  const damping = 1 - Math.abs(overscrollPx) / OVERSCROLL_MAX_PX;
  const next = overscrollPx + deltaPx * Math.max(0.05, damping) * OVERSCROLL_FACTOR;
  overscrollPx = Math.max(-OVERSCROLL_MAX_PX, Math.min(OVERSCROLL_MAX_PX, next));
  paletteItems.style.transform = `translateX(${overscrollPx}px)`;
}

function scheduleOverscrollSnap(delay = 90) {
  if (overscrollSnapTimer) clearTimeout(overscrollSnapTimer);
  overscrollSnapTimer = setTimeout(() => {
    overscrollSnapTimer = null;
    if (overscrollPx === 0) return;
    overscrollSnapping = true;
    paletteItems.style.transition = "transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1)";
    paletteItems.style.transform = "translateX(0)";
    setTimeout(() => {
      paletteItems.style.transition = "";
      overscrollPx = 0;
      overscrollSnapping = false;
    }, 340);
  }, delay);
}

// Mouse wheel → horizontal scroll. Translate vertical wheel deltas (the common case
// for both wheel mice and trackpad two-finger scroll) into horizontal scroll.
// At a boundary, the wheel input drives rubber-band overscroll instead.
paletteItems.addEventListener(
  "wheel",
  (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    const atStart = paletteItems.scrollLeft <= 0;
    const atEnd =
      paletteItems.scrollLeft + paletteItems.clientWidth >= paletteItems.scrollWidth - 1;
    if ((atStart && e.deltaY < 0) || (atEnd && e.deltaY > 0)) {
      // Wheel deltaY positive = scrolling-right intent. At the right boundary that
      // should pull content visually LEFT (translate negative). Inverse on the left.
      applyOverscroll(-e.deltaY);
      scheduleOverscrollSnap();
    } else {
      paletteItems.scrollBy({ left: e.deltaY, behavior: "auto" });
    }
  },
  { passive: false },
);

// Touch boundary overscroll — when scrollLeft is pinned at 0 or max and the player
// keeps swiping in the boundary direction, accumulate visual stretch and snap on
// release. Mid-bound horizontal swipes still scroll natively.
let touchPrevX: number | null = null;
let touchOverscrollEngaged = false;
// Only the gap-touch path — finger-on-tile is owned by attachDragToSpawn
// (arming → beginJsScroll). If we let this fire on tile touches it would
// stretch the row at boundaries during the arming window, before the
// drag-vs-scroll decision is made — that's the inventory's "stickiness"
// vs the era-cube strip which has no such layer.
const touchStartedOnTile = (e: TouchEvent) =>
  (e.touches[0]?.target as HTMLElement | undefined)?.closest?.(".palette-item") != null;

paletteItems.addEventListener("touchstart", (e) => {
  if (e.touches.length !== 1) return;
  if (jsScrollActivePointerId !== null) return;
  if (touchStartedOnTile(e)) return;
  touchPrevX = e.touches[0].clientX;
  touchOverscrollEngaged = false;
}, { passive: true });
paletteItems.addEventListener("touchmove", (e) => {
  // beginJsScroll owns the gesture for finger-on-card touches; its own
  // pointermove handler clamps scrollLeft and feeds applyOverscroll, so
  // skip this finger-on-gap rubber-band path to avoid double-firing.
  if (jsScrollActivePointerId !== null) return;
  if (touchStartedOnTile(e)) return;
  if (e.touches.length !== 1 || touchPrevX === null) return;
  const x = e.touches[0].clientX;
  const dx = x - touchPrevX;
  touchPrevX = x;
  const atStart = paletteItems.scrollLeft <= 0;
  const atEnd =
    paletteItems.scrollLeft + paletteItems.clientWidth >= paletteItems.scrollWidth - 1;
  // Touch dx positive = finger moves right. At the LEFT boundary (atStart) that is
  // the boundary direction → translate right (overscroll positive). At the right
  // boundary, dx negative is the boundary direction → translate left.
  if ((atStart && dx > 0) || (atEnd && dx < 0)) {
    e.preventDefault();
    touchOverscrollEngaged = true;
    applyOverscroll(dx);
  } else if (touchOverscrollEngaged) {
    // Player has reversed direction back into the scrollable range — snap & let
    // native scroll resume.
    touchOverscrollEngaged = false;
    scheduleOverscrollSnap(0);
  }
}, { passive: false });
const onTouchRelease = () => {
  touchPrevX = null;
  if (touchOverscrollEngaged) {
    touchOverscrollEngaged = false;
    scheduleOverscrollSnap(0);
  }
};
paletteItems.addEventListener("touchend", onTouchRelease);
paletteItems.addEventListener("touchcancel", onTouchRelease);

// Re-evaluate pagination visibility whenever the inventory mutates.
new MutationObserver(updateTrayPaginationVisibility).observe(paletteItems, { childList: true });
new ResizeObserver(updateTrayPaginationVisibility).observe(paletteItems);
// Initial paint
requestAnimationFrame(updateTrayPaginationVisibility);

// Card Catalog modal — stub in Phase 1; full grid + search in Phase 4.
const cardCatalogOverlay = document.getElementById("card-catalog-overlay")!;
const openCardCatalog = () => {
  cardCatalogOverlay.classList.add("visible");
  posthog.capture("card_catalog_opened");
};
const closeCardCatalog = () => cardCatalogOverlay.classList.remove("visible");
document.getElementById("card-catalog-btn")?.addEventListener("click", openCardCatalog);
document.getElementById("card-catalog-close")?.addEventListener("click", closeCardCatalog);
cardCatalogOverlay.addEventListener("click", (e) => {
  if (e.target === cardCatalogOverlay) closeCardCatalog();
});

// Returns the natural (unzoomed) scroll height of the palette.
function getPaletteNaturalH(): number {
  palette.style.zoom = "1";
  const h = palette.scrollHeight;
  applyPaletteZoom();
  return h;
}

// On load: fit zoom so all content is visible. Never zooms above 1.0.
function autosizePaletteInitial() {
  const naturalH = getPaletteNaturalH();
  if (naturalH <= 0) return;
  const fit = window.innerHeight / naturalH;
  paletteZoom = Math.max(PALETTE_ZOOM_MIN, Math.min(1.0, Math.round(fit * 100) / 100));
  applyPaletteZoom();
}

// On resize: only zoom down if content no longer fits; never zoom in.
function autosizePaletteOnResize() {
  const naturalH = getPaletteNaturalH();
  if (naturalH <= 0) return;
  const fittingZoom = window.innerHeight / naturalH;
  if (fittingZoom < paletteZoom) {
    paletteZoom = Math.max(PALETTE_ZOOM_MIN, Math.round(fittingZoom * 100) / 100);
    applyPaletteZoom();
  }
}

autosizePaletteInitial();

let _autosizeTimer: ReturnType<typeof setTimeout> | null = null;
new ResizeObserver(() => {
  if (_autosizeTimer) clearTimeout(_autosizeTimer);
  _autosizeTimer = setTimeout(autosizePaletteOnResize, 100);
}).observe(document.documentElement);
demoResetConfirmBtn.addEventListener("click", handleDemoResetConfirm);
demoResetCancelBtn.addEventListener("click", handleDemoResetCancel);
scoreboardBtn.addEventListener("click", showScoreboard);
scoreboardCloseBtn.addEventListener("click", () => scoreboardOverlay.classList.remove("visible"));
document.getElementById("scoreboard-tapestries-btn")!.addEventListener("click", () => {
  // TODO: re-enable when tapestry share links are ready
  // if (tapestrySharePath) {
  //   window.open(new URL(tapestrySharePath, window.location.origin).toString(), "_blank", "noopener,noreferrer");
  // }
});

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Escape" && tapestryOverlay.classList.contains("visible") && tapestryOverlay.classList.contains("tapestry-closeable")) {
    closeTapestry();
  } else if (e.key === "Escape" && heatmapOverlay.classList.contains("visible")) {
    closeHeatmap();
  } else if (e.key === "Escape" && scoreboardOverlay.classList.contains("visible")) {
    scoreboardOverlay.classList.remove("visible");
  } else if (e.key === "Escape" && cardCatalogOverlay.classList.contains("visible")) {
    closeCardCatalog();
  } else if (e.key === "Escape" && settingsOverlay.classList.contains("visible")) {
    closeSettings();
  } else if (e.key === "Escape" && tileInfoOverlay.classList.contains("visible")) {
    closeTileInfo();
  } else if (e.key === "Escape" && menuOverlay.classList.contains("visible")) {
    closeMenu();
  }
};
document.addEventListener("keydown", handleKeyDown);

tapestryClose.addEventListener("click", closeTapestry);
tapestryOverlay.addEventListener("click", (e) => {
  if (e.target === tapestryOverlay && tapestryOverlay.classList.contains("tapestry-closeable")) {
    closeTapestry();
  }
});

// Era-summary frontispiece → click to fullscreen via the tapestry overlay.
// Reuses the existing tapestry-overlay closeable behavior (click backdrop or
// ESC dismisses) so the player can pop back to the era spread.
document.getElementById("era-summary-frontispiece")?.addEventListener("click", (e) => {
  e.stopPropagation();
  const img = e.currentTarget as HTMLImageElement;
  if (!img.src) return;
  tapestryContent.innerHTML = `<img id="tapestry-img" src="${img.src}" alt="Era tapestry">`;
  tapestryActions.style.display = "none";
  tapestryOverlay.classList.add("visible", "tapestry-closeable");
});

document.getElementById("tapestry-heart-btn")!.addEventListener("click", () => {
  posthog.capture('tapestry_hearted', { era_name: eraManager.current.name });
});

document.getElementById("tapestry-share-btn")!.addEventListener("click", () => {
  posthog.capture('tapestry_viewed', { era_name: eraManager.current.name });
  const img = document.getElementById("tapestry-img") as HTMLImageElement | null;
  if (!img) return;
  const ext = img.src.startsWith("data:image/jpeg") ? "jpg" : "png";
  saveImage(img.src, `bari-tapestry.${ext}`);
});

heatmapClose.addEventListener("click", closeHeatmap);
heatmapOverlay.addEventListener("click", (e) => {
  if (e.target === heatmapOverlay) closeHeatmap();
});

// --- Save/Load ---
function buildPaletteData(): ElementData[] {
  // Walk all palette items and resolve full ElementData via seed pools, actionLog, or recipe cache
  const paletteData: ElementData[] = [];
  const cache = recipeStore.exportCache();
  // Build a lookup of all seed ElementData across all eras that have been resolved
  const seedLookup: Record<string, ElementData> = {};
  for (let i = 0; i < eraManager.totalEras; i++) {
    try {
      for (const s of eraManager.getSeedsForEra(i)) seedLookup[s.name] = s;
    } catch { /* ignore */ }
  }
  for (const div of paletteItems.querySelectorAll<HTMLElement>("[data-name]")) {
    const name = div.dataset.name!;
    if (seedLookup[name]) { paletteData.push(seedLookup[name]); continue; }
    // Try to resolve via action log (a result of some combine)
    const entry = actionLog.find((e) => e.result === name);
    if (entry) {
      const key = recipeKey(entry.parentA, entry.parentB);
      const cached = cache[key];
      if (cached) { paletteData.push(cached); continue; }
    }
  }
  return paletteData;
}

function persistGame() {
  if (restarting) return;
  if (selectFiveMode) {
    const trimmedActionLog = actionLog.length > MAX_ACTION_LOG
      ? actionLog.slice(-MAX_ACTION_LOG)
      : [...actionLog];
    const data: SaveData = {
      version: 1,
      runId,
      selectedModel,
      actionLog: trimmedActionLog,
      eraActionLog: [],
      recipeCache: recipeStore.exportCache(),
      eraCurrentIndex: 0,
      eraHistory: [],
      eraResolvedSeeds: {},
      eraGoalStates: {},
      paletteItems: buildPaletteData(),
      selectedSlots: selectionSlots.map((s) => s.item ? { name: s.item.name, tier: s.item.tier, emoji: s.item.emoji, color: s.item.color } : null),
      selectFiveEraIndex,
    };
    saveGame(data, SELECT_FIVE_SAVE_KEY);
    return;
  }
  const paletteData: ElementData[] = [];
  for (const seed of eraManager.getSeeds()) {
    if (paletteItems.querySelector(`[data-name="${seed.name}"]`)) paletteData.push(seed);
  }
  // Add non-seed palette items from recipe cache
  for (const div of paletteItems.querySelectorAll<HTMLElement>("[data-name]")) {
    const name = div.dataset.name!;
    if (paletteData.some((p) => p.name === name)) continue;
    // Find in eraActionLog
    const entry = eraActionLog.find((e) => e.result === name);
    if (!entry) continue;
    const key = recipeKey(entry.parentA, entry.parentB);
    const cached = recipeStore.exportCache()[key];
    if (cached) paletteData.push(cached);
  }

  const eraState = eraManager.exportState();
  const data: SaveData = {
    version: 1,
    runId,
    latestTapestryPath: tapestrySharePath,
    selectedModel,
    actionLog: [...actionLog],
    eraActionLog: [...eraActionLog],
    recipeCache: recipeStore.exportCache(),
    eraCurrentIndex: eraState.currentIndex,
    eraHistory: eraState.history,
    eraResolvedSeeds: eraState.resolvedSeeds,
    eraGoalStates: eraState.goalStates,
    paletteItems: paletteData,
  };
  saveGame(data);
}

function restoreGame(save: SaveData) {
  log.info("system", "Restoring saved game...");

  selectedModel = save.selectedModel;
  if (modelSelect) modelSelect.value = save.selectedModel;

  actionLog.length = 0;
  actionLog.push(...save.actionLog);
  eraActionLog = [...save.eraActionLog];

  recipeStore.importCache(save.recipeCache);

  eraManager.importState({
    currentIndex: save.eraCurrentIndex,
    history: save.eraHistory,
    resolvedSeeds: save.eraResolvedSeeds,
    goalStates: save.eraGoalStates,
  });

  // Rebuild palette — re-identify seeds by matching against current era's seed names
  const seedNames = new Set(eraManager.getSeeds().map((s) => s.name));
  paletteItems.innerHTML = "";
  for (const entry of save.paletteItems) {
    addToPalette(entry, seedNames.has(entry.name));
  }

  renderEraName();
  renderGoals();
  log.info("system", `Game restored: ${eraManager.current.name}, ${actionLog.length} total actions`);
}

// --- Initialize ---
({ modelSelect } = initDebugConsole({
  modelOptions,
  onModelChange: handleModelChange,
  resetPlayer: handleDemoReset,
  showHeatmap,
  testVictory: () => {
    // Inject mock history if none exists
    if (eraManager.history.length === 0) {
      const now = Date.now();
      const era1Start = now - 18 * 60 * 1000;
      const era1End = now - 10 * 60 * 1000;
      const era2Start = era1End;
      const era2End = now - 2 * 60 * 1000;
      const mockActions = [
        { timestamp: era1Start + 30000, parentA: "Fire", parentB: "Stone", result: "Flint Tool", resultTier: 2 as Tier },
        { timestamp: era1Start + 60000, parentA: "Flint Tool", parentB: "Wood", result: "Spear", resultTier: 3 as Tier },
        { timestamp: era1Start + 90000, parentA: "Seed", parentB: "Water", result: "Crop", resultTier: 2 as Tier },
        { timestamp: era1Start + 120000, parentA: "Crop", parentB: "Beast", result: "Farm", resultTier: 3 as Tier },
        { timestamp: era1Start + 150000, parentA: "Spear", parentB: "Farm", result: "Settlement", resultTier: 4 as Tier },
        { timestamp: era1Start + 180000, parentA: "Settlement", parentB: "Fire", result: "Village", resultTier: 5 as Tier },
      ];
      eraManager.history.push(
        {
          eraName: "Stone Age",
          startingSeeds: ["\uD83D\uDD25 Fire", "\uD83E\uDEA8 Stone", "\uD83D\uDCA7 Water", "\uD83E\uDDAC Beast", "\uD83E\uDEB5 Wood", "\uD83C\uDF31 Seed"],
          actions: mockActions,
          advancementNarrative: "From stone tools to the first settlements, your people mastered fire and earth.",
          discoveredItems: ["Fire", "Stone", "Water", "Beast", "Wood", "Seed", "Flint Tool", "Spear", "Crop", "Farm", "Settlement", "Village"],
          eraStartedAt: era1Start,
          eraCompletedAt: era1End,
          tileSpawnCounts: { "Fire": 8, "Stone": 6, "Water": 5, "Wood": 4, "Seed": 3, "Beast": 2, "Flint Tool": 3, "Spear": 2, "Crop": 2, "Farm": 1 },
          tileSpawnByTier: { 1: 28, 2: 5, 3: 4, 4: 1 },
        },
        {
          eraName: "Bronze Age",
          startingSeeds: ["\u2699\uFE0F Metal", "\uD83C\uDF3E Grain", "\uD83C\uDFFA Clay", "\uD83D\uDC02 Ox", "\uD83C\uDF0A River", "\u2600\uFE0F Sun"],
          actions: [
            { timestamp: era2Start + 45000, parentA: "Metal", parentB: "Clay", result: "Bronze", resultTier: 2 as Tier },
            { timestamp: era2Start + 90000, parentA: "Bronze", parentB: "Grain", result: "Plow", resultTier: 3 as Tier },
            { timestamp: era2Start + 135000, parentA: "Plow", parentB: "River", result: "Irrigation", resultTier: 4 as Tier },
            { timestamp: era2Start + 180000, parentA: "Irrigation", parentB: "Sun", result: "Calendar", resultTier: 5 as Tier },
          ],
          advancementNarrative: "Bronze tools and irrigation transformed nomads into city-builders.",
          discoveredItems: ["Metal", "Grain", "Clay", "Ox", "River", "Sun", "Bronze", "Plow", "Irrigation", "Calendar"],
          eraStartedAt: era2Start,
          eraCompletedAt: era2End,
          tileSpawnCounts: { "Metal": 7, "Grain": 6, "Clay": 5, "River": 4, "Ox": 3, "Sun": 3, "Bronze": 2, "Plow": 2 },
          tileSpawnByTier: { 1: 32, 2: 3, 3: 2, 4: 1 },
        },
      );
    }
    // Mirror the real victory path: lock interactions like the real path does.
    // victoryShown is intentionally NOT set — lets you re-trigger from the debug console.
    busy = true;
    showVictory();
  },
}));

const savedGame = loadGame(selectFiveMode ? SELECT_FIVE_SAVE_KEY : SAVE_KEY);
if (selectFiveMode) {
  if (savedGame) {
    if (savedGame.runId) runId = savedGame.runId;
    selectedModel = savedGame.selectedModel;
    actionLog.length = 0;
    actionLog.push(...savedGame.actionLog);
    recipeStore.importCache(savedGame.recipeCache);
    selectFiveEraIndex = savedGame.selectFiveEraIndex ?? 0;
    eraManager.setCurrentEraIndex(selectFiveEraIndex);
    paletteItems.innerHTML = "";
    const currentSeedNames = new Set(eraManager.getSeedsForEra(selectFiveEraIndex).map((s) => s.name));
    for (const entry of savedGame.paletteItems) {
      addToPalette(entry, currentSeedNames.has(entry.name));
    }
    // Restore slots (deferred — they need selectionSlots populated by s5 init)
    pendingS5SlotRestore = savedGame.selectedSlots ?? null;
    sessionStartTime = Date.now();
    posthog.capture('select_five_resumed', {
      slots_filled_at_resume: (savedGame.selectedSlots ?? []).filter(Boolean).length,
      combinations_at_resume: actionLog.length,
      era_index_at_resume: selectFiveEraIndex,
    });
  } else {
    eraManager.setCurrentEraIndex(0);
    selectFiveEraIndex = 0;
    const initialSeeds = eraManager.getSeedsForEra(0);
    for (const entry of initialSeeds) addToPalette(entry, true);
    sessionStartTime = Date.now();
    posthog.capture('select_five_started', { session_id: runId });
  }
} else if (savedGame) {
  if (savedGame.runId) runId = savedGame.runId;
  if (savedGame.latestTapestryPath) tapestrySharePath = savedGame.latestTapestryPath;
  restoreGame(savedGame);

  if (!tapestrySharePath) {
    fetch(`/api/tapestry/latest?anonId=${encodeURIComponent(getOrCreateAnonId())}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.sharePath) {
          tapestrySharePath = data.sharePath;
          persistGame();
        }
      })
      .catch(() => null);
  }
  eraStartedAt = Date.now(); // current era start unknown; track from resume point
  eraSpawnCounts = {};
  eraSpawnByTier = {};
  posthog.capture('game_resumed', {
    era_name: eraManager.current.name,
    combinations_so_far: actionLog.length,
    items_discovered: getDiscoveredItems().length,
  });
} else {
  renderEraName();
  renderGoals();
  // First-visit guided onboarding (spec §3.1): pin Fire and Wood into the
  // Stone Age seed selection (the random picker would otherwise drop one or
  // both) and pre-cache the Fire+Wood → Torch recipe so the bundled
  // narrative ("Light pushed back at the dark.") is what shows up regardless
  // of network state. The 5s ceremonial pause for that combine is enforced
  // inside combine() below.
  const isFirstRun = (() => {
    try { return !localStorage.getItem("idea-collector-onboarded"); }
    catch { return false; }
  })();
  let initialSeeds: ElementData[];
  if (isFirstRun && eraManager.current.name === "Stone Age") {
    void primeOnboardingCache();
    initialSeeds = eraManager.getSeedsForEraPinned(0, ["Fire", "Wood"]);
  } else {
    initialSeeds = eraManager.getSeeds();
  }
  log.info("era", `Starting ${eraManager.current.name} with seeds: ${initialSeeds.map((s) => s.name).join(", ")}`);
  for (const entry of initialSeeds) {
    addToPalette(entry, true);
  }
  posthog.capture('game_started', { era_name: eraManager.current.name });
}

/** Onboarding helper: pre-populate the recipe cache with the Fire+Wood →
 *  Torch combine so the spec's "Light pushed back at the dark." narrative
 *  always shows during the first guided combine, no AI roundtrip. */
async function primeOnboardingCache(): Promise<void> {
  await recipeStore.set(recipeKey("Fire", "Wood"), {
    name: "Torch",
    color: getTheme().tokens.accentSecondary,
    tier: 2,
    emoji: "🪔",
    description: "A flame that travels.",
    narrative: "Light pushed back at the dark.",
  });
}

if (!selectFiveMode) initPipelineHud();

// ================================================================
// === Select-Five Mode Setup =====================================
// ================================================================
function s5FindElementData(name: string, tier: Tier): ElementData | null {
  // Try all era seeds first
  for (let i = 0; i < eraManager.totalEras; i++) {
    try {
      const seeds = eraManager.getSeedsForEra(i);
      const match = seeds.find((s) => s.name === name);
      if (match) return match;
    } catch { /* ignore */ }
  }
  // Try recipe cache
  const cache = recipeStore.exportCache();
  for (const v of Object.values(cache)) if (v.name === name) return v;
  // Fallback minimal shape
  return { name, tier, emoji: "❓", color: getTheme().tokens.borderFaint, description: "", narrative: "" };
}

function s5RenderSlot(slot: SelectionSlot) {
  const removeBtn = slot.el.parentElement?.querySelector<HTMLButtonElement>(".slot-remove-btn");
  if (!slot.item) {
    slot.el.classList.remove("slot-occupied");
    slot.el.innerHTML = `<span class="slot-empty-hint">${slot.index + 1}</span>`;
    if (removeBtn) removeBtn.hidden = true;
    return;
  }
  slot.el.classList.add("slot-occupied");
  slot.el.innerHTML = `
    <span class="slot-emoji">${esc(slot.item.emoji || "❓")}</span>
    <span class="slot-name">${esc(slot.item.name)}</span>
    <span class="slot-tier">${tierStars(slot.item.tier)}</span>
  `;
  if (removeBtn) removeBtn.hidden = false;
}

function s5UpdateSelectionUI() {
  const filled = selectionSlots.filter((s) => s.item !== null).length;
  const btn = document.getElementById("selection-finalize-btn") as HTMLButtonElement | null;
  if (btn) btn.disabled = filled < 1;
  if (filled === 5 && !hasLoggedAllFilled) {
    hasLoggedAllFilled = true;
    posthog.capture("selection_all_slots_filled", {
      session_duration_ms: Date.now() - sessionStartTime,
      combinations_made: actionLog.length,
      items_discovered: getDiscoveredItems().length,
      selected_tiles: selectionSlots.map((s) => s.item),
    });
  }
  if (hasLoggedAllFilled) postFullSlotChanges++;
}

function s5FindNearestSlot(clientX: number, clientY: number): SelectionSlot | null {
  // First, slot whose rect contains the pointer
  for (const slot of selectionSlots) {
    const r = slot.el.getBoundingClientRect();
    if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) return slot;
  }
  // Else nearest within 80px
  let best: SelectionSlot | null = null;
  let bestDist = 80;
  for (const slot of selectionSlots) {
    const r = slot.el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const d = Math.hypot(clientX - cx, clientY - cy);
    if (d < bestDist) { best = slot; bestDist = d; }
  }
  return best;
}

function clearSlotHover() {
  for (const slot of selectionSlots) slot.el.classList.remove("slot-hover");
}

function updateSlotHover(clientX: number, clientY: number) {
  const panel = document.getElementById("selection-panel");
  if (!panel) { clearSlotHover(); return; }
  const p = panel.getBoundingClientRect();
  if (clientX < p.left || clientX > p.right || clientY < p.top || clientY > p.bottom) {
    clearSlotHover();
    return;
  }
  const nearest = s5FindNearestSlot(clientX, clientY);
  for (const slot of selectionSlots) {
    slot.el.classList.toggle("slot-hover", slot === nearest);
  }
}

function findNearestSlot(clientX: number, clientY: number): SelectionSlot | null {
  return s5FindNearestSlot(clientX, clientY);
}

function tryDropIntoSlot(item: CombineItem, slot: SelectionSlot) {
  const newItem: SelectionSlotItem = { name: item.name, tier: item.tier, emoji: item.emoji, color: item.color };
  const sourceIdx = dragSourceSlotIndex;

  // Duplicate guard: reject if another slot (not target, not source) already has this tile
  const duplicateIdx = selectionSlots.findIndex((s) =>
    s.item !== null && s.index !== slot.index && s.index !== sourceIdx && s.item.name === newItem.name
  );
  if (duplicateIdx !== -1) {
    slot.el.classList.add("slot-reject");
    setTimeout(() => slot.el.classList.remove("slot-reject"), 500);
    if (sourceIdx !== null) {
      // Restore the source slot (tile was visually cleared on pointerdown)
      selectionSlots[sourceIdx].item = newItem;
      s5RenderSlot(selectionSlots[sourceIdx]);
      removeItem(item);
    } else {
      // Came from workspace/palette — leave the tile in the workspace near drop location
      const wsRect = workspace.getBoundingClientRect();
      item.x = Math.max(0, Math.min(wsRect.width - 72, wsRect.width / 2 - 36));
      item.y = Math.max(0, Math.min(wsRect.height - 72, wsRect.height / 2 - 36));
      item.el.style.position = "absolute";
      item.el.style.left = `${item.x}px`;
      item.el.style.top = `${item.y}px`;
      item.el.style.zIndex = "1";
    }
    return;
  }

  // Drop on same slot we came from: no-op (restore)
  if (sourceIdx === slot.index) {
    selectionSlots[sourceIdx].item = newItem;
    s5RenderSlot(selectionSlots[sourceIdx]);
    removeItem(item);
    return;
  }

  // Source is another slot → move/swap between slots
  if (sourceIdx !== null) {
    const target = slot.item;
    selectionSlots[slot.index].item = newItem;
    selectionSlots[sourceIdx].item = target; // may be null (move) or filled (swap)
    s5RenderSlot(selectionSlots[slot.index]);
    s5RenderSlot(selectionSlots[sourceIdx]);
    removeItem(item);
    posthog.capture("slot_swapped", {
      slot_index: slot.index,
      new_tile: newItem.name,
      new_tier: newItem.tier,
      ejected_tile: target?.name ?? null,
      ejected_tier: target?.tier ?? null,
      session_duration_ms: Date.now() - sessionStartTime,
    });
    s5UpdateSelectionUI();
    persistGame();
    return;
  }

  // Source is workspace/palette
  if (slot.item === null) {
    slot.item = newItem;
    s5RenderSlot(slot);
    removeItem(item);
    posthog.capture("slot_filled", {
      slot_index: slot.index,
      tile_name: newItem.name,
      tile_tier: newItem.tier,
      combinations_at_time: actionLog.length,
      session_duration_ms: Date.now() - sessionStartTime,
    });
  } else {
    // Occupied: eject the existing tile back to workspace center
    const ejected = slot.item;
    const lookup = s5FindElementData(ejected.name, ejected.tier);
    const ejectedData: ElementData = {
      name: ejected.name, tier: ejected.tier,
      emoji: ejected.emoji || lookup?.emoji || "❓",
      color: ejected.color || lookup?.color || getTheme().tokens.borderFaint,
      description: lookup?.description ?? "",
      narrative: lookup?.narrative ?? "",
    };
    slot.item = newItem;
    s5RenderSlot(slot);
    removeItem(item);
    const wsRect = workspace.getBoundingClientRect();
    spawnItem(ejectedData, wsRect.width / 2 - 36, wsRect.height / 2 - 36);
    posthog.capture("slot_swapped", {
      slot_index: slot.index,
      new_tile: newItem.name,
      new_tier: newItem.tier,
      ejected_tile: ejected.name,
      ejected_tier: ejected.tier,
      session_duration_ms: Date.now() - sessionStartTime,
    });
  }
  s5UpdateSelectionUI();
  persistGame();
}

function s5EjectFromSlot(slot: SelectionSlot) {
  if (!slot.item) return;
  const { name } = slot.item;
  slot.item = null;
  s5RenderSlot(slot);
  posthog.capture("slot_cleared", {
    slot_index: slot.index,
    tile_name: name,
    session_duration_ms: Date.now() - sessionStartTime,
  });
  s5UpdateSelectionUI();
  persistGame();
}

function s5HandleChangeEra() {
  selectFiveEraIndex = (selectFiveEraIndex + 1) % eraManager.totalEras;
  eraManager.setCurrentEraIndex(selectFiveEraIndex);
  // Soft reset: clear all workspace tiles and palette items. Collection slots persist (carry over).
  for (const item of [...items]) removeItem(item);
  paletteItems.innerHTML = "";
  // Re-roll so each Change Era into the same era produces a fresh random selection
  // (base-edition only enters each era once, so the cached selection is normally fine).
  const newSeeds = eraManager.getSeedsForEra(selectFiveEraIndex, true);
  for (const seed of newSeeds) addToPalette(seed, true);
  posthog.capture("select_five_era_changed", {
    to_era: eraManager.current.name,
    era_index: selectFiveEraIndex,
  });
  persistGame();
}

function s5HandleFinalizeClick() {
  // Defensive: only open if at least one tile is stored
  const filled = selectionSlots.filter((s) => s.item !== null).length;
  if (filled < 1) return;
  const modal = document.getElementById("finalize-intent-modal");
  if (modal) modal.classList.add("visible");
}

function s5HandleFinalizeChoice(choice: "keep" | "gift" | "continue") {
  finalizeCount++;
  if (!firstFinalizeFired) firstFinalizeFired = true;
  if (choice !== "continue") combinesSinceFinalize = 0;
  posthog.capture("select_five_finalize_intent", {
    choice,
    finalize_count: finalizeCount,
    session_duration_ms: Date.now() - sessionStartTime,
    combinations_made: actionLog.length,
    items_discovered: getDiscoveredItems().length,
    post_full_slot_changes: postFullSlotChanges,
    selected_tiles: selectionSlots.map((s) => s.item),
  });
  document.getElementById("finalize-intent-modal")?.classList.remove("visible");
  if (choice === "continue") {
    combinesSinceFinalize = 0;
    return;
  }
  s5ShowShareScreen(choice);
}

function s5ShowShareScreen(choice: "keep" | "gift") {
  const screen = document.getElementById("select-five-share-screen");
  if (!screen) return;
  const header = choice === "keep" ? "Your Collection" : "A Gift for a Friend";

  // Populate share card (single header inside the card that gets captured in PNG)
  const card = document.getElementById("select-five-share-card");
  if (card) {
    const cardHeader = card.querySelector<HTMLElement>(".s5-card-header");
    if (cardHeader) cardHeader.textContent = header;
    const tilesEl = card.querySelector<HTMLElement>(".s5-card-tiles");
    if (tilesEl) {
      tilesEl.innerHTML = selectionSlots.map((s) => {
        if (!s.item) return `<div class="s5-card-tile s5-card-tile--empty"></div>`;
        const d = s5FindElementData(s.item.name, s.item.tier);
        return `
          <div class="s5-card-tile">
            <span class="s5-card-emoji">${esc(d?.emoji ?? "❓")}</span>
            <span class="s5-card-name">${esc(s.item.name)}</span>
            <span class="s5-card-tier">${tierStars(s.item.tier)}</span>
          </div>
        `;
      }).join("");
    }
  }

  // Wire download button
  const dl = screen.querySelector<HTMLButtonElement>(".s5-share-download");
  if (dl) {
    dl.onclick = async () => {
      if (!card) return;
      try {
        const dataUrl = await toPng(card, { pixelRatio: 2, backgroundColor: getTheme().tokens.bgPage });
        const filename = choice === "keep" ? "my-collection.png" : "gift-for-a-friend.png";
        await saveImage(dataUrl, filename);
      } catch (err) {
        log.error("system", `[S5-SHARE] share failed${process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" ? `: ${err instanceof Error ? err.message : String(err)}` : ""}`);
      }
    };
  }
  // Wire continue-hunting dismiss
  const cont = screen.querySelector<HTMLButtonElement>(".s5-share-continue");
  if (cont) cont.onclick = () => screen.classList.remove("visible");

  screen.classList.add("visible");
}

if (selectFiveMode) {
  posthog.register({ experiment: "select_five" });

  // 1. Replace era-display with s5 collection panel inside a right sidebar
  const eraDisplay = document.getElementById("era-display");
  if (eraDisplay) eraDisplay.style.display = "none";
  const eraProgressEl = document.getElementById("era-progress");
  if (eraProgressEl) eraProgressEl.style.display = "none";

  // Inject the selection panel — desktop: right sibling of app;
  // small portrait phones: prepended inside the palette (re-parented via matchMedia below)
  const selectionPanel = document.createElement("aside");
  selectionPanel.id = "selection-panel";
  selectionPanel.innerHTML = `
    <h3 class="s5-title">Carry Over</h3>
    <div class="s5-scroll">
      <p class="s5-goal">Select up to 5 tiles you want to keep! These will carry over as you play and can be used for further combining.</p>
      <p class="s5-prompt">Think of tiles as custom Lego pieces. Our mission is to make digital Lego-like sets. Stay tuned for further updates on what your favorite tiles can be used for!<br>  - alwayshungry.games dev team</p>
      <div id="selection-slots">
        ${[0,1,2,3,4].map(i => `
          <div class="slot-row">
            <div class="selection-slot" data-slot="${i}"></div>
            <button class="slot-remove-btn" data-slot-idx="${i}" aria-label="Remove" hidden>×</button>
          </div>
        `).join('')}
        <div class="slot-row slot-placeholder-row" aria-hidden="true">
          <div class="selection-slot slot-placeholder"></div>
        </div>
      </div>
    </div>
    <button id="selection-finalize-btn" disabled>Finalize Collection</button>
  `;
  app.appendChild(selectionPanel);

  // Re-parent based on viewport: small portrait phones nest the collection inside palette,
  // positioned between palette-items (inventory) and bari/Change-Era so it sits below inventory.
  // On mobile portrait the Finalize button is pulled OUT of the collection frame and placed
  // between the nested panel and bari so it stays visible even when the panel scrolls.
  const s5MobileQuery = window.matchMedia("(max-width: 600px) and (orientation: portrait)");
  const reparentSelectionPanel = () => {
    const paletteEl = document.getElementById("palette");
    if (!paletteEl) return;
    const finalizeBtn = document.getElementById("selection-finalize-btn");
    const bariEl = document.getElementById("bari");
    if (s5MobileQuery.matches) {
      if (bariEl && (selectionPanel.parentElement !== paletteEl || selectionPanel.nextElementSibling !== finalizeBtn)) {
        paletteEl.insertBefore(selectionPanel, bariEl);
      }
      if (finalizeBtn && bariEl && (finalizeBtn.parentElement !== paletteEl || finalizeBtn.previousElementSibling !== selectionPanel)) {
        paletteEl.insertBefore(finalizeBtn, bariEl);
      }
    } else {
      // Desktop: move finalize button back inside the panel (bottom)
      if (finalizeBtn && finalizeBtn.parentElement !== selectionPanel) {
        selectionPanel.appendChild(finalizeBtn);
      }
      if (selectionPanel.parentElement !== app) app.appendChild(selectionPanel);
    }
  };
  s5MobileQuery.addEventListener("change", reparentSelectionPanel);
  reparentSelectionPanel();
  // Store on app element so cleanup can remove it
  (app as HTMLElement & { __s5Cleanup?: () => void }).__s5Cleanup = () => {
    s5MobileQuery.removeEventListener("change", reparentSelectionPanel);
  };

  // Populate selectionSlots[] — exclude placeholder (has no data-slot)
  selectionPanel.querySelectorAll<HTMLElement>(".selection-slot[data-slot]").forEach((el, i) => {
    const slot: SelectionSlot = { index: i, el, item: null };
    selectionSlots.push(slot);
  });

  // Wire X-button click handlers once (buttons are permanent DOM, toggled via hidden attribute)
  selectionPanel.querySelectorAll<HTMLButtonElement>(".slot-remove-btn[data-slot-idx]").forEach((btn) => {
    const idx = Number(btn.dataset.slotIdx);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const slot = selectionSlots[idx];
      if (slot) s5EjectFromSlot(slot);
    });
  });

  // 2. Change restart button to "Change Era" with a warning caption beneath it
  restartButton.removeEventListener("click", handleRestart);
  restartButton.textContent = "Change Era";
  restartButton.addEventListener("click", s5HandleChangeEra);
  if (!document.getElementById("s5-change-era-warning")) {
    const warning = document.createElement("div");
    warning.id = "s5-change-era-warning";
    warning.textContent = "⚠️ Warning: Resets Inventory and Items on Board";
    restartButton.insertAdjacentElement("afterend", warning);
  }

  // 3. Hide main-game overlays that don't apply
  ["victory-overlay", "era-summary-overlay", "era-toast", "scoreboard-btn", "scoreboard-overlay", "tapestry-overlay"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  // 4. Inject finalize intent modal and share screen
  const s5Overlays = document.createElement("div");
  s5Overlays.id = "s5-overlays";
  s5Overlays.innerHTML = `
    <div id="finalize-intent-modal">
      <div class="s5-modal-panel">
        <h3 class="s5-modal-title">Ready to commit? You can always keep exploring.</h3>
        <div class="s5-modal-buttons">
          <button class="s5-btn-keep">Keep for yourself</button>
          <button class="s5-btn-gift">Gift to a friend</button>
          <button class="s5-btn-continue">Continue hunting</button>
        </div>
      </div>
    </div>
    <div id="select-five-share-screen">
      <div class="s5-share-panel">
        <div id="select-five-share-card">
          <h3 class="s5-card-header">Your Collection</h3>
          <div class="s5-card-tiles"></div>
          <div class="s5-card-footer">tiered.fun</div>
        </div>
        <div class="s5-share-actions">
          <button class="s5-share-download">Download</button>
          <button class="s5-share-continue">Continue hunting</button>
        </div>
      </div>
    </div>
  `;
  app.appendChild(s5Overlays);

  // 5. Wire intent modal buttons
  s5Overlays.querySelector<HTMLButtonElement>(".s5-btn-keep")?.addEventListener("click", () => s5HandleFinalizeChoice("keep"));
  s5Overlays.querySelector<HTMLButtonElement>(".s5-btn-gift")?.addEventListener("click", () => s5HandleFinalizeChoice("gift"));
  s5Overlays.querySelector<HTMLButtonElement>(".s5-btn-continue")?.addEventListener("click", () => s5HandleFinalizeChoice("continue"));

  // 6. Wire finalize button
  document.getElementById("selection-finalize-btn")?.addEventListener("click", s5HandleFinalizeClick);

  // 7. Restore slots if save had them. Older saves stored only {name, tier}; look up emoji/color
  // by walking eraManager seeds, then recipe cache, falling back to a neutral placeholder.
  if (pendingS5SlotRestore) {
    for (let i = 0; i < selectionSlots.length; i++) {
      const raw = pendingS5SlotRestore[i];
      if (!raw) { selectionSlots[i].item = null; continue; }
      if (raw.emoji && raw.color) {
        selectionSlots[i].item = { name: raw.name, tier: raw.tier, emoji: raw.emoji, color: raw.color };
      } else {
        const data = s5FindElementData(raw.name, raw.tier);
        selectionSlots[i].item = {
          name: raw.name, tier: raw.tier,
          emoji: data?.emoji ?? "❓",
          color: data?.color ?? getTheme().tokens.borderFaint,
        };
      }
    }
    pendingS5SlotRestore = null;
  }
  for (const slot of selectionSlots) s5RenderSlot(slot);
  s5UpdateSelectionUI();
  // Don't log all-filled again if already filled from restore
  if (selectionSlots.every((s) => s.item !== null)) hasLoggedAllFilled = true;

  // 8. Enable dragging FROM slots: pointerdown on an occupied slot spawns a workspace tile and starts drag
  selectionPanel.addEventListener("pointerdown", (e) => {
    const slotEl = (e.target as HTMLElement).closest<HTMLElement>(".selection-slot");
    if (!slotEl) return;
    if ((e.target as HTMLElement).closest(".slot-remove-btn")) return; // handled separately
    const idx = Number(slotEl.dataset.slot);
    const slot = selectionSlots[idx];
    if (!slot?.item) return;
    e.preventDefault();
    // Slots behave like inventory: dragging spawns a reusable copy and leaves the slot filled.
    // Removal is only via the X button. Use a fuller lookup for description/narrative, but fall
    // back to slot.item's stored emoji/color so the spawn never shows a ? (fixes stale-seed bug).
    const lookup = s5FindElementData(slot.item.name, slot.item.tier);
    const data: ElementData = {
      name: slot.item.name,
      tier: slot.item.tier,
      emoji: slot.item.emoji || lookup?.emoji || "❓",
      color: slot.item.color || lookup?.color || getTheme().tokens.borderFaint,
      description: lookup?.description ?? "",
      narrative: lookup?.narrative ?? "",
    };
    const wsRect = workspace.getBoundingClientRect();
    const item = spawnItem(data, e.clientX - wsRect.left - 36, e.clientY - wsRect.top - 36);
    dragItem = item;
    dragSourceSlotIndex = null;
    dragOffsetX = 36;
    dragOffsetY = 36;
    item.el.style.position = "fixed";
    item.el.style.left = `${e.clientX - 36}px`;
    item.el.style.top = `${e.clientY - 36}px`;
    item.el.style.zIndex = "100";
  });
}

// --- Document-level pointer drag handlers ---
// Items use position:fixed while being dragged so they render above the palette
// sidebar regardless of stacking context. On drop they convert back to absolute.
const handlePointerMove = (e: PointerEvent) => {
  if (!dragItem) return;
  // Lock out native horizontal scroll on the inventory + chapter strip while
  // a tile is in flight. Without this, a sideways finger can yank the strip
  // out from under the dragged tile, which the browser interprets as
  // pointercancel — the tile drops at its last position. CSS hooks the
  // body[data-dragging] attribute to set overflow-x: hidden on those rows.
  if (document.body.dataset.dragging !== "true") {
    document.body.dataset.dragging = "true";
  }
  dragItem.el.style.left = `${e.clientX - dragOffsetX}px`;
  dragItem.el.style.top = `${e.clientY - dragOffsetY}px`;
  // Keep workspace-relative coords in sync for overlap detection
  const rect = workspace.getBoundingClientRect();
  dragItem.x = e.clientX - dragOffsetX - rect.left;
  dragItem.y = e.clientY - dragOffsetY - rect.top;
  updateOverlapGlow(dragItem);
  updateEraIdeaSlotHover(e.clientX, e.clientY);
  if (selectFiveMode) updateSlotHover(e.clientX, e.clientY);
};

// Workspace caption helper — the italic line under the writing desk frame.
// Default state pulled from the active theme (Bibliophile = "— the writing
// desk —"). During a combine the caption switches to "— thinking —", and on
// completion to "From X and Y came Z" for a few seconds before reverting.
// Replaces the previous result toast. The "— thinking —" indicator is shared
// across themes (it's about progress feedback, not voice), so it stays a
// constant here.
const WORKSPACE_CAPTION_DEFAULT = (): string => getTheme().copy.workspaceCaption;
const WORKSPACE_CAPTION_THINKING = "— thinking —";
let workspaceCaptionRevertTimer: number | null = null;
function setWorkspaceCaption(text: string, revertAfterMs: number | null = null): void {
  const el = document.getElementById("workspace-caption");
  if (!el) return;
  el.textContent = text;
  if (workspaceCaptionRevertTimer !== null) {
    window.clearTimeout(workspaceCaptionRevertTimer);
    workspaceCaptionRevertTimer = null;
  }
  if (revertAfterMs !== null) {
    workspaceCaptionRevertTimer = window.setTimeout(() => {
      const cur = document.getElementById("workspace-caption");
      if (cur) cur.textContent = WORKSPACE_CAPTION_DEFAULT();
    }, revertAfterMs);
  }
}

/** Highlight the era-idea slot while a workspace tile is dragged over it.
 *  Uses tile-rect-vs-slot-rect overlap (same as the actual drop hit-test in
 *  handlePointerUp) so the gilt highlight predicts the real outcome. */
function updateEraIdeaSlotHover(_clientX: number, _clientY: number): void {
  const wrapper = document.getElementById("era-idea-slot-wrapper");
  const slotEl = document.getElementById("era-idea-slot");
  if (!wrapper || !slotEl || !dragItem) return;
  if (wrapper.hasAttribute("hidden") || pendingEraIdeaTile) {
    slotEl.classList.remove("slot-hover");
    return;
  }
  const slotRect = slotEl.getBoundingClientRect();
  const tileRect = dragItem.el.getBoundingClientRect();
  const overlaps =
    tileRect.right >= slotRect.left &&
    tileRect.left <= slotRect.right &&
    tileRect.bottom >= slotRect.top &&
    tileRect.top <= slotRect.bottom;
  slotEl.classList.toggle("slot-hover", overlaps);
}

const handlePointerUp = (e: PointerEvent) => {
  if (!dragItem) return;
  const item = dragItem;
  dragItem = null;
  document.body.removeAttribute("data-dragging");
  clearAllGlow();
  clearSlotHover();
  document.getElementById("era-idea-slot")?.classList.remove("slot-hover");

  // Select-five: check if dropped into selection panel
  if (selectFiveMode) {
    const panel = document.getElementById("selection-panel");
    if (panel) {
      const p = panel.getBoundingClientRect();
      const overPanel = e.clientX >= p.left && e.clientX <= p.right && e.clientY >= p.top && e.clientY <= p.bottom;
      if (overPanel) {
        const slot = findNearestSlot(e.clientX, e.clientY);
        if (slot) {
          tryDropIntoSlot(item, slot);
          dragSourceSlotIndex = null;
          return;
        }
      }
    }
    // If drag came from a slot but wasn't dropped in a slot, eject to workspace
    if (dragSourceSlotIndex !== null) {
      // Item is already on workspace (spawned on drag start) — standard drop logic applies
      dragSourceSlotIndex = null;
    }
  }

  // Era idea-slot drop (only when slot wrapper is shown — i.e. era ready to advance).
  // Per spec §2.4 / §3.3, dropping puts the tile into an *idle* hold-arc state on
  // the plate. A SEPARATE press-and-hold gesture on the slot fills the arc; release
  // before 2.5s cancels (tile stays in the slot, ready for retry); reaching 2.5s
  // commits. The "Release" button drags the tile back out to the workspace.
  const ideaWrapper = document.getElementById("era-idea-slot-wrapper");
  if (ideaWrapper && !ideaWrapper.hasAttribute("hidden") && !bindHoldHandle) {
    const slotEl = document.getElementById("era-idea-slot");
    if (slotEl) {
      // Hit-test by tile-rect-vs-slot-rect overlap rather than cursor
      // point. With the cursor-only test, releasing slightly off the slot
      // while the tile body still overlapped it would fall through to the
      // outside-workspace branch below and silently remove the tile.
      const slotRect = slotEl.getBoundingClientRect();
      const tileRect = item.el.getBoundingClientRect();
      const tileOverlapsSlot =
        tileRect.right >= slotRect.left &&
        tileRect.left <= slotRect.right &&
        tileRect.bottom >= slotRect.top &&
        tileRect.top <= slotRect.bottom;
      if (tileOverlapsSlot) {
        pendingEraIdeaTile = {
          name: item.name,
          tier: item.tier,
          emoji: item.emoji,
          color: item.color,
          description: item.description,
          narrative: item.narrative,
        };
        renderEraIdeaSlot();
        removeItem(item);
        startPressAndHoldPulses();
        return;
      }
    }
  }

  const rect = workspace.getBoundingClientRect();

  // If released outside the workspace, remove the item
  if (e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top || e.clientY > rect.bottom) {
    removeItem(item);
    return;
  }

  // Convert from fixed back to absolute positioning within the workspace
  item.x = e.clientX - dragOffsetX - rect.left;
  item.y = e.clientY - dragOffsetY - rect.top;
  item.el.style.position = 'absolute';
  item.el.style.left = `${item.x}px`;
  item.el.style.top = `${item.y}px`;
  item.el.style.zIndex = "1";
  // Writing-desk drop feedback (audio + visual + haptic):
  //   - desk-tap: paper-on-wood thud
  //   - ink-bleed ring: annular gilt halo emanating around the tile
  //   - tile settling: scale-press (1.06 → 0.95 → 1.02 → 1.0) over 280ms,
  //     reads as the tile finding its place
  //   - 10ms haptic tap on touch devices
  audio.playDeskTap();
  spawnInkBleedRing(item);
  item.el.classList.add("settling");
  setTimeout(() => item.el.classList.remove("settling"), 300);
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(10);
  }
  posthog.capture('tile_placed', {
    item: item.name,
    tier: item.tier,
    x: Math.round(item.x),
    y: Math.round(item.y),
    era_name: eraNameForAnalytics(),
    from_slot: dragSourceSlotIndex !== null,
  });
  checkOverlap(item);
};

// Brief gilt halo emanating from the tile's bookplate border. We measure the
// tile's actual rendered bounds at spawn-time and size/position the halo to
// match exactly, so the box-shadow always emanates symmetrically around the
// tile regardless of any tile-size CSS changes or transforms in flight.
function spawnInkBleedRing(item: CombineItem) {
  const ring = document.createElement("div");
  ring.className = "ink-bleed-ring";
  const tileRect = item.el.getBoundingClientRect();
  const wsRect = workspace.getBoundingClientRect();
  ring.style.left = `${tileRect.left - wsRect.left}px`;
  ring.style.top = `${tileRect.top - wsRect.top}px`;
  ring.style.width = `${tileRect.width}px`;
  ring.style.height = `${tileRect.height}px`;
  workspace.appendChild(ring);
  setTimeout(() => ring.remove(), 460);
}

document.addEventListener("pointermove", handlePointerMove);
document.addEventListener("pointerup", handlePointerUp);
// setPointerCapture in attachDragToSpawn keeps the browser from yanking the
// gesture for scroll, so pointercancel here is the rare system-level case
// (notification, app switch). Route it through handlePointerUp so the drag
// terminates cleanly — without this, dragItem would dangle and the next
// pointermove would still be moving a ghost tile.
document.addEventListener("pointercancel", (e) => {
  document.body.removeAttribute("data-dragging");
  if (dragItem) handlePointerUp(e);
});

// First user gesture resumes the AudioContext — browsers block autoplay until
// the user interacts with the page (Chrome/Safari/Firefox autoplay policy).
const resumeAudioOnce = () => {
  audio.resume();
  document.removeEventListener("pointerdown", resumeAudioOnce);
  document.removeEventListener("keydown", resumeAudioOnce);
};
document.addEventListener("pointerdown", resumeAudioOnce);
document.addEventListener("keydown", resumeAudioOnce);

// --- HTML escape — always use for AI-generated content inserted via innerHTML ---
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// --- Tier stars helper ---
function tierStars(tier: Tier): string {
  return "\u2B50".repeat(tier);
}

// --- Spawn a combine item in the workspace ---
function spawnItem(data: ElementData, x: number, y: number): CombineItem {
  const el = document.createElement("div");
  el.className = "combine-item";
  el.style.background = data.color;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.innerHTML = `
    <span class="item-emoji">${esc(data.emoji)}</span>
    <span class="item-name">${esc(data.name)}</span>
    <span class="tier-stars">${tierStars(data.tier)}</span>
    <div class="tooltip">
      <div class="tooltip-desc">${esc(data.description)}</div>
      <div class="tooltip-narrative">${esc(data.narrative)}</div>
    </div>
  `;
  workspace.appendChild(el);

  const item: CombineItem = {
    id: `item-${idCounter++}`,
    ...data,
    el,
    x,
    y,
  };
  items.push(item);
  updateOnboardingPulses();

  // --- Start drag on pointerdown (move/up handled at document level) ---
  // Mouse drags begin immediately. Touch / pen arms a 600ms long-press
  // alongside drag detection: motion > 8px commits drag (and closes any
  // open info popup); 600ms with motion ≤ 8px opens the bookplate info
  // sheet. After the popup opens, a follow-up move still commits drag and
  // closes the popup, so the player can peek-then-drag in one gesture.
  const beginWorkspaceDrag = (clientX: number, clientY: number) => {
    closeTileInfo();
    dragItem = item;
    dragSourceSlotIndex = null;
    const wsRect = workspace.getBoundingClientRect();
    dragOffsetX = clientX - item.x - wsRect.left;
    dragOffsetY = clientY - item.y - wsRect.top;
    // Switch to fixed so the tile renders above the palette/selection panel during drag
    el.style.position = 'fixed';
    el.style.left = `${clientX - dragOffsetX}px`;
    el.style.top = `${clientY - dragOffsetY}px`;
    el.style.zIndex = "100";
  };

  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (e.pointerType === "mouse") {
      beginWorkspaceDrag(e.clientX, e.clientY);
      return;
    }
    const startX = e.clientX;
    const startY = e.clientY;
    let resolved = false;
    const longPressTimer = window.setTimeout(() => {
      if (resolved) return;
      // Don't mark resolved — leave the popup open while the finger may
      // still start a drag. beginWorkspaceDrag (called from onMove past
      // threshold) closes the popup if it's open.
      openTileInfo({
        name: item.name,
        tier: item.tier,
        emoji: item.emoji,
        color: item.color,
        description: item.description,
        narrative: item.narrative,
      });
    }, 600);
    const onMove = (m: PointerEvent) => {
      if (resolved) return;
      const dx = Math.abs(m.clientX - startX);
      const dy = Math.abs(m.clientY - startY);
      if (dx > 8 || dy > 8) {
        resolved = true;
        clearTimeout(longPressTimer);
        cleanup();
        beginWorkspaceDrag(m.clientX, m.clientY);
      }
    };
    const onUp = () => {
      resolved = true;
      clearTimeout(longPressTimer);
      cleanup();
    };
    const cleanup = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  });

  return item;
}

// --- Overlap glow helpers ---
function findOverlap(dragged: CombineItem): CombineItem | null {
  for (const other of items) {
    if (other.id === dragged.id) continue;
    const dx = dragged.x - other.x;
    const dy = dragged.y - other.y;
    if (Math.sqrt(dx * dx + dy * dy) < 48) return other;
  }
  return null;
}

function clearAllGlow() {
  for (const item of items) {
    item.el.classList.remove("glow-green", "glow-red", "combo-reject");
  }
}

function updateOverlapGlow(dragged: CombineItem) {
  clearAllGlow();
  const other = findOverlap(dragged);
  if (!other) return;

  if (dragged.name === other.name || dragged.tier === 5 || other.tier === 5) {
    dragged.el.classList.add("glow-red");
    other.el.classList.add("glow-red", "combo-reject");
  } else {
    dragged.el.classList.add("glow-green");
    other.el.classList.add("glow-green");
  }
}

// --- Check if the dropped item overlaps another; if so, combine ---
function checkOverlap(dropped: CombineItem) {
  if (busy) return;
  const other = findOverlap(dropped);
  if (!other) return;
  if (dropped.name === other.name || dropped.tier === 5 || other.tier === 5) {
    // Rejected pairing — same name (would dup) or one side is tier-5 (capped).
    // Spec §6 failed-combine shake: 240ms, ±3px, dim 100→80→100. Plus the
    // ink-bloom-fail audio cue (gated by audio kill-switch).
    void playFailedCombineShake(dropped.el);
    void playFailedCombineShake(other.el);
    audio.playInkwellTap();
    return;
  }
  combine(dropped, other);
}

// --- Combine two items into a new one ---
async function combine(a: CombineItem, b: CombineItem) {
  if (busy) return;
  pendingCombines++;
  const key = recipeKey(a.name, b.name);
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;

  // Onboarding hooks into these so its 5-frame guided flow can react.
  document.dispatchEvent(new CustomEvent("game:combine-start", {
    detail: { a: a.name, b: b.name },
  }));

  // Switch the writing-desk caption to its "thinking" state for the
  // duration of the combine. Replaces the previous result-toast affordance.
  setWorkspaceCaption(WORKSPACE_CAPTION_THINKING);

  // Combine-press cue at the moment of combination intent (woody knock with
  // ±2st pitch variation). Pairs with playIdeaBloom() at completion when the
  // new tile materializes — press first, bloom on resolve.
  audio.playCombineKnock();

  // Remove parents and show combining placeholder
  removeItem(a);
  removeItem(b);

  const placeholder = document.createElement("div");
  placeholder.className = "combine-placeholder";
  placeholder.style.left = `${midX}px`;
  placeholder.style.top = `${midY}px`;
  placeholder.innerHTML = `<span class="placeholder-emoji">${a.emoji}</span><span class="placeholder-plus">\u2728</span><span class="placeholder-emoji">${b.emoji}</span>`;
  workspace.appendChild(placeholder);

  // Check recipe store (cached AI results)
  let isCacheHit = false;
  let elementData = await recipeStore.get(key);

  if (elementData) {
    isCacheHit = true;
    log.debug("game", `Cache hit: ${key} → ${elementData.name}`);
    // Onboarding ceremony pause: hold the combine placeholder visible for 5s
    // so the player feels the "held breath" beat from spec §3.1 Frame 04 even
    // though the recipe is pre-cached. Triggered only on the first guided
    // Fire+Wood combine.
    const onboardingFrame = document.documentElement.dataset.onboarding;
    const isGuidedFirstCombine =
      (onboardingFrame === "guide" || onboardingFrame === "merging") &&
      key === recipeKey("Fire", "Wood");
    if (isGuidedFirstCombine) await wait(5000);
  } else {
    const childTier = Math.min(Math.max(a.tier, b.tier) + 1, 5) as Tier;

    log.info("player", `Combining: ${a.name} + ${b.name} → tier ${childTier}`);
    bari.classList.add("active");

    // AI-thinking phase machine — Bari's posture shifts at 8s / 16s / 24s
    // thresholds. The workspace caption stays at "— thinking —" throughout
    // (set at combine start above); the manifest's per-phase copy is no
    // longer surfaced now that the result-toast affordance is gone.
    const thinking = startAiThinking({
      onPhase: (phase) => {
        if (phase === "resolved") return;
        bari.classList.toggle("bari--leaning", phase === "longer");
        bari.classList.toggle("bari--patient", phase === "long");
        bari.classList.toggle("bari--very-patient", phase === "veryLong");
      },
    });

    try {
      const template = await promptProvider.getPrompt(childTier, eraManager.current.name);
      const prompt = template.replace("{{a}}", a.name).replace("{{b}}", b.name);
      log.debug("api", `Calling ${selectedModel} for ${a.name} + ${b.name}`);
      const result = await combineElements(selectedModel, prompt, childTier, eraManager.current.name, getOrCreateAnonId(), runId);
      elementData = { ...result, tier: childTier };
      await recipeStore.set(key, elementData);
      log.info("api", `Result: ${result.emoji} ${result.name} (${result.color})`);
      thinking.resolve();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error("api", `[CMB] Combine failed${process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" ? `: ${msg}` : ""}`);
      thinking.fail();
      if (msg.includes("gcloud auth") || msg.includes("invalid_grant") || msg.includes("RAPT")) {
        showEraToast("\u26A0\uFE0F Auth Expired", "GCP credentials have expired. Run this in your terminal:\n\ngcloud auth application-default login\n\nThen try combining again.");
      }
      elementData = {
        name: `${a.name}+${b.name}`,
        color: getTheme().tokens.accentSecondary,
        tier: childTier,
        emoji: "\u2753",
        description: "Something went wrong in the fusion.",
        narrative: "The elements resisted combination. Perhaps the cosmos wasn't ready.",
      };
    }
    bari.classList.remove("active", "bari--leaning", "bari--patient", "bari--very-patient");
  }

  // Remove placeholder and spawn child
  placeholder.remove();
  const child = spawnItem(elementData, midX, midY);
  child.el.classList.add("merging");
  setTimeout(() => child.el.classList.remove("merging"), 400);

  // Idea-bloom cue: soft sine-pad swell + paper sparkle + tiny chime, ~600ms,
  // matches the visual ink-bloom of the new tile materializing.
  audio.playIdeaBloom();

  document.dispatchEvent(new CustomEvent("game:combine-end", {
    detail: {
      result: elementData.name,
      emoji: elementData.emoji,
      tier: elementData.tier,
      childEl: child.el,
    },
  }));

  // Caption surfaces the result line, then reverts to the writing-desk
  // default after 4s. Replaces the previous result-toast affordance.
  setWorkspaceCaption(
    `From ${a.emoji} ${a.name} and ${b.emoji} ${b.name} came ${elementData.emoji} ${elementData.name}`,
    4000,
  );
  const isFirstDiscovery = !paletteItems.querySelector(`[data-name="${elementData.name}"]`);
  addToPaletteIfNew(elementData);
  posthog.capture('combination_created', {
    item_a: a.name,
    item_b: b.name,
    result: elementData.name,
    result_tier: elementData.tier,
    is_cache_hit: isCacheHit,
    model: selectedModel,
    era_name: eraNameForAnalytics(),
  });
  if (isFirstDiscovery) {
    posthog.capture('item_discovered', {
      item: elementData.name,
      tier: elementData.tier,
      era_name: eraNameForAnalytics(),
    });
  }

  // Log action
  const entry: ActionLogEntry = {
    timestamp: Date.now(),
    parentA: a.name,
    parentB: b.name,
    result: elementData.name,
    resultTier: elementData.tier,
  };
  actionLog.push(entry);
  if (selectFiveMode && actionLog.length > MAX_ACTION_LOG) actionLog.splice(0, actionLog.length - MAX_ACTION_LOG);
  eraActionLog.push(entry);

  if (!selectFiveMode && eraManager.markTierGoalIfMet(elementData.tier)) renderGoals();

  persistGame();
  pendingCombines--;

  if (selectFiveMode) {
    if (firstFinalizeFired) {
      combinesSinceFinalize++;
      posthog.capture('select_five_post_finalize_combine', {
        combinations_since_finalize: combinesSinceFinalize,
        session_duration_ms: Date.now() - sessionStartTime,
      });
    }
    return;
  }

  checkEraAdvancement();
}

function removeItem(item: CombineItem) {
  item.el.remove();
  const idx = items.indexOf(item);
  if (idx !== -1) items.splice(idx, 1);
  updateOnboardingPulses();
}

// --- Era advancement ---
function getDiscoveredItems(): string[] {
  return Array.from(
    paletteItems.querySelectorAll("[data-name]"),
    (el) => el.getAttribute("data-name")!
  );
}

async function checkEraAdvancement() {
  if (victoryShown) return; // Age of Plenty — free-build mode, no more advancement
  if (eraAdvancing) {
    // Player combined again while era is advancing — debounce a fresh pipeline,
    // but only if we haven't already committed to the transition (busy = true).
    if (!busy) scheduleAdvancementPipeline();
    return;
  }
  log.debug("era", "Checking era advancement...");

  const tier5Count = eraActionLog.filter((e) => e.resultTier === 5).length;
  const inventory = Array.from(
    paletteItems.querySelectorAll<HTMLElement>("[data-name][data-tier]"),
    (el) => ({ name: el.dataset.name!, tier: Number(el.dataset.tier) }),
  ).filter((item) => item.tier > 1).map((item) => item.name);

  // Snapshot which AI conditions were already met so we can flash narratives
  // for the newly-met ones after the API check resolves.
  const aiGoalRef = eraManager.current.goals.find((g) => g.minTier === undefined);
  const wasMetSet = new Set(
    aiGoalRef?.conditions.filter((c) => c.met).map((c) => c.description) ?? [],
  );

  const result = await eraManager.checkAdvancement(
    eraActionLog,
    inventory,
    tier5Count,
    selectedModel,
    getOrCreateAnonId(),
    runId,
  );

  renderGoals();

  // Auto-pop newly-met goal narratives for ~3s, then fade. Queued sequentially.
  if (aiGoalRef) {
    for (const c of aiGoalRef.conditions) {
      if (c.met && c.narrative && !wasMetSet.has(c.description)) {
        flashGoalNarrative(c.narrative);
      }
    }
  }

  if (!result) return;
  if (eraAdvancing) return; // another call won the race while we awaited

  // Spec §3.3 Bind-A: last objective ticks → singing-bowl strike (~1.4s tail).
  audio.playSingingBowl();

  eraAdvancing = true;
  pendingEraResult = result;
  chartEraBtn.classList.add("visible");
  showEraIdeaSlot();
  runAdvancementPipeline(); // first pipeline fires immediately — no debounce
}

function scheduleAdvancementPipeline() {
  if (eraAdvancementDebounceTimer) clearTimeout(eraAdvancementDebounceTimer);
  pipelineDebounceIndicator = true;
  updatePipelineHud();
  eraAdvancementDebounceTimer = setTimeout(() => {
    eraAdvancementDebounceTimer = null;
    pipelineDebounceIndicator = false;
    runAdvancementPipeline();
  }, 1_000);
}

async function runAdvancementPipeline() {
  if (!eraAdvancing) return;

  // Register this run in the HUD
  const run: PipelineRun = {
    id: ++pipelineRunSeq,
    snapshotAt: Date.now(),
    eraStatus: 'pending',
    tapestryStatus: 'waiting',
  };
  pipelineRuns.push(run);
  if (pipelineRuns.length > 6) pipelineRuns.shift();
  updatePipelineHud();

  // Snapshot the current game state at the moment this pipeline fires
  const snapInventory = getDiscoveredItems();
  const snapActions = [...eraActionLog];
  const snapAt = Date.now();
  const snap: EraSnapshot = {
    fromEra: eraManager.current.name,
    completedAt: snapAt,
    actions: snapActions,
    inventory: snapInventory,
    tapestryGameData: buildTapestryGameData({ completedAt: snapAt, discoveredItems: snapInventory, completedEraActions: snapActions }),
    eraStartedAt,
    spawnCounts: { ...eraSpawnCounts },
    spawnByTier: { ...eraSpawnByTier },
  };
  latestEraSnapshot = snap;

  // Choose next era (or generate victory narrative)
  let choice: { era: Era; narrative: string };
  try {
    if (eraManager.isLastEra) {
      const narrative = await eraManager.generateAdvancementNarrative(snap.actions, snap.inventory, selectedModel, "the Age of Plenty");
      choice = { era: { name: "the Age of Plenty", seeds: [], goals: [], order: 9999 }, narrative: narrative ?? pendingEraResult!.narrative };
    } else {
      choice = await eraManager.chooseNextEra(snap.actions, snap.inventory, selectedModel, getOrCreateAnonId(), runId);
    }
  } catch {
    run.eraStatus = 'error';
    updatePipelineHud();
    return;
  }
  if (!eraAdvancing) return;
  run.eraStatus = 'done';
  run.eraName = choice.era.name;
  run.tapestryStatus = 'inflight';
  latestEraChoice = choice;
  updatePipelineHud();

  // Fire tapestry generation — no await, store promise as latest
  startTapestryGeneration(choice.narrative, snap.fromEra, choice.era.name, snap.tapestryGameData);
  latestTapestryPromise = tapestryPromise;

  // Track completion for HUD
  tapestryPromise?.then(result => {
    run.tapestryStatus = result?.base64 ? 'done' : 'error';
    updatePipelineHud();
  });
}

async function doEraTransition(result: { narrative: string }) {
  // Stop any pending pipeline debounce — we're committing to the latest snapshot now
  if (eraAdvancementDebounceTimer) {
    clearTimeout(eraAdvancementDebounceTimer);
    eraAdvancementDebounceTimer = null;
  }

  try {
    // Use snapshot from background pipeline if available, otherwise build it now
    const snap = latestEraSnapshot;
    const inventory = snap?.inventory ?? getDiscoveredItems();
    const completedAt = snap?.completedAt ?? Date.now();
    const completedEraActions = snap?.actions ?? [...eraActionLog];
    const completedEraStartedAt = snap?.eraStartedAt ?? eraStartedAt;
    const completedEraSpawnCounts = snap?.spawnCounts ?? { ...eraSpawnCounts };
    const completedEraSpawnByTier = snap?.spawnByTier ?? { ...eraSpawnByTier };

    const fromEra = snap?.fromEra ?? eraManager.current.name;
    const eraNumber = eraManager.history.length + 1;
    const combinationsInEra = eraActionLog.length;
    const itemsDiscoveredInEra = inventory.length;

    const tapestryGameData = snap?.tapestryGameData ?? buildTapestryGameData({
      completedAt,
      discoveredItems: inventory,
      completedEraActions,
    });
    eraManager.recordHistory(completedEraActions, result.narrative, inventory, completedEraStartedAt, completedAt, completedEraSpawnCounts, completedEraSpawnByTier);

    // Attach the player's idea-tile pick (captured by the slot above #chart-era-btn) to the
    // just-recorded era and fire-and-forget persistence to the user's account.
    if (pendingEraIdeaTile) {
      const picked = pendingEraIdeaTile;
      const newRecord = eraManager.history[eraManager.history.length - 1];
      const pick: EraIdeaTilePick = {
        name: picked.name,
        tier: picked.tier,
        emoji: picked.emoji,
        color: picked.color,
        description: picked.description,
        narrative: picked.narrative,
        pickedAt: Date.now(),
      };
      newRecord.ideaTilePick = pick;
      void persistEraIdeaTile(newRecord.eraName, pick);
      pendingEraIdeaTile = null;
      renderEraIdeaSlot();
      renderEraProgress();
    }

    eraActionLog = [];
    eraStartedAt = Date.now();
    eraSpawnCounts = {};
    eraSpawnByTier = {};

    // Use tapestry promise from background pipeline if one is in flight/ready
    if (latestTapestryPromise) tapestryPromise = latestTapestryPromise;

    // Clear pipeline state
    latestEraSnapshot = null;
    const preComputedChoice = latestEraChoice;
    latestEraChoice = null;
    latestTapestryPromise = null;

    if (eraManager.isLastEra) {
      log.info("era", "VICTORY — Space Age completed!");
      let victoryNarrative: string | null = preComputedChoice?.narrative ?? null;
      if (!victoryNarrative) {
        showToast("Bari is weaving the tapestry of ages...", null);
        bari.classList.add("active");
        victoryNarrative = await eraManager.generateAdvancementNarrative(actionLog, inventory, selectedModel, "the Age of Plenty");
        bari.classList.remove("active");
      }
      if (!tapestryPromise) {
        startTapestryGeneration(victoryNarrative ?? result.narrative, fromEra, "the Age of Plenty", tapestryGameData);
      }
      clearSave();
      victoryShown = true;
      // Run-end ceremony (spec §3.8): wax seal stamps onto the strip, cathedral
      // bell rings (the only place this sound exists), heavy thud haptic, then
      // the Age of Plenty overlay rises. The bell is wired through audio.* and
      // produces silence today (audio kill-switch is on), but the timing is in
      // place so flipping the switch lights the moment up.
      await playRunEndSeal();
      audio.playCathedralBell();
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate([60, 40, 30]);
      }
      showVictory(victoryNarrative ?? undefined);
      return; // busy + eraAdvancing stay true until player clicks Continue Building
    }

    let choice: { era: Era; narrative: string };
    // Guard against a stale pre-computed choice leaking across era boundaries —
    // a background pipeline that started in an earlier era may have finished
    // late and written `latestEraChoice` pointing at the current era or one
    // behind it. Only use it when its target era is strictly ahead.
    if (preComputedChoice && preComputedChoice.era.order > eraManager.current.order) {
      choice = preComputedChoice;
    } else {
      showToast("Bari is charting the next age...", null);
      bari.classList.add("active");
      choice = await eraManager.chooseNextEra(actionLog, inventory, selectedModel, getOrCreateAnonId(), runId);
      bari.classList.remove("active");
    }

    // If background pipeline didn't start tapestry yet, start it now
    if (!tapestryPromise) {
      startTapestryGeneration(choice.narrative, fromEra, choice.era.name, tapestryGameData);
    }

    const nextEra = eraManager.advanceTo(choice.era.name);
    if (nextEra) {
      log.info("era", `Era advanced to: ${nextEra.name}`);
      posthog.capture('era_advanced', {
        from_era: fromEra,
        to_era: nextEra.name,
        era_number: eraNumber,
        combinations_in_era: combinationsInEra,
        items_discovered_in_era: itemsDiscoveredInEra,
      });

      const completedRecord = eraManager.history[eraManager.history.length - 1];
      showEraSummary(completedRecord!, nextEra.name, choice.narrative, async () => {
        for (const item of [...items]) removeItem(item);
        paletteItems.innerHTML = "";
        const newSeeds = eraManager.getSeeds();
        log.info("era", `Seeds: ${newSeeds.map((s) => s.name).join(", ")}`);
        for (const seed of newSeeds) addToPalette(seed, true);
        renderEraName();
        renderGoals();
        persistGame();
        busy = false;
        eraAdvancing = false;
        // Drop any pipeline state that might have been written while the player
        // was reading the summary — prevents a late-arriving stale result from
        // an earlier-era pipeline leaking into the next transition.
        latestEraSnapshot = null;
        latestEraChoice = null;
        latestTapestryPromise = null;
        // Frontispiece is now embedded in the era-summary spread itself (Phase 2),
        // so the standalone tapestry overlay is no longer shown between chapters.
        // Clear the consumed promise so the victory path doesn't try to re-show it.
        tapestryPromise = null;
        clearPipelineHud();
        persistGame();
      });
    }
  } catch (err) {
    log.error("era", `[ERA-TRN] Era transition failed${process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" ? `: ${err instanceof Error ? err.message : String(err)}` : ""}`);
    chartEraBtn.classList.remove("visible");
    hideEraIdeaSlot();
    busy = false;
    eraAdvancing = false;
    pendingEraResult = null;
    latestEraSnapshot = null;
    latestEraChoice = null;
    latestTapestryPromise = null;
    clearPipelineHud();
  }
}


function renderEraStatCards(h: { actions: ActionLogEntry[]; discoveredItems: string[]; tileSpawnCounts?: Record<string, number>; tileSpawnByTier?: Record<number, number> }): string {
  const byTier = h.tileSpawnByTier;
  const topSpawn = h.tileSpawnCounts ? Object.entries(h.tileSpawnCounts).sort((a, b) => b[1] - a[1])[0] : null;

  // Determine which tiers have any data
  const activeTiers = ([1, 2, 3, 4, 5] as const).filter(t =>
    (byTier?.[t] ?? 0) > 0 || h.actions.some(a => a.resultTier === t)
  );

  let tierTable = '';
  if (activeTiers.length > 0) {
    const placedByTier = activeTiers.map(t => byTier?.[t] ?? 0);
    const combosByTier = activeTiers.map(t => t === 1 ? 0 : h.actions.filter(a => a.resultTier === t).length);
    const discoveredByTier = activeTiers.map(t => t === 1 ? 0 : new Set(h.actions.filter(a => a.resultTier === t).map(a => a.result)).size);

    const headerCells = activeTiers.map(t => `<th>Tier ${t}</th>`).join('') + `<th class="era-tier-total-col">Total</th>`;
    const placedCells = placedByTier.map(v => `<td>${v}</td>`).join('') + `<td class="era-tier-total-col">${placedByTier.reduce((a, b) => a + b, 0)}</td>`;
    const combosCells = combosByTier.map((v, i) => `<td>${activeTiers[i] === 1 ? '' : v}</td>`).join('') + `<td class="era-tier-total-col">${combosByTier.reduce((a, b) => a + b, 0)}</td>`;
    const discoveredCells = discoveredByTier.map((v, i) => `<td>${activeTiers[i] === 1 ? '' : v}</td>`).join('') + `<td class="era-tier-total-col">${discoveredByTier.reduce((a, b) => a + b, 0)}</td>`;

    tierTable = `
      <div class="era-tier-table-wrap">
        <table class="era-tier-table">
          <thead><tr><th></th>${headerCells}</tr></thead>
          <tbody>
            <tr><td class="era-tier-label">placed</td>${placedCells}</tr>
            <tr><td class="era-tier-label">combos</td>${combosCells}</tr>
            <tr><td class="era-tier-label">discovered</td>${discoveredCells}</tr>
          </tbody>
        </table>
      </div>`;
  }

  const favoriteRow = topSpawn
    ? `<div class="era-stat-favorite"><span class="era-stat-favorite-label">Favorite:</span> ${esc(topSpawn[0])} &nbsp;<span class="era-stat-count">${topSpawn[1]}\u00D7</span></div>`
    : '';

  return `${tierTable}${favoriteRow}`;
}

function renderEraCard(h: EraHistory, canvasId: string): string {
  const seeds = h.startingSeeds.map(esc).join("  ");
  const topItems = h.discoveredItems.slice(0, 8).map(esc).join(", ");
  return `
    <div class="victory-era">
      <h4>${esc(h.eraName)}</h4>
      <div class="victory-seeds">Started with: ${seeds}</div>
      ${renderEraStatCards(h)}
      <p class="victory-narrative">${esc(h.advancementNarrative)}</p>
      <div class="victory-items">${topItems}${h.discoveredItems.length > 8 ? "\u2026" : ""}</div>
      <div class="victory-graph-wrap"><canvas class="victory-graph" id="${canvasId}"></canvas></div>
    </div>
  `;
}

function renderEraGraphs(history: EraHistory[], canvasIdPrefix: string): void {
  requestAnimationFrame(() => {
    history.forEach((h, i) => {
      const canvas = document.getElementById(`${canvasIdPrefix}-${i}`) as HTMLCanvasElement | null;
      if (!canvas || h.actions.length === 0) return;
      const seedNames = h.startingSeeds.map((s) => s.replace(/^.+\s/, ""));
      renderCombinationGraph(canvas, h.actions, seedNames);
    });
  });
}

function showEraSummary(record: EraHistory, nextEraName: string, nextNarrative: string, onContinue: () => void) {
  hideToast();
  // Cancel any animation still applied to the panel (e.g. the page-turn
  // animation from the previous era's continue, which uses fill: "forwards"
  // and would otherwise leave the panel rotated/invisible on this open).
  const summaryPanel = document.getElementById("era-summary-panel");
  if (summaryPanel) {
    summaryPanel.getAnimations().forEach((a) => a.cancel());
    summaryPanel.style.transform = "";
    summaryPanel.style.opacity = "";
    summaryPanel.style.filter = "";
    summaryPanel.style.transformOrigin = "";
    summaryPanel.style.willChange = "";
  }
  // Defensively dismiss a pinned goal tooltip — its z-index sits above the
  // overlay, so a leftover pin would mask the spread.
  if (pinnedGoalInfo) {
    pinnedGoalInfo = null;
    goalTooltipEl.classList.remove("visible");
  }
  document.getElementById("era-summary-era-name")!.textContent = record.eraName;
  document.getElementById("era-summary-stat-cards")!.innerHTML = renderEraStatCards(record);
  const topItems = record.discoveredItems.slice(0, 16).join(", ");
  document.getElementById("era-summary-discovered")!.textContent = topItems + (record.discoveredItems.length > 16 ? "…" : "");
  document.getElementById("era-summary-next-name")!.textContent = nextEraName;
  // Next-era narrative is scratched in by revealEraSummaryContents below —
  // start empty so the typewriter has nothing to fight.
  document.getElementById("era-summary-next-text")!.textContent = "";
  const continueBtn = document.getElementById("era-summary-continue-btn") as HTMLButtonElement;
  continueBtn.textContent = `Begin ${nextEraName} \u2192`;
  // Disable the continue button until the narrative finishes scratching in \u2014 the
  // ceremony is paced; the player should sit with the frontispiece reveal.
  continueBtn.disabled = true;
  continueBtn.onclick = () => {
    continueBtn.onclick = null;
    const panel = document.getElementById("era-summary-panel");
    const finish = () => {
      eraSummaryOverlay.classList.remove("visible");
      if (panel) {
        panel.style.transform = "";
        panel.style.opacity = "";
        panel.style.filter = "";
      }
      // Restore the objectives card now that the next chapter begins —
      // showEraIdeaSlot collapsed it on bind to keep the header tidy.
      if (eraGoalsCollapsed) {
        eraGoalsCollapsed = false;
        applyEraGoalsState();
      }
      onContinue();
    };
    // Peel the era-summary spread away into the next chapter (spec §6 page-turn).
    // Dispatch on the active theme's variant: peel-2d (Bibliophile),
    // pan-horizontal (Curator), or fold-3d (Cartographer, +100ms).
    if (panel) {
      const themeMotion = getTheme().motion;
      void playPageTurn(panel, {
        type: themeMotion.pageTransitionType,
        durationMs: themeMotion.pageTransitionDurationMs,
      }).then(finish);
    } else {
      finish();
    }
  };

  // Reset frontispiece + narrative state for this opening.
  const frontEl = document.getElementById("era-summary-frontispiece") as HTMLImageElement;
  const spinnerEl = document.getElementById("era-summary-frontispiece-spinner");
  const narrativeEl = document.getElementById("era-summary-narrative")!;
  if (frontEl) {
    frontEl.hidden = true;
    frontEl.removeAttribute("src");
    frontEl.style.clipPath = "";
    frontEl.style.transform = "";
  }
  if (spinnerEl) {
    spinnerEl.style.display = "block";
    spinnerEl.style.opacity = "1";
  }
  narrativeEl.textContent = "";

  eraSummaryOverlay.classList.add("visible");

  // Paper rustle on the summary spread arriving (spec §7).
  audio.playPaperRustle();

  // Pace the spread: await the in-flight tapestry (frontispiece) image, brush-wipe
  // it in, then scratch in the completed-era narrative, then the next-era
  // narrative, then enable Continue. The bind ceremony already started the
  // tapestry generation in the background pipeline.
  const nextTextEl = document.getElementById("era-summary-next-text")!;
  void revealEraSummaryContents(frontEl, spinnerEl, narrativeEl, record.advancementNarrative, nextTextEl, nextNarrative, continueBtn);
}

async function revealEraSummaryContents(
  frontEl: HTMLImageElement | null,
  spinnerEl: HTMLElement | null,
  narrativeEl: HTMLElement,
  narrative: string,
  nextTextEl: HTMLElement,
  nextNarrative: string,
  continueBtn: HTMLButtonElement,
) {
  const skipTargetIsContinue = (e: Event) =>
    !!(e.target as HTMLElement).closest("#era-summary-continue-btn");

  // 1. Next-era typewriter — runs IMMEDIATELY on overlay open. Independent
  // from the tapestry pipeline; the player can read the preview while the
  // frontispiece is still rendering.
  const nextDone: Promise<void> = nextNarrative
    ? (() => {
        const handle = scratchIn(nextTextEl, nextNarrative, { msPerChar: 28 });
        const skip = (e: Event) => { if (!skipTargetIsContinue(e)) handle.skip(); };
        eraSummaryOverlay.addEventListener("click", skip, { once: true });
        return handle.promise.then(() => {
          eraSummaryOverlay.removeEventListener("click", skip);
        });
      })()
    : Promise.resolve();

  // 2. Tapestry: await + brush-wipe, then start the completed-era
  //    typewriter. Falls back to immediate typewriter if the tapestry
  //    pipeline produces no image.
  const completedDone: Promise<void> = (async () => {
    let imageReady = false;
    if (frontEl && tapestryPromise) {
      try {
        const result = await tapestryPromise;
        if (result?.base64) {
          frontEl.src = `data:${result.mimeType};base64,${result.base64}`;
          await new Promise<void>((resolve) => {
            if (frontEl.complete && frontEl.naturalWidth > 0) return resolve();
            frontEl.onload = () => resolve();
            frontEl.onerror = () => resolve();
          });
          if (spinnerEl) spinnerEl.style.display = "none";
          frontEl.hidden = false;
          const brush = audio.startBrushCanvas();
          // Dispatch on the active theme's reveal variant. Bibliophile uses
          // brush-wipe; Curator uses spotlight-wipe; Cartographer uses ink-wash.
          await playBrushWipe(frontEl, {
            durationMs: 1400,
            type: getTheme().motion.frontispieceRevealType,
          });
          brush.stop();
          imageReady = true;
        }
      } catch { /* fall through to text-only */ }
    }
    if (!imageReady && spinnerEl) {
      spinnerEl.style.transition = "opacity 240ms ease-out";
      spinnerEl.style.opacity = "0";
      setTimeout(() => { spinnerEl.style.display = "none"; }, 260);
    }
    // Tapestry is unfurled (or failed gracefully). Start the completed-era
    // typewriter now — independent from the next-era one above.
    const handle = scratchIn(narrativeEl, narrative, { msPerChar: 28 });
    const skip = (e: Event) => { if (!skipTargetIsContinue(e)) handle.skip(); };
    eraSummaryOverlay.addEventListener("click", skip, { once: true });
    await handle.promise;
    eraSummaryOverlay.removeEventListener("click", skip);
  })();

  // Continue enables when BOTH typewriters have finished.
  await Promise.all([nextDone, completedDone]);
  continueBtn.disabled = false;
}

function renderEraIdeaSlot() {
  const wrapper = document.getElementById("era-idea-slot-wrapper");
  const slotEl = document.getElementById("era-idea-slot");
  const promptEl = wrapper?.querySelector<HTMLElement>(".era-idea-prompt") ?? null;
  if (!wrapper || !slotEl) return;
  const wrapperVisible = !wrapper.hasAttribute("hidden");
  if (pendingEraIdeaTile) {
    slotEl.classList.add("slot-occupied");
    slotEl.innerHTML = `
      <span class="slot-emoji">${esc(pendingEraIdeaTile.emoji || "\u2753")}</span>
      <span class="slot-name">${esc(pendingEraIdeaTile.name)}</span>
      <span class="slot-tier">${tierStars(pendingEraIdeaTile.tier)}</span>
    `;
    stopBindArrowIdleLoop();
    // Hold-and-release is the bind grammar by default; tap-to-commit just taps once.
    if (promptEl) {
      const tapMode = getSettings().prefersTapToCommit;
      // Keep the prompt visible during the hold so the slot wrapper's
      // height doesn't reflow mid-ceremony (an empty string here was
      // causing a vertical shift of the chart-era-btn underneath).
      const slotPrompts = getTheme().copy.slotPrompts;
      promptEl.textContent = tapMode ? slotPrompts.tapToBindPrompt : slotPrompts.holdToBindPrompt;
      promptEl.classList.add("is-active");
    }
  } else {
    slotEl.classList.remove("slot-occupied", "slot-holding");
    slotEl.innerHTML = `<span class="slot-empty-hint">${getTheme().copy.slotPrompts.dropTileHint}</span>`;
    if (promptEl) {
      promptEl.textContent = getTheme().copy.slotPrompts.saveTilePrompt;
      promptEl.classList.remove("is-active");
    }
    if (wrapperVisible) startBindArrowIdleLoop();
  }
}

// Bind arrow's idle-gated playback. The arrow trail is now one-shot per
// setActive(true), and we trigger it after 4s of pointer-quiet time, with
// another 4s required between plays.
const BIND_ARROW_CYCLE_MS = 3200; // STEP_TS=3 × STEP_MS=1000 + HOLD=1000 + FADE=200
let bindArrowIdleStop: (() => void) | null = null;

function ensureEraIdeaArrowTrail() {
  if (eraIdeaArrowTrail) return eraIdeaArrowTrail;
  const slotEl = document.getElementById("era-idea-slot");
  if (!slotEl) return null;
  // Road-turn arc: start lower-right of the workspace, end at 2/3 of the
  // slot's width horizontally (just right of center). The "right" curve
  // bias bows the path further right at the midpoint, exaggerated 33%
  // beyond the default for a more pronounced road-turn feel.
  // Endpoints are functions so they re-anchor on resize/scroll.
  eraIdeaArrowTrail = createArrowTrail({
    from: () => {
      const r = workspace.getBoundingClientRect();
      return { x: r.right - 80, y: r.top + r.height * 0.55 };
    },
    to: () => {
      const r = slotEl.getBoundingClientRect();
      return { x: r.left + r.width * (2 / 3), y: r.top + r.height / 2 };
    },
    color: "var(--accent-secondary, #c9a85f)",
    curveBias: "right",
    curveAmount: 0.29,
  });
  document.body.appendChild(eraIdeaArrowTrail.el);
  eraIdeaArrowTrail.attach();
  return eraIdeaArrowTrail;
}

function startBindArrowIdleLoop(): void {
  if (bindArrowIdleStop) return;
  if (!eraIdeaArrowTrail) return;
  // Play once immediately (the moment the slot opens), then idle-gate any
  // subsequent plays. The first arrow shouldn't make the player wait 4s
  // before knowing where to drop the tile.
  bindArrowIdleStop = startIdleHintLoop(
    () => eraIdeaArrowTrail?.setActive(true),
    BIND_ARROW_CYCLE_MS,
    { playImmediate: true },
  );
}
function stopBindArrowIdleLoop(): void {
  if (bindArrowIdleStop) {
    bindArrowIdleStop();
    bindArrowIdleStop = null;
  }
  eraIdeaArrowTrail?.setActive(false);
}

function showEraIdeaSlot() {
  const wrapper = document.getElementById("era-idea-slot-wrapper");
  if (!wrapper) return;
  wrapper.removeAttribute("hidden");
  pendingEraIdeaTile = null;
  // Collapse the objectives card so the bind slot has the header to itself —
  // the era is already won; the goals are just visual noise at this point.
  // Reopened on era-summary dismissal so the next chapter starts expanded.
  if (!eraGoalsCollapsed) {
    eraGoalsCollapsed = true;
    applyEraGoalsState();
  }
  ensureEraIdeaArrowTrail();
  renderEraIdeaSlot();
  // Defer idle-loop start so the wrapper has laid out first; if a tile is
  // already pending the loop won't start (renderEraIdeaSlot stopped it).
  requestAnimationFrame(() => {
    if (!pendingEraIdeaTile) startBindArrowIdleLoop();
  });
}

function hideEraIdeaSlot() {
  const wrapper = document.getElementById("era-idea-slot-wrapper");
  if (wrapper) wrapper.setAttribute("hidden", "");
  pendingEraIdeaTile = null;
  stopBindArrowIdleLoop();
  renderEraIdeaSlot();
  // Restore the objectives card if showEraIdeaSlot collapsed it. The success
  // path hides the wrapper via direct setAttribute (and expands on summary
  // close), so this branch is only reached on the error path — no double-fire.
  if (eraGoalsCollapsed) {
    eraGoalsCollapsed = false;
    applyEraGoalsState();
  }
}

async function persistEraIdeaTile(eraName: string, tile: EraIdeaTilePick) {
  // Cache the chapter index + binding stripe color at write-time so library
  // queries / renders don't have to recompute from era_name strings or hash
  // the (era × tile × run) tuple again. Spec §11 schema notes.
  const eraIndex = (() => {
    for (let i = 0; i < eraManager.totalEras; i++) {
      if (eraManager.getEraByIndex(i).name === eraName) return i;
    }
    return null;
  })();
  const stripe = chapterStripeColor(eraName, tile.name, runId);
  try {
    await fetch("/api/era-idea-tile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anonId: getOrCreateAnonId(),
        runId,
        eraName,
        chapterIndex: eraIndex,
        tileName: tile.name,
        tileTier: tile.tier,
        tileEmoji: tile.emoji,
        tileColor: tile.color,
        tileDescription: tile.description ?? null,
        tileNarrative: tile.narrative ?? null,
        bindingStripeColor: stripe,
      }),
    });
  } catch (err) {
    const detail = process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" ? `: ${err instanceof Error ? err.message : String(err)}` : "";
    log.error("api", `[IDEA] persist failed${detail}`);
  }
}

function showScoreboard() {
  posthog.capture('scoreboard_opened');
  const history = eraManager.history;

  // Header
  const erasCompleted = history.length;
  const totalCombos = actionLog.length;
  const subtitleText = erasCompleted === 0
    ? 'No eras completed yet \u2014 keep building!'
    : `${erasCompleted} era${erasCompleted !== 1 ? 's' : ''} completed \u00B7 ${totalCombos} combinations`;

  document.querySelector('.scoreboard-header h2')!.textContent = 'Civilization Progress';
  document.querySelector('.scoreboard-subtitle')!.textContent = subtitleText;

  const tapestriesBtn = document.getElementById('scoreboard-tapestries-btn') as HTMLButtonElement;
  tapestriesBtn.style.display = 'none'; // TODO: re-enable when tapestry share links are ready

  if (erasCompleted === 0) {
    scoreboardTimeline.innerHTML = `<div class="scoreboard-empty">Complete your first era to see it here.</div>`;
    scoreboardOverlay.classList.add("visible");
    return;
  }

  const timelineHtml = history.map((h, i) => renderEraCard(h, `scoreboard-graph-${i}`)).join("");

  const totalItems = history.reduce((n, h) => n + h.discoveredItems.length, 0);

  const totalsHtml = `
    <div class="scoreboard-totals-section">
      <div class="scoreboard-total-stat"><div class="scoreboard-total-value">${totalCombos}</div><div class="scoreboard-total-label">Combinations</div></div>
      <div class="scoreboard-total-stat"><div class="scoreboard-total-value">${totalItems}</div><div class="scoreboard-total-label">Discoveries</div></div>
      <div class="scoreboard-total-stat"><div class="scoreboard-total-value">${erasCompleted}</div><div class="scoreboard-total-label">Eras</div></div>
    </div>
  `;

  scoreboardTimeline.innerHTML = timelineHtml + totalsHtml;
  scoreboardOverlay.classList.add("visible");
  renderEraGraphs(history, "scoreboard-graph");
}

function showEraToast(title: string, text: string, completedEra?: { eraName: string; combineCount: number; itemCount: number; topItems: string[] }) {
  eraToastTitle.textContent = title;
  eraToastText.innerText = text;
  const statsEl = document.getElementById("era-toast-stats")!;
  if (completedEra) {
    const items = completedEra.topItems.slice(0, 6).join(", ");
    statsEl.innerHTML = `
      <div class="era-toast-completed">
        <div class="era-toast-completed-name">${completedEra.eraName} complete</div>
        <div class="era-toast-completed-stats">
          <span>${completedEra.combineCount} combinations</span>
          <span>\u00B7</span>
          <span>${completedEra.itemCount} items discovered</span>
        </div>
        ${items ? `<div class="era-toast-completed-items">${items}${completedEra.topItems.length > 6 ? "..." : ""}</div>` : ""}
      </div>
    `;
  } else {
    statsEl.innerHTML = "";
  }
  eraToast.classList.add("visible");
}

// Render a Discord CTA link into `el` based on current auth/activity state.
// compact (icon-only) when the user is a known Discord member; hidden in Activity.
function setDiscordCta(el: HTMLElement | null) {
  if (!el) return;
  if (isDiscordActivity()) {
    el.style.display = "none";
    return;
  }
  el.style.removeProperty("display");
  if (authStore.getState().provider === "discord") {
    el.innerHTML = DISCORD_SVG;
    el.title = "Join our Discord server";
    el.setAttribute("data-compact", "");
  } else {
    el.innerHTML = `${DISCORD_SVG} Join our Discord`;
    el.title = "Join our Discord";
    el.removeAttribute("data-compact");
  }
}

function updateVictoryAuthSection() {
  const section = document.getElementById("victory-auth-section");
  if (!section) return;
  const { isLoggedIn, name, openLoginFromVictory } = authStore.getState();
  if (isLoggedIn) {
    section.innerHTML = `<div class="victory-auth-saved">✓ Saved to ${name ?? "your account"}</div>`;
  } else {
    section.innerHTML = `
      <div class="victory-auth-prompt">
        <p>Save your achievements to your account</p>
        <button id="victory-signin-btn" class="victory-signin-btn">Sign in</button>
      </div>
    `;
    document.getElementById("victory-signin-btn")?.addEventListener("click", () => {
      openLoginFromVictory?.();
    });
  }

  setDiscordCta(document.getElementById("victory-discord-btn"));
}

function showVictory(narrative?: string) {
  posthog.capture('game_completed', {
    total_eras: eraManager.history.length,
    total_combinations: actionLog.length,
    total_items_discovered: getDiscoveredItems().length,
  });
  // Set era name to The Age of Plenty
  document.getElementById("era-name")!.textContent = "The Age of Plenty";
  const goalsEl = document.getElementById("era-goals")!;
  goalsEl.innerHTML =
    '<div class="era-goal met">Your civilization has transcended the ages</div>' +
    '<button id="victory-restart-btn" class="restart-btn-inline">Play Again</button>';
  document.getElementById("victory-restart-btn")!.addEventListener("click", handleRestart);
  const narrativeEl = document.getElementById("victory-narrative");
  if (narrativeEl) narrativeEl.textContent = narrative ?? "";

  // Build timeline
  victoryTimeline.innerHTML = eraManager.history
    .map((h, i) => renderEraCard(h, `victory-graph-${i}`))
    .join("");

  // Inject auth section before actions
  const victoryActions = victoryPanel.querySelector(".victory-actions")!;
  if (!document.getElementById("victory-auth-section")) {
    const authSection = document.createElement("div");
    authSection.id = "victory-auth-section";
    victoryPanel.insertBefore(authSection, victoryActions);
  }
  updateVictoryAuthSection();

  victoryOverlay.classList.add("visible");

  // Render graphs after DOM is visible
  renderEraGraphs(eraManager.history, "victory-graph");
}

const handleVictoryShare = async () => {
  const panel = document.getElementById("victory-panel")!;
  try {
    const dataUrl = await toPng(panel, { pixelRatio: 2 });
    await saveImage(dataUrl, "bari-victory.png");
  } catch (err) {
    log.error("system", `[SHARE] Victory share failed${process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" ? `: ${err instanceof Error ? err.message : String(err)}` : ""}`);
    showToast("Could not save image", 3000);
  }
};

victoryShareBtn.addEventListener("click", handleVictoryShare);

document.getElementById("victory-continue-btn")!.addEventListener("click", async () => {
  victoryOverlay.classList.remove("visible");
  document.getElementById("thanks-toast")!.classList.add("visible");
  busy = false;
  eraAdvancing = false;
  clearPipelineHud();
  await showTapestry();
});

document.getElementById("thanks-toast-close")!.addEventListener("click", () => {
  document.getElementById("thanks-toast")!.classList.remove("visible");
});

// --- Bind ceremony (spec §3.3) — hold-to-commit gesture ---
//
// Flow:
//   1. Goals met → showEraIdeaSlot() reveals the wrapper. Player drags a tile in.
//   2. handlePointerUp's slot-drop branch sets pendingEraIdeaTile + renders. The
//      tile sits in the plate at IDLE state — no arc filling yet.
//   3. Player presses-and-holds on the slot → beginBindHold() starts the 2.5s arc.
//      Releasing before 2.5s aborts the fill; the tile stays in the plate so the
//      player can retry. Reaching 2.5s commits.
//   4. The chart-era-btn is a "Release" affordance — clicking it returns the tile
//      to the workspace, emptying the slot entirely.
//   5. On commit, brass clasp plays and we route into doEraTransition().

function beginBindHold() {
  if (!pendingEraIdeaTile || !pendingEraResult) return;
  if (bindHoldHandle) return; // already filling
  if (busy) return;
  const slotEl = document.getElementById("era-idea-slot");
  if (!slotEl) return;
  // Player has begun the hold gesture — the prompt has done its job; stop
  // pulsing so the text isn't fighting the hold-arc visual.
  stopPressAndHoldPulses();
  bindHoldHandle = startHoldArc({ target: slotEl, durationMs: 2500 });
  // Cello G2 sustains for the duration of the hold (the master clock per §7).
  // Resolves up a fifth on commit; gracefully exhales on cancel.
  bindHoldCello = audio.startCelloSustain(98 /* G2 */);
  slotEl.classList.add("slot-holding");

  // Tap-to-commit accessibility mode (spec §8): in this mode pointerup does
  // NOT abort the fill — the arc continues to its 2.5s commit even after the
  // player lifts. Cancellation goes through drag-out (move past 12px) only.
  // Default mode (hold-to-commit): pointerup / pointercancel aborts the fill.
  const tapToCommit = getSettings().prefersTapToCommit;
  let releaseHold: (() => void) | null = null;
  if (!tapToCommit) {
    releaseHold = () => {
      document.removeEventListener("pointerup", releaseHold!);
      document.removeEventListener("pointercancel", releaseHold!);
      if (!bindHoldHandle) return;
      const handle = bindHoldHandle;
      handle.cancel(); // resolves the promise with "cancel"
      setTimeout(() => handle.destroy(), 200);
    };
    document.addEventListener("pointerup", releaseHold);
    document.addEventListener("pointercancel", releaseHold);
  }

  bindHoldHandle.promise.then((outcome) => {
    if (releaseHold) {
      document.removeEventListener("pointerup", releaseHold);
      document.removeEventListener("pointercancel", releaseHold);
    }
    if (outcome === "complete") {
      // Cello resolves up a fifth — the audio half of the brass-clasp commit.
      bindHoldCello?.resolve();
      bindHoldCello = null;
      void commitBindCeremony();
    } else {
      // Graceful exhale (G2 → F2, ~600ms). Spec §2.4 cancellation.
      bindHoldCello?.fadeOut();
      bindHoldCello = null;
      bindHoldHandle = null;
      slotEl.classList.remove("slot-holding");
      renderEraIdeaSlot();
    }
  });

  renderEraIdeaSlot();
}

// ────────────────────────────────────────────────────────────────────
// Retirement ceremony (spec §3.6)
// ────────────────────────────────────────────────────────────────────

interface LibraryEntry {
  id: string;
  tileName: string;
  tileTier: number;
  tileEmoji: string;
  tileColor: string;
  tileDescription: string | null;
  tileNarrative: string | null;
  eraName: string;
  chapterIndex: number | null;
  runId: string | null;
  bindingStripeColor: string | null;
  createdAt: string;
}

let retirementHoldHandle: HoldArcHandle | null = null;

/** True if the player has 24 non-retired bound tiles already; the next bind
 *  must replace one. Fetches /api/library and checks length. Fail-open on
 *  error so a network blip doesn't block the bind. */
async function isLibraryFullForRetirement(): Promise<boolean> {
  try {
    const anonId = getOrCreateAnonId();
    const r = await fetch(`/api/library?anonId=${encodeURIComponent(anonId)}`, {
      credentials: "same-origin",
    });
    if (!r.ok) return false;
    const data = (await r.json()) as { tiles?: LibraryEntry[] };
    return (data.tiles?.length ?? 0) >= 24;
  } catch {
    return false;
  }
}

interface BoundTilePreview {
  name: string;
  tier: Tier;
  emoji: string;
  color: string;
}

/** Open the retirement modal and resolve when the player either retires a
 *  library tile (→ "retired") or cancels (→ "cancelled"). Cancellation in
 *  Phase 4 minimum is via the ESC key or backdrop tap; the spec's "Don't keep
 *  this chapter" affordance can be wired later. */
function openRetirementOverlay(boundPreview: BoundTilePreview): Promise<"retired" | "cancelled"> {
  return new Promise((resolve) => {
    const overlay = document.getElementById("retirement-overlay");
    const grid = document.getElementById("retirement-library-grid");
    const boundEl = document.getElementById("retirement-bound-tile");
    if (!overlay || !grid || !boundEl) {
      resolve("cancelled");
      return;
    }

    // Render the new tile suspended above
    boundEl.innerHTML = `
      <span class="retire-bound-emoji">${esc(boundPreview.emoji)}</span>
      <span class="retire-bound-name">${esc(boundPreview.name)}</span>
      <span class="retire-bound-tier">${tierStars(boundPreview.tier)}</span>
    `;

    grid.innerHTML = `<p class="retire-loading">Reading your library&hellip;</p>`;
    overlay.classList.add("visible");

    let settled = false;
    const finish = (outcome: "retired" | "cancelled") => {
      if (settled) return;
      settled = true;
      cleanup();
      overlay.classList.remove("visible");
      resolve(outcome);
    };

    const onBackdrop = (e: MouseEvent) => {
      if (e.target === overlay) finish("cancelled");
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish("cancelled");
    };
    const cleanup = () => {
      overlay.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKey);
      if (retirementHoldHandle) {
        retirementHoldHandle.cancel();
        retirementHoldHandle = null;
      }
    };
    overlay.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKey);

    // Fetch the library content, render the grid
    void (async () => {
      try {
        const anonId = getOrCreateAnonId();
        const r = await fetch(`/api/library?anonId=${encodeURIComponent(anonId)}`, {
          credentials: "same-origin",
        });
        const data = (await r.json()) as { tiles?: LibraryEntry[] };
        const tiles = data.tiles ?? [];
        if (tiles.length === 0) {
          grid.innerHTML = `<p class="retire-loading">Your library is empty — nothing to retire.</p>`;
          return;
        }
        grid.innerHTML = tiles
          .map((t) => {
            // Phase C render-path bypass: stripe resolved from active theme.
            const stripe = chapterStripeColor(t.eraName, t.tileName, t.runId ?? "");
            return `<button
                class="retire-tile"
                data-tile-id="${esc(t.id)}"
                style="--stripe: ${esc(stripe)}"
                title="${esc(t.tileName)} — ${esc(t.eraName)}"
              >
                <span class="retire-tile-emoji">${esc(t.tileEmoji)}</span>
                <span class="retire-tile-name">${esc(t.tileName)}</span>
              </button>`;
          })
          .join("");

        // Wire press-and-hold on each tile.
        grid.querySelectorAll<HTMLButtonElement>(".retire-tile").forEach((btn) => {
          btn.addEventListener("pointerdown", (ev) => {
            if (settled || retirementHoldHandle) return;
            ev.preventDefault();
            const tileId = btn.dataset.tileId!;
            btn.classList.add("retire-tile--holding");
            retirementHoldHandle = startHoldArc({ target: btn, durationMs: 2500 });

            const releaseHold = () => {
              document.removeEventListener("pointerup", releaseHold);
              document.removeEventListener("pointercancel", releaseHold);
              if (!retirementHoldHandle) return;
              const h = retirementHoldHandle;
              h.cancel();
              setTimeout(() => h.destroy(), 200);
            };
            document.addEventListener("pointerup", releaseHold);
            document.addEventListener("pointercancel", releaseHold);

            retirementHoldHandle.promise.then(async (outcome) => {
              document.removeEventListener("pointerup", releaseHold);
              document.removeEventListener("pointercancel", releaseHold);
              const h = retirementHoldHandle;
              retirementHoldHandle = null;
              if (outcome !== "complete") {
                btn.classList.remove("retire-tile--holding");
                return;
              }
              h?.destroy();
              // Commit retirement: ink-point dispersal + API call
              await commitRetirement(btn, tileId);
              finish("retired");
            });
          });
        });
      } catch (err) {
        const detail = process.env.NEXT_PUBLIC_VERCEL_ENV !== "production"
          ? `: ${err instanceof Error ? err.message : String(err)}`
          : "";
        log.error("api", `[RTR] library fetch failed${detail}`);
        grid.innerHTML = `<p class="retire-loading">Could not read the library.</p>`;
      }
    })();
  });
}

/** Run-end wax seal — gilt "A" stamped onto the strip's center. Spec §3.8.
 *  Spawns a transient div over the strip, plays the wax-stamp animation,
 *  then leaves the seal in place for ~600ms before the victory overlay rises. */
async function playRunEndSeal(): Promise<void> {
  const stripEl = document.getElementById("era-progress");
  if (!stripEl) return;

  const seal = document.createElement("div");
  seal.className = "run-end-seal";
  seal.textContent = "A"; // gilt initial — the player's age sealed
  // Position the seal centered horizontally over the strip, vertically anchored
  // to the strip's middle. The strip is the player's history, so the seal
  // belongs there.
  const rect = stripEl.getBoundingClientRect();
  Object.assign(seal.style, {
    position: "fixed",
    left: `${rect.left + rect.width / 2}px`,
    top: `${rect.top + rect.height / 2}px`,
    transform: "translate(-50%, -50%) scale(0)",
    opacity: "0",
  });
  document.body.appendChild(seal);

  await playWaxStamp(seal, { durationMs: 320, startScale: 1.4 });
  // Leave the seal visible for a beat before victory rises
  await new Promise<void>((resolve) => setTimeout(resolve, 600));
  // Fade it out gracefully so it doesn't suddenly snap away when victory opens
  seal.animate(
    [{ opacity: 1 }, { opacity: 0 }],
    { duration: 400, easing: "ease-out", fill: "forwards" },
  ).onfinish = () => {
    if (seal.parentElement) seal.parentElement.removeChild(seal);
  };
}

async function commitRetirement(btn: HTMLElement, tileId: string): Promise<void> {
  // Visual: ink-point dispersal at the tile's center
  await playInkPointDispersal({ target: btn, count: 9, durationMs: 1400 });
  // Server: retire the chosen row
  try {
    const anonId = getOrCreateAnonId();
    await fetch(`/api/era-idea-tile/${encodeURIComponent(tileId)}/retire`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonId }),
      credentials: "same-origin",
    });
    posthog.capture("library_tile_retired", { tile_id: tileId });
  } catch (err) {
    const detail = process.env.NEXT_PUBLIC_VERCEL_ENV !== "production"
      ? `: ${err instanceof Error ? err.message : String(err)}`
      : "";
    log.error("api", `[RTR] retire failed${detail}`);
  }
}

// Attach the press-and-hold listener on the slot once. pendingEraIdeaTile guards
// the no-tile case; beginBindHold also re-checks busy / handle state.
//
// Direction logic (matches the idea-tray's drag affordance):
//   - Press and stay still → hold-arc fills, eventually commits
//   - Press and move past 12px → cancel the hold AND drag the tile back out to
//     the workspace under the pointer, so the player can re-place it or combine
//     it. This is the spec-correct cancel gesture (§2.4 "lifting before 2.5s")
//     extended to a drag-out so the tile doesn't get stranded in the slot.
const SLOT_DRAG_OUT_PX = 12;
document.getElementById("era-idea-slot")?.addEventListener("pointerdown", (e) => {
  if (!pendingEraIdeaTile || bindHoldHandle) return;
  if (busy) return;
  e.preventDefault();

  const startX = e.clientX;
  const startY = e.clientY;
  const tileSnapshot = pendingEraIdeaTile;
  let dragStarted = false;

  const onSlotMove = (moveEvent: PointerEvent) => {
    if (dragStarted) return;
    const dx = moveEvent.clientX - startX;
    const dy = moveEvent.clientY - startY;
    if (Math.hypot(dx, dy) < SLOT_DRAG_OUT_PX) return;

    dragStarted = true;
    cleanup();

    // Cancel any in-flight hold; promise.then() will handle the post-cancel render.
    if (bindHoldHandle) {
      const handle = bindHoldHandle;
      bindHoldHandle = null;
      handle.cancel();
      setTimeout(() => handle.destroy(), 200);
    }
    if (bindHoldCello) {
      bindHoldCello.fadeOut();
      bindHoldCello = null;
    }

    // Empty the slot; spawn the tile under the pointer; start a regular drag.
    pendingEraIdeaTile = null;
    stopPressAndHoldPulses();
    document.getElementById("era-idea-slot")?.classList.remove("slot-holding");
    renderEraIdeaSlot();

    const data: ElementData = {
      name: tileSnapshot.name,
      tier: tileSnapshot.tier,
      emoji: tileSnapshot.emoji,
      color: tileSnapshot.color,
      description: tileSnapshot.description ?? "",
      narrative: tileSnapshot.narrative ?? "",
    };
    const wsRect = workspace.getBoundingClientRect();
    const item = spawnItem(
      data,
      moveEvent.clientX - wsRect.left - 36,
      moveEvent.clientY - wsRect.top - 36,
    );
    dragItem = item;
    dragSourceSlotIndex = null;
    dragOffsetX = 36;
    dragOffsetY = 36;
    item.el.style.position = "fixed";
    item.el.style.left = `${moveEvent.clientX - 36}px`;
    item.el.style.top = `${moveEvent.clientY - 36}px`;
    item.el.style.zIndex = "100";

    posthog.capture("bind_tile_dragged_out", { era_name: eraNameForAnalytics() });
  };
  const onSlotUp = () => cleanup();
  const cleanup = () => {
    document.removeEventListener("pointermove", onSlotMove);
    document.removeEventListener("pointerup", onSlotUp);
    document.removeEventListener("pointercancel", onSlotUp);
  };
  document.addEventListener("pointermove", onSlotMove);
  document.addEventListener("pointerup", onSlotUp);
  document.addEventListener("pointercancel", onSlotUp);

  beginBindHold();
});

async function commitBindCeremony() {
  if (!pendingEraResult) {
    bindHoldHandle?.destroy();
    bindHoldHandle = null;
    return;
  }
  const slotEl = document.getElementById("era-idea-slot");
  const handle = bindHoldHandle;
  bindHoldHandle = null;
  if (slotEl) slotEl.classList.remove("slot-holding");

  posthog.capture("bind_committed", {
    era_name: eraNameForAnalytics(),
    bound_tile: pendingEraIdeaTile?.name,
    bound_tier: pendingEraIdeaTile?.tier,
  });

  // Brass clasps + plate flash, then route into the existing era transition pipeline.
  // Audio: 3-layer clasp (leather-press + brass tonic + cello tonic resolves) — the
  // cello side already resolved when bindHoldHandle.promise settled "complete".
  audio.playClaspSnap();
  if (slotEl) {
    // Phase D: dispatch on the active theme's clasp axis. Bibliophile is
    // horizontal-clasp; Curator/Cartographer are vertical-pin.
    const claspDirection = getTheme().motion.bindClaspType === "vertical-pin" ? "vertical" : "horizontal";
    await playBrassClasp(slotEl, { direction: claspDirection });
  }

  handle?.destroy();

  const result = pendingEraResult;
  pendingEraResult = null;
  const wrapper = document.getElementById("era-idea-slot-wrapper");
  if (wrapper) wrapper.setAttribute("hidden", "");
  stopBindArrowIdleLoop();
  busy = true;

  // Library full? Route into retirement ceremony before the era summary.
  // Spec §2.3 / §3.6. The bound tile we just committed is captured here as a
  // snapshot so the retirement overlay can display it; the snapshot stays in
  // pendingEraIdeaTile so doEraTransition's existing persist path runs after
  // the player chooses what to retire.
  const libraryFull = await isLibraryFullForRetirement();
  if (libraryFull && pendingEraIdeaTile) {
    const outcome = await openRetirementOverlay({
      name: pendingEraIdeaTile.name,
      tier: pendingEraIdeaTile.tier,
      emoji: pendingEraIdeaTile.emoji,
      color: pendingEraIdeaTile.color,
    });
    if (outcome === "cancelled") {
      // Player closed the overlay without retiring — restore game state and
      // bail. The bind tile stays in slot at idle; chapter doesn't advance.
      busy = false;
      eraAdvancing = false;
      pendingEraResult = result; // restore so a later commit can re-attempt
      // Re-show the chart-era affordance + slot wrapper for retry
      const w = document.getElementById("era-idea-slot-wrapper");
      if (w) w.removeAttribute("hidden");
      return;
    }
  }

  doEraTransition(result);
}

// --- Palette management ---
function addToPalette(entry: ElementData, isSeed = false) {
  const div = document.createElement("div");
  div.className = "palette-item";
  div.dataset.name = entry.name;
  div.dataset.tier = String(entry.tier);
  if (isSeed) div.dataset.seed = "true";
  div.innerHTML = `
    <span class="palette-emoji">${esc(entry.emoji)}</span>
    <span class="palette-label">${esc(entry.name)}</span>
    <span class="palette-stars">${tierStars(entry.tier)}</span>
    <div class="tooltip">
      <div class="tooltip-desc">${esc(entry.description)}</div>
      <div class="tooltip-narrative">${esc(entry.narrative)}</div>
    </div>
  `;
  attachDragToSpawn(div, () => entry, {
    onBegin: (data) => {
      eraSpawnCounts[data.name] = (eraSpawnCounts[data.name] ?? 0) + 1;
      eraSpawnByTier[data.tier] = (eraSpawnByTier[data.tier] ?? 0) + 1;
      posthog.capture('tile_spawned', { item: data.name, tier: data.tier, era_name: eraNameForAnalytics() });
    },
  });
  attachLongPress(div, () => entry);
  paletteItems.appendChild(div);
}

function addToPaletteIfNew(entry: ElementData) {
  const exists = paletteItems.querySelector(`[data-name="${entry.name}"]`);
  if (exists) return;
  addToPalette(entry, false);
}

// --- Toast notification ---
let toastTimer: number;
function showToast(msg: string, durationMs: number | null = 2000) {
  // Cancel any persisted crossfade animations from the AI-thinking phase
  // machine — they use fill: "forwards" and would otherwise pin opacity:1.
  toast.getAnimations().forEach((a) => a.cancel());
  toast.textContent = msg;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  if (durationMs !== null) {
    toastTimer = window.setTimeout(() => toast.classList.remove("visible"), durationMs);
  }
}
function hideToast() {
  clearTimeout(toastTimer);
  toast.classList.remove("visible");
}

// Expose game reset to React auth layer (called on sign-out)
authStore.setState({
  resetGame: () => {
    restarting = true;
    clearSave();
    location.reload();
  },
});

// Subscribe to auth state changes to keep victory screen in sync
const unsubAuth = authStore.subscribe(
  (s) => s.isLoggedIn,
  () => updateVictoryAuthSection()
);

return () => {
  if (selectFiveMode) {
    posthog.unregister("experiment");
    (app as HTMLElement & { __s5Cleanup?: () => void }).__s5Cleanup?.();
  }
  unsubAuth();
  authStore.setState({ resetGame: null });
  clearTimeout(toastTimer);
  document.removeEventListener("pointermove", handlePointerMove);
  document.removeEventListener("pointerup", handlePointerUp);
  eraToastBtn.removeEventListener("click", handleEraToastClose);
  restartButton.removeEventListener("click", handleRestart);
  if (selectFiveMode) restartButton.removeEventListener("click", s5HandleChangeEra);
  demoResetConfirmBtn.removeEventListener("click", handleDemoResetConfirm);
  demoResetCancelBtn.removeEventListener("click", handleDemoResetCancel);
  victoryShareBtn.removeEventListener("click", handleVictoryShare);
  scoreboardBtn.removeEventListener("click", showScoreboard);
  document.removeEventListener("keydown", handleKeyDown);
  app.innerHTML = "";
};
}
