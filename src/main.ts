import type { Tier, ElementData, ModelId, ActionLogEntry, EraHistory } from "./types";
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
import posthog from "posthog-js";

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

function renderGoals() {
  const goalsEl = document.getElementById("era-goals")!;
  const goal = eraManager.current.goals[0];
  if (!goal) { goalsEl.innerHTML = ""; return; }
  const metCount = goal.conditions.filter((c) => c.met).length;
  goalsEl.innerHTML = `
    <div class="era-goal-header">Complete ${goal.requiredCount} of ${goal.conditions.length} (${metCount}/${goal.requiredCount})</div>
    ${goal.conditions
      .map((c) => `
        <div class="era-goal${c.met ? " met" : ""}">${c.description}</div>
        ${c.met && c.narrative ? `<div class="era-goal-narrative">${c.narrative}</div>` : ""}
      `)
      .join("")}
  `;
}

function renderEraName() {
  document.getElementById("era-name")!.textContent = eraManager.current.name;
}

app.innerHTML = `
  <div id="palette">
    <div id="era-display">
      <div id="era-name"></div>
      <div id="era-goals"></div>
    </div>
    <div id="model-selector">
      <label for="model-select">Model</label>
      <select id="model-select">${modelOptions}</select>
    </div>
    <h2>Inventory</h2>
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
  <div id="workspace"></div>
  <div id="result-toast"></div>
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
      <p class="victory-subtitle">Your civilization has transcended the ages</p>
      <div id="victory-timeline"></div>
      <div class="victory-actions">
        <button id="victory-share-btn">Share</button>
        <button id="victory-continue-btn">Continue Building</button>
      </div>
    </div>
  </div>
`;

const paletteItems = document.getElementById("palette-items")!;
const workspace = document.getElementById("workspace")!;
const toast = document.getElementById("result-toast")!;
const bari = document.getElementById("bari")!;
const modelSelect = document.getElementById("model-select") as HTMLSelectElement;
const eraToast = document.getElementById("era-toast")!;
const eraToastTitle = document.getElementById("era-toast-title")!;
const eraToastText = document.getElementById("era-toast-text")!;
const eraToastBtn = document.getElementById("era-toast-btn")!;

const victoryOverlay = document.getElementById("victory-overlay")!;
const victoryPanel = document.getElementById("victory-panel")!;
const victoryTimeline = document.getElementById("victory-timeline")!;
const victoryShareBtn = document.getElementById("victory-share-btn")!;
const restartButton = document.getElementById("restart-btn")!;
const demoResetOverlay = document.getElementById("demo-reset-overlay")!;
const demoResetConfirmBtn = document.getElementById("demo-reset-confirm-btn")!;
const demoResetCancelBtn = document.getElementById("demo-reset-cancel-btn")!;
const scoreboardOverlay = document.getElementById("scoreboard-overlay")!;
const scoreboardTimeline = document.getElementById("scoreboard-timeline")!;
const eraSummaryOverlay = document.getElementById("era-summary-overlay")!;
const scoreboardBtn = document.getElementById("scoreboard-btn")!;
const scoreboardCloseBtn = document.getElementById("scoreboard-close-btn")!;

const handleModelChange = () => {
  selectedModel = modelSelect.value as ModelId;
  log.info("system", `Model switched to ${selectedModel}`);
  posthog.capture('model_changed', { model: selectedModel });
};

const handleEraToastClose = () => {
  eraToast.classList.remove("visible");
};

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

modelSelect.addEventListener("change", handleModelChange);
eraToastBtn.addEventListener("click", handleEraToastClose);
restartButton.addEventListener("click", handleRestart);
demoResetConfirmBtn.addEventListener("click", handleDemoResetConfirm);
demoResetCancelBtn.addEventListener("click", handleDemoResetCancel);
scoreboardBtn.addEventListener("click", showScoreboard);
scoreboardCloseBtn.addEventListener("click", () => scoreboardOverlay.classList.remove("visible"));

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Escape" && scoreboardOverlay.classList.contains("visible")) {
    scoreboardOverlay.classList.remove("visible");
  }
};
document.addEventListener("keydown", handleKeyDown);

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
  modelSelect.value = save.selectedModel;

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
initDebugConsole({
  resetPlayer: handleDemoReset,
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
});

