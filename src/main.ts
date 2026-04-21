import type { Tier, ElementData, ModelId, ActionLogEntry, EraHistory, TapestryGameData, Era } from "./types";
import { recipeKey, MODELS } from "./types";
import { combineElements } from "./gemini";
import { InMemoryRecipeStore } from "./recipes";
import { FilePromptProvider } from "./prompt-loader";
import { EraManager } from "./era-manager";
import { log } from "./logger";
import { initDebugConsole } from "./debug-console";
import { saveGame, loadGame, clearSave } from "./save";
import type { SaveData } from "./save";
import { renderCombinationGraph } from "./combination-graph";
import { authStore } from "./store/auth";
import { isDiscordActivity } from "./discord";
import { getOrCreateAnonId } from "./identity";
import posthog from "posthog-js";
import { toPng } from "html-to-image";

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

export function mountGame(app: HTMLElement) {
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

// --- DOM setup ---
const modelOptions = MODELS.map(
  (m) => `<option value="${m.id}">${m.label}</option>`
).join("");

function renderEraProgress() {
  const el = document.getElementById("era-progress");
  if (!el) return;
  if (victoryShown) { el.innerHTML = ""; return; }

  const goal = eraManager.current.goals.find((g) => g.minTier === undefined);
  const metCount = goal ? goal.conditions.filter((c) => c.met).length : 0;
  const dotCount = goal ? goal.requiredCount : 5;

  let html = "";

  // Completed eras: dim cube + single glowing dash
  for (const h of eraManager.history) {
    html += `<div class="era-cube era-cube--done" title="${esc(h.eraName)}"></div>`;
    html += `<div class="era-dots"><span class="era-dash"></span></div>`;
  }

  // Current era: bright glowing cube + progress dots
  html += `<div class="era-cube era-cube--active" title="${eraManager.current.name}"></div>`;
  html += `<div class="era-dots">`;
  for (let i = 0; i < dotCount; i++) {
    html += `<span class="era-dot${i < metCount ? " era-dot--lit" : ""}"></span>`;
  }
  html += `</div>`;

  // Unknown next era (only if not last)
  if (!eraManager.isLastEra) {
    html += `<div class="era-cube era-cube--unknown" title="???"></div>`;
  }

  el.innerHTML = html;
  // Scroll right so active cube is always visible
  el.scrollLeft = el.scrollWidth;
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
  const tierMet = tierGoal?.conditions[0]?.met ?? false;
  const aiRequiredMet = aiGoal ? metCount >= aiGoal.requiredCount : false;
  goalsEl.innerHTML = `
    ${tierGoal ? `<div class="era-goal${tierMet ? " met" : ""}">${tierGoal.conditions[0].description}</div>` : ""}
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
  renderEraProgress();
}

function renderEraName() {
  document.getElementById("era-name")!.textContent = eraManager.current.name;
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
        <span id="era-name"></span>
        <div id="era-name-right">
          <span id="era-goal-counter"></span>
          <button id="era-name-toggle" aria-expanded="true">
            <span id="era-toggle-icon">\u25BE</span>
          </button>
        </div>
      </div>
      <div id="era-goals"></div>
      <button id="chart-era-btn">Next Age →</button>
    </div>
    <div id="inventory-header">
      <h2>Inventory</h2>
      <div id="palette-zoom-controls">
        <span id="palette-zoom-icon">\uD83D\uDD0D</span>
        <button id="palette-zoom-out">&#8722;</button>
        <button id="palette-zoom-in">&#43;</button>
      </div>
    </div>
    <div id="palette-items"></div>
    <div id="bari"><span id="bari-char">\uD83D\uDC66</span><span id="bari-tool">\uD83D\uDD28</span></div>
    <button id="restart-btn">Restart Game</button>
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
  <div id="workspace"><div id="era-progress"></div></div>
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
  <div id="thanks-toast">Thanks for playing! <button id="thanks-toast-close">&times;</button></div>
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
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "production") return;
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

// Era goals toggle
const eraGoalsEl = document.getElementById("era-goals")!;
const eraToggleBtn = document.getElementById("era-name-toggle")!;
const eraToggleIcon = document.getElementById("era-toggle-icon")!;
let eraGoalsCollapsed = false;

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
  }
};
document.addEventListener("keydown", handleKeyDown);

tapestryClose.addEventListener("click", closeTapestry);
tapestryOverlay.addEventListener("click", (e) => {
  if (e.target === tapestryOverlay && tapestryOverlay.classList.contains("tapestry-closeable")) {
    closeTapestry();
  }
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
function persistGame() {
  if (restarting) return;
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

const savedGame = loadGame();
if (savedGame) {
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
  const initialSeeds = eraManager.getSeeds();
  log.info("era", `Starting ${eraManager.current.name} with seeds: ${initialSeeds.map((s) => s.name).join(", ")}`);
  for (const entry of initialSeeds) {
    addToPalette(entry, true);
  }
  posthog.capture('game_started', { era_name: eraManager.current.name });
}

initPipelineHud();

// --- Document-level pointer drag handlers ---
// Items use position:fixed while being dragged so they render above the palette
// sidebar regardless of stacking context. On drop they convert back to absolute.
const handlePointerMove = (e: PointerEvent) => {
  if (!dragItem) return;
  dragItem.el.style.left = `${e.clientX - dragOffsetX}px`;
  dragItem.el.style.top = `${e.clientY - dragOffsetY}px`;
  // Keep workspace-relative coords in sync for overlap detection
  const rect = workspace.getBoundingClientRect();
  dragItem.x = e.clientX - dragOffsetX - rect.left;
  dragItem.y = e.clientY - dragOffsetY - rect.top;
  updateOverlapGlow(dragItem);
};

const handlePointerUp = (e: PointerEvent) => {
  if (!dragItem) return;
  const item = dragItem;
  dragItem = null;
  clearAllGlow();

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
  checkOverlap(item);
};

document.addEventListener("pointermove", handlePointerMove);
document.addEventListener("pointerup", handlePointerUp);

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

  // --- Start drag on pointerdown (move/up handled at document level) ---
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    dragItem = item;
    dragOffsetX = e.clientX - item.x - workspace.getBoundingClientRect().left;
    dragOffsetY = e.clientY - item.y - workspace.getBoundingClientRect().top;
    // Switch to fixed so the tile renders above the palette during drag
    el.style.position = 'fixed';
    el.style.left = `${e.clientX - dragOffsetX}px`;
    el.style.top = `${e.clientY - dragOffsetY}px`;
    el.style.zIndex = "10";
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
  if (dropped.name === other.name || dropped.tier === 5 || other.tier === 5) return;
  combine(dropped, other);
}

// --- Combine two items into a new one ---
async function combine(a: CombineItem, b: CombineItem) {
  if (busy) return;
  pendingCombines++;
  const key = recipeKey(a.name, b.name);
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;

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
  } else {
    const childTier = Math.min(Math.max(a.tier, b.tier) + 1, 5) as Tier;

    log.info("player", `Combining: ${a.name} + ${b.name} → tier ${childTier}`);
    showToast(`${a.name} + ${b.name} = ...thinking...`);
    bari.classList.add("active");
    try {
      const template = await promptProvider.getPrompt(childTier, eraManager.current.name);
      const prompt = template.replace("{{a}}", a.name).replace("{{b}}", b.name);
      log.debug("api", `Calling ${selectedModel} for ${a.name} + ${b.name}`);
      const result = await combineElements(selectedModel, prompt, childTier, eraManager.current.name, getOrCreateAnonId(), runId);
      elementData = { ...result, tier: childTier };
      await recipeStore.set(key, elementData);
      log.info("api", `Result: ${result.emoji} ${result.name} (${result.color})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error("api", `[CMB] Combine failed${process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" ? `: ${msg}` : ""}`);
      if (msg.includes("gcloud auth") || msg.includes("invalid_grant") || msg.includes("RAPT")) {
        showEraToast("\u26A0\uFE0F Auth Expired", "GCP credentials have expired. Run this in your terminal:\n\ngcloud auth application-default login\n\nThen try combining again.");
      }
      elementData = {
        name: `${a.name}+${b.name}`,
        color: "#daa520",
        tier: childTier,
        emoji: "\u2753",
        description: "Something went wrong in the fusion.",
        narrative: "The elements resisted combination. Perhaps the cosmos wasn't ready.",
      };
    }
    bari.classList.remove("active");
  }

  // Remove placeholder and spawn child
  placeholder.remove();
  const child = spawnItem(elementData, midX, midY);
  child.el.classList.add("merging");
  setTimeout(() => child.el.classList.remove("merging"), 400);

  showToast(`${a.emoji} ${a.name} + ${b.emoji} ${b.name} = ${elementData.emoji} ${elementData.name}`);
  const isFirstDiscovery = !paletteItems.querySelector(`[data-name="${elementData.name}"]`);
  addToPaletteIfNew(elementData);
  posthog.capture('combination_created', {
    item_a: a.name,
    item_b: b.name,
    result: elementData.name,
    result_tier: elementData.tier,
    is_cache_hit: isCacheHit,
    model: selectedModel,
    era_name: eraManager.current.name,
  });
  if (isFirstDiscovery) {
    posthog.capture('item_discovered', {
      item: elementData.name,
      tier: elementData.tier,
      era_name: eraManager.current.name,
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
  eraActionLog.push(entry);

  if (eraManager.markTierGoalIfMet(elementData.tier)) renderGoals();

  persistGame();
  pendingCombines--;

  checkEraAdvancement();
}

function removeItem(item: CombineItem) {
  item.el.remove();
  const idx = items.indexOf(item);
  if (idx !== -1) items.splice(idx, 1);
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

  const result = await eraManager.checkAdvancement(
    eraActionLog,
    inventory,
    tier5Count,
    selectedModel,
    getOrCreateAnonId(),
    runId,
  );

  renderGoals();

  if (!result) return;
  if (eraAdvancing) return; // another call won the race while we awaited

  eraAdvancing = true;
  pendingEraResult = result;
  chartEraBtn.classList.add("visible");
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
      showVictory(victoryNarrative ?? undefined);
      return; // busy + eraAdvancing stay true until player clicks Continue Building
    }

    let choice: { era: Era; narrative: string };
    if (preComputedChoice) {
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
        clearPipelineHud();
        await showTapestry();
        persistGame();
      });
    }
  } catch (err) {
    log.error("era", `[ERA-TRN] Era transition failed${process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" ? `: ${err instanceof Error ? err.message : String(err)}` : ""}`);
    chartEraBtn.classList.remove("visible");
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

function showEraSummary(record: EraHistory, nextEraName: string, nextNarrative: string, onContinue: () => void) {
  hideToast();
  document.getElementById("era-summary-era-name")!.textContent = record.eraName;
  document.getElementById("era-summary-stat-cards")!.innerHTML = renderEraStatCards(record);
  document.getElementById("era-summary-narrative")!.textContent = record.advancementNarrative;
  const topItems = record.discoveredItems.slice(0, 16).join(", ");
  document.getElementById("era-summary-discovered")!.textContent = topItems + (record.discoveredItems.length > 16 ? "…" : "");
  document.getElementById("era-summary-next-name")!.textContent = nextEraName;
  document.getElementById("era-summary-next-text")!.textContent = nextNarrative;
  const continueBtn = document.getElementById("era-summary-continue-btn")!;
  continueBtn.textContent = `Begin ${nextEraName} \u2192`;
  continueBtn.onclick = () => {
    eraSummaryOverlay.classList.remove("visible");
    continueBtn.onclick = null;
    onContinue();
  };
  eraSummaryOverlay.classList.add("visible");
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

  const timelineHtml = history.map((h, i) => {
    const seeds = h.startingSeeds.map(esc).join('\u00A0\u00A0');
    const topItems = h.discoveredItems.slice(0, 8).map(esc).join(', ');
    return `
      <div class="victory-era">
        <h4>${esc(h.eraName)}</h4>
        <div class="victory-seeds">Started with: ${seeds}</div>
        ${renderEraStatCards(h)}
        <p class="victory-narrative">${esc(h.advancementNarrative)}</p>
        <div class="victory-items">${topItems}${h.discoveredItems.length > 8 ? '\u2026' : ''}</div>
        <div class="victory-graph-wrap"><canvas class="victory-graph" id="scoreboard-graph-${i}"></canvas></div>
      </div>
    `;
  }).join('');

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

  requestAnimationFrame(() => {
    history.forEach((h, i) => {
      const canvas = document.getElementById(`scoreboard-graph-${i}`) as HTMLCanvasElement | null;
      if (!canvas || h.actions.length === 0) return;
      const seedNames = h.startingSeeds.map((s) => s.replace(/^.+\s/, ''));
      renderCombinationGraph(canvas, h.actions, seedNames);
    });
  });
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
    .map((h, i) => {
      const seeds = h.startingSeeds.map(esc).join("  ");
      const topItems = h.discoveredItems.slice(0, 8).map(esc).join(", ");
      return `
        <div class="victory-era">
          <h4>${esc(h.eraName)}</h4>
          <div class="victory-seeds">Started with: ${seeds}</div>
          ${renderEraStatCards(h)}
          <p class="victory-narrative">${esc(h.advancementNarrative)}</p>
          <div class="victory-items">${topItems}${h.discoveredItems.length > 8 ? "..." : ""}</div>
          <div class="victory-graph-wrap"><canvas class="victory-graph" id="victory-graph-${i}"></canvas></div>
        </div>
      `;
    })
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
  requestAnimationFrame(() => {
    eraManager.history.forEach((h, i) => {
      const canvas = document.getElementById(`victory-graph-${i}`) as HTMLCanvasElement | null;
      if (!canvas || h.actions.length === 0) return;
      const seedNames = h.startingSeeds.map((s) => s.replace(/^.+\s/, "")); // strip emoji prefix
      renderCombinationGraph(canvas, h.actions, seedNames);
    });
  });
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

chartEraBtn.addEventListener("click", () => {
  if (!pendingEraResult) return;
  const result = pendingEraResult;
  pendingEraResult = null;
  chartEraBtn.classList.remove("visible");
  busy = true;
  doEraTransition(result);
});

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
  // Spawn a workspace item at cursor and start dragging immediately
  div.addEventListener("pointerdown", (e) => {
    if (busy) return;
    e.preventDefault();
    const rect = workspace.getBoundingClientRect();
    const x = e.clientX - rect.left - 36;
    const y = e.clientY - rect.top - 36;
    const item = spawnItem(entry, x, y);
    eraSpawnCounts[entry.name] = (eraSpawnCounts[entry.name] ?? 0) + 1;
    eraSpawnByTier[entry.tier] = (eraSpawnByTier[entry.tier] ?? 0) + 1;
    posthog.capture('tile_spawned', { item: entry.name, tier: entry.tier, era_name: eraManager.current.name });
    dragItem = item;
    dragOffsetX = 36;
    dragOffsetY = 36;
    // Switch to fixed immediately so the tile is visible over the palette
    item.el.style.position = 'fixed';
    item.el.style.left = `${e.clientX - 36}px`;
    item.el.style.top = `${e.clientY - 36}px`;
    item.el.style.zIndex = "10";
  });
  paletteItems.appendChild(div);
}

const MAX_DISCOVERED_SLOTS = 3;

function addToPaletteIfNew(entry: ElementData) {
  const exists = paletteItems.querySelector(`[data-name="${entry.name}"]`);
  if (exists) return;
  const discovered = paletteItems.querySelectorAll(".palette-item:not([data-seed])");
  if (discovered.length >= MAX_DISCOVERED_SLOTS) {
    discovered[0].remove();
  }
  addToPalette(entry, false);
}

// --- Toast notification ---
let toastTimer: number;
function showToast(msg: string, durationMs: number | null = 2000) {
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
  unsubAuth();
  authStore.setState({ resetGame: null });
  clearTimeout(toastTimer);
  document.removeEventListener("pointermove", handlePointerMove);
  document.removeEventListener("pointerup", handlePointerUp);
  eraToastBtn.removeEventListener("click", handleEraToastClose);
  restartButton.removeEventListener("click", handleRestart);
  demoResetConfirmBtn.removeEventListener("click", handleDemoResetConfirm);
  demoResetCancelBtn.removeEventListener("click", handleDemoResetCancel);
  victoryShareBtn.removeEventListener("click", handleVictoryShare);
  scoreboardBtn.removeEventListener("click", showScoreboard);
  document.removeEventListener("keydown", handleKeyDown);
  app.innerHTML = "";
};
}