const savedGame = loadGame();
if (savedGame) {
  restoreGame(savedGame);
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
    <span class="item-emoji">${data.emoji}</span>
    <span class="item-name">${data.name}</span>
    <span class="tier-stars">${tierStars(data.tier)}</span>
    <div class="tooltip">
      <div class="tooltip-desc">${data.description}</div>
      <div class="tooltip-narrative">${data.narrative}</div>
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
    item.el.classList.remove("glow-green", "glow-red");
  }
}

function updateOverlapGlow(dragged: CombineItem) {
  clearAllGlow();
  const other = findOverlap(dragged);
  if (!other) return;

  if (dragged.name === other.name || dragged.tier === 5 || other.tier === 5) {
    dragged.el.classList.add("glow-red");
    other.el.classList.add("glow-red");
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
      const result = await combineElements(selectedModel, prompt, childTier, eraManager.current.name);
      elementData = { ...result, tier: childTier };
      await recipeStore.set(key, elementData);
      log.info("api", `Result: ${result.emoji} ${result.name} (${result.color})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error("api", `Combine failed: ${msg}`);
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

  // Save and check era advancement
  persistGame();
  checkEraAdvancement();

  pendingCombines--;
  if (eraAdvancing && pendingCombines === 0 && pendingEraResult) {
    const result = pendingEraResult;
    pendingEraResult = null;
    doEraTransition(result);
  }
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
  if (eraAdvancing) return;
  const hasAdvancedItem = eraActionLog.some((e) => e.resultTier >= 3);
  if (!hasAdvancedItem) return;
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
  );

  renderGoals();

  if (!result) return;
  if (eraAdvancing) return; // another call won the race while we awaited

  eraAdvancing = true;
  busy = true;

  if (pendingCombines === 0) {
    doEraTransition(result);
  } else {
    pendingEraResult = result;
  }
}

async function doEraTransition(result: { narrative: string }) {
  try {
    const inventory = getDiscoveredItems();
    const completedAt = Date.now();

    const fromEra = eraManager.current.name;
    const eraNumber = eraManager.history.length + 1;
    const combinationsInEra = eraActionLog.length;
    const itemsDiscoveredInEra = inventory.length;

    eraManager.recordHistory(eraActionLog, result.narrative, inventory, eraStartedAt, completedAt, eraSpawnCounts, eraSpawnByTier);
    eraActionLog = [];
    eraStartedAt = Date.now();
    eraSpawnCounts = {};
    eraSpawnByTier = {};

    if (eraManager.isLastEra) {
      log.info("era", "VICTORY — Space Age completed!");
      clearSave();
      victoryShown = true;
      showVictory();
      return; // busy + eraAdvancing stay true until player clicks Continue Building
    }

    showToast("Bari is charting the next age...", null);
    bari.classList.add("active");
    const choice = await eraManager.chooseNextEra(actionLog, inventory, selectedModel);
    bari.classList.remove("active");

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
      showEraSummary(completedRecord!, nextEra.name, choice.narrative, () => {
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
      });
    }
  } catch (err) {
    log.error("era", `Era transition failed: ${err}`);
    busy = false;
    eraAdvancing = false;
    pendingEraResult = null;
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
      <table class="era-tier-table">
        <thead><tr><th></th>${headerCells}</tr></thead>
        <tbody>
          <tr><td class="era-tier-label">placed</td>${placedCells}</tr>
          <tr><td class="era-tier-label">combos</td>${combosCells}</tr>
          <tr><td class="era-tier-label">discovered</td>${discoveredCells}</tr>
        </tbody>
      </table>`;
  }

  const favoriteRow = topSpawn
    ? `<div class="era-stat-favorite"><span class="era-stat-favorite-label">Favorite:</span> ${topSpawn[0]} &nbsp;<span class="era-stat-count">${topSpawn[1]}\u00D7</span></div>`
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

  if (erasCompleted === 0) {
    scoreboardTimeline.innerHTML = `<div class="scoreboard-empty">Complete your first era to see it here.</div>`;
    scoreboardOverlay.classList.add("visible");
    return;
  }

  const timelineHtml = history.map((h, i) => {
    const seeds = h.startingSeeds.join('\u00A0\u00A0');
    const topItems = h.discoveredItems.slice(0, 8).join(', ');
    return `
      <div class="victory-era">
        <h4>${h.eraName}</h4>
        <div class="victory-seeds">Started with: ${seeds}</div>
        ${renderEraStatCards(h)}
        <p class="victory-narrative">${h.advancementNarrative}</p>
        <div class="victory-items">${topItems}${h.discoveredItems.length > 8 ? '\u2026' : ''}</div>
        <canvas class="victory-graph" id="scoreboard-graph-${i}"></canvas>
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
}

function showVictory() {
  posthog.capture('game_completed', {
    total_eras: eraManager.history.length,
    total_combinations: actionLog.length,
    total_items_discovered: getDiscoveredItems().length,
  });
  // Set era name to The Age of Plenty
  document.getElementById("era-name")!.textContent = "The Age of Plenty";
  document.getElementById("era-goals")!.innerHTML =
    '<div class="era-goal met">Your civilization has transcended the ages</div>';

  // Build timeline
  victoryTimeline.innerHTML = eraManager.history
    .map((h, i) => {
      const seeds = h.startingSeeds.join("  ");
      const topItems = h.discoveredItems.slice(0, 8).join(", ");
      return `
        <div class="victory-era">
          <h4>${h.eraName}</h4>
          <div class="victory-seeds">Started with: ${seeds}</div>
          ${renderEraStatCards(h)}
          <p class="victory-narrative">${h.advancementNarrative}</p>
          <div class="victory-items">${topItems}${h.discoveredItems.length > 8 ? "..." : ""}</div>
          <canvas class="victory-graph" id="victory-graph-${i}"></canvas>
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
    // Use canvas to capture the victory panel
    const canvas = document.createElement("canvas");
    const rect = panel.getBoundingClientRect();
    const scale = 2; // retina
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);

    // Draw background
    ctx.fillStyle = "#16213e";
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw title
    ctx.fillStyle = "#ffd700";
    ctx.font = "bold 24px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("The Age of Plenty", rect.width / 2, 40);

    ctx.fillStyle = "#aaa";
    ctx.font = "14px system-ui";
    ctx.fillText("Your civilization has transcended the ages", rect.width / 2, 64);

    // Draw era history
    let y = 100;
    for (const h of eraManager.history) {
      ctx.fillStyle = "#ffd700";
      ctx.font = "bold 16px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(h.eraName, 24, y);
      y += 20;

      ctx.fillStyle = "#ccc";
      ctx.font = "12px system-ui";
      // Word-wrap narrative
      const words = h.advancementNarrative.split(" ");
      let line = "";
      for (const word of words) {
        const test = line + word + " ";
        if (ctx.measureText(test).width > rect.width - 48) {
          ctx.fillText(line.trim(), 24, y);
          y += 16;
          line = word + " ";
        } else {
          line = test;
        }
      }
      if (line.trim()) {
        ctx.fillText(line.trim(), 24, y);
        y += 16;
      }

      ctx.fillStyle = "#888";
      ctx.font = "11px system-ui";
      ctx.fillText(`${h.actions.length} combinations \u00B7 ${h.discoveredItems.length} items`, 24, y + 4);
      y += 30;
    }

    // Footer
    ctx.fillStyle = "#555";
    ctx.font = "10px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Bari \u2014 A Civilization Through the Ages", rect.width / 2, y + 10);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bari-victory.png";
      a.click();
      URL.revokeObjectURL(url);
    });
  } catch (err) {
    console.error("Share failed:", err);
    showToast("Could not save image", 3000);
  }
};

victoryShareBtn.addEventListener("click", handleVictoryShare);

document.getElementById("victory-continue-btn")!.addEventListener("click", () => {
  victoryOverlay.classList.remove("visible");
  busy = false;
  eraAdvancing = false;
});

// --- Palette management ---
function addToPalette(entry: ElementData, isSeed = false) {
  const div = document.createElement("div");
  div.className = "palette-item";
  div.dataset.name = entry.name;
  div.dataset.tier = String(entry.tier);
  if (isSeed) div.dataset.seed = "true";
  div.innerHTML = `
    <span class="palette-emoji">${entry.emoji}</span>
    <span class="palette-label">${entry.name}</span>
    <span class="palette-stars">${tierStars(entry.tier)}</span>
    <div class="tooltip">
      <div class="tooltip-desc">${entry.description}</div>
      <div class="tooltip-narrative">${entry.narrative}</div>
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
  modelSelect.removeEventListener("change", handleModelChange);
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
