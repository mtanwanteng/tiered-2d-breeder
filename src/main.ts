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
        <button id="scoreboard-close-btn">\u2715</button>
      </div>
      <div id="scoreboard-timeline"></div>
    </div>
  </div>
  <button id="scoreboard-btn" title="View Scoreboard">\uD83D\uDCDC</button>
  <div id="era-summary-overlay">
    <div id="era-summary-panel">
      <div class="era-summary-header">
        <div class="era-summary-complete-badge">\u2714 Era Complete</div>
        <h2 id="era-summary-era-name"></h2>
      </div>
      <div id="era-summary-stat-cards"></div>
      <div id="era-summary-tile-detail"></div>
      <p class="era-summary-narrative" id="era-summary-narrative"></p>
      <div class="era-summary-discovered" id="era-summary-discovered"></div>
      <div class="era-summary-next">
        <div class="era-summary-next-label">\u2193 Next Era</div>
        <h3 id="era-summary-next-name"></h3>
        <p class="era-summary-next-text" id="era-summary-next-text"></p>
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
  clearSave();
  location.reload();
};

modelSelect.addEventListener("change", handleModelChange);
eraToastBtn.addEventListener("click", handleEraToastClose);
restartButton.addEventListener("click", handleRestart);
scoreboardBtn.addEventListener("click", showScoreboard);
scoreboardCloseBtn.addEventListener("click", () => scoreboardOverlay.classList.remove("visible"));

// --- Save/Load ---
function persistGame() {
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

  // Rebuild palette
  paletteItems.innerHTML = "";
  for (const entry of save.paletteItems) {
    addToPalette(entry);
  }

  renderEraName();
  renderGoals();
  log.info("system", `Game restored: ${eraManager.current.name}, ${actionLog.length} total actions`);
}

// --- Initialize ---
initDebugConsole({
  testVictory: () => {
    // Inject mock history if none exists
    if (eraManager.history.length === 0) {
      const now = Date.now();
      const mockActions = [
        { timestamp: now, parentA: "Fire", parentB: "Stone", result: "Flint Tool", resultTier: 2 as Tier },
        { timestamp: now, parentA: "Flint Tool", parentB: "Wood", result: "Spear", resultTier: 3 as Tier },
        { timestamp: now, parentA: "Seed", parentB: "Water", result: "Crop", resultTier: 2 as Tier },
        { timestamp: now, parentA: "Crop", parentB: "Beast", result: "Farm", resultTier: 3 as Tier },
        { timestamp: now, parentA: "Spear", parentB: "Farm", result: "Settlement", resultTier: 4 as Tier },
        { timestamp: now, parentA: "Settlement", parentB: "Fire", result: "Village", resultTier: 5 as Tier },
      ];
      eraManager.history.push(
        {
          eraName: "Stone Age",
          startingSeeds: ["\uD83D\uDD25 Fire", "\uD83E\uDEA8 Stone", "\uD83D\uDCA7 Water", "\uD83E\uDDAC Beast", "\uD83E\uDEB5 Wood", "\uD83C\uDF31 Seed"],
          actions: mockActions,
          advancementNarrative: "From stone tools to the first settlements, your people mastered fire and earth.",
          discoveredItems: ["Fire", "Stone", "Water", "Beast", "Wood", "Seed", "Flint Tool", "Spear", "Crop", "Farm", "Settlement", "Village"],
        },
        {
          eraName: "Bronze Age",
          startingSeeds: ["\u2699\uFE0F Metal", "\uD83C\uDF3E Grain", "\uD83C\uDFFA Clay", "\uD83D\uDC02 Ox", "\uD83C\uDF0A River", "\u2600\uFE0F Sun"],
          actions: [
            { timestamp: now, parentA: "Metal", parentB: "Clay", result: "Bronze", resultTier: 2 as Tier },
            { timestamp: now, parentA: "Bronze", parentB: "Grain", result: "Plow", resultTier: 3 as Tier },
            { timestamp: now, parentA: "Plow", parentB: "River", result: "Irrigation", resultTier: 4 as Tier },
            { timestamp: now, parentA: "Irrigation", parentB: "Sun", result: "Calendar", resultTier: 5 as Tier },
          ],
          advancementNarrative: "Bronze tools and irrigation transformed nomads into city-builders.",
          discoveredItems: ["Metal", "Grain", "Clay", "Ox", "River", "Sun", "Bronze", "Plow", "Irrigation", "Calendar"],
        },
      );
    }
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
    addToPalette(entry);
  }
  posthog.capture('game_started', { era_name: eraManager.current.name });
}

// --- Document-level pointer drag handlers ---
const handlePointerMove = (e: PointerEvent) => {
  if (!dragItem) return;
  const rect = workspace.getBoundingClientRect();
  dragItem.x = e.clientX - rect.left - dragOffsetX;
  dragItem.y = e.clientY - rect.top - dragOffsetY;
  dragItem.el.style.left = `${dragItem.x}px`;
  dragItem.el.style.top = `${dragItem.y}px`;
  updateOverlapGlow(dragItem);
};

const handlePointerUp = (e: PointerEvent) => {
  if (!dragItem) return;
  const item = dragItem;
  dragItem = null;
  item.el.style.zIndex = "1";
  clearAllGlow();

  // If released outside the workspace, remove the item
  const rect = workspace.getBoundingClientRect();
  if (e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top || e.clientY > rect.bottom) {
    removeItem(item);
    return;
  }

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
  if (eraAdvancing) return;
  const hasAdvancedItem = eraActionLog.some((e) => e.resultTier >= 3);
  if (!hasAdvancedItem) return;
  log.debug("era", "Checking era advancement...");

  const tier5Count = eraActionLog.filter((e) => e.resultTier === 5).length;
  const inventory = getDiscoveredItems();

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
      showVictory();
      return;
    }

    showToast("Bari is charting the next age...", 5000);
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
        for (const seed of newSeeds) addToPalette(seed);
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

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
}

function renderEraStatCards(h: { actions: { length: number }; discoveredItems: string[]; eraStartedAt?: number; eraCompletedAt?: number; tileSpawnCounts?: Record<string, number>; tileSpawnByTier?: Record<number, number> }): string {
  const durationMs = h.eraStartedAt && h.eraCompletedAt ? h.eraCompletedAt - h.eraStartedAt : null;
  const totalSpawned = h.tileSpawnCounts ? Object.values(h.tileSpawnCounts).reduce((a, b) => a + b, 0) : null;
  const byTier = h.tileSpawnByTier;
  const topSpawn = h.tileSpawnCounts ? Object.entries(h.tileSpawnCounts).sort((a, b) => b[1] - a[1])[0] : null;

  const statCards = [
    durationMs !== null ? `<div class="era-stat"><div class="era-stat-value">${formatDuration(durationMs)}</div><div class="era-stat-label">Time</div></div>` : '',
    totalSpawned !== null ? `<div class="era-stat"><div class="era-stat-value">${totalSpawned}</div><div class="era-stat-label">Tiles Placed</div></div>` : '',
    `<div class="era-stat"><div class="era-stat-value">${h.actions.length}</div><div class="era-stat-label">Combos</div></div>`,
    `<div class="era-stat"><div class="era-stat-value">${h.discoveredItems.length}</div><div class="era-stat-label">Discovered</div></div>`,
  ].filter(Boolean).join('');

  const tierRow = byTier
    ? `<div class="era-stat-tier-row">${[1, 2, 3, 4, 5].filter(t => byTier[t]).map(t => `<span class="era-stat-tier-chip">gen${t}: ${byTier[t]}</span>`).join('')}</div>`
    : '';

  const favoriteRow = topSpawn
    ? `<div class="era-stat-favorite">\u2605 ${topSpawn[0]} &nbsp;<span class="era-stat-count">${topSpawn[1]}\u00D7</span></div>`
    : '';

  return `<div class="era-stat-grid">${statCards}</div>${tierRow}${favoriteRow}`;
}

function showEraSummary(record: EraHistory, nextEraName: string, nextNarrative: string, onContinue: () => void) {
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
  const currentItems = getDiscoveredItems();
  const now = Date.now();

  const historyHtml = eraManager.history.map(h => {
    const topItems = h.discoveredItems.slice(0, 12).join(", ");
    return `
      <div class="scoreboard-era completed">
        <div class="scoreboard-era-header">
          <h4>${h.eraName}</h4>
          <span class="scoreboard-era-badge">\u2714 Complete</span>
        </div>
        ${renderEraStatCards(h)}
        <p class="scoreboard-narrative">${h.advancementNarrative}</p>
        ${topItems ? `<div class="scoreboard-items">${topItems}${h.discoveredItems.length > 12 ? "\u2026" : ""}</div>` : ""}
      </div>
    `;
  }).join("");

  const currentDurationMs = now - eraStartedAt;
  const currentTotalSpawned = Object.values(eraSpawnCounts).reduce((a, b) => a + b, 0);
  const currentByTier = eraSpawnByTier;
  const currentTopSpawn = Object.entries(eraSpawnCounts).sort((a, b) => b[1] - a[1])[0];
  const currentTierRow = Object.keys(currentByTier).length > 0
    ? `<div class="era-stat-tier-row">${[1,2,3,4,5].filter(t => currentByTier[t]).map(t => `<span class="era-stat-tier-chip">gen${t}: ${currentByTier[t]}</span>`).join('')}</div>`
    : '';
  const currentFav = currentTopSpawn
    ? `<div class="era-stat-favorite">\u2605 ${currentTopSpawn[0]} &nbsp;<span class="era-stat-count">${currentTopSpawn[1]}\u00D7</span></div>`
    : '';
  const currentStatCards = [
    `<div class="era-stat"><div class="era-stat-value">${formatDuration(currentDurationMs)}</div><div class="era-stat-label">Time</div></div>`,
    currentTotalSpawned > 0 ? `<div class="era-stat"><div class="era-stat-value">${currentTotalSpawned}</div><div class="era-stat-label">Tiles Placed</div></div>` : '',
    `<div class="era-stat"><div class="era-stat-value">${eraActionLog.length}</div><div class="era-stat-label">Combos</div></div>`,
    `<div class="era-stat"><div class="era-stat-value">${currentItems.length}</div><div class="era-stat-label">Discovered</div></div>`,
  ].filter(Boolean).join('');

  const currentHtml = `
    <div class="scoreboard-era current">
      <div class="scoreboard-era-header">
        <h4>${eraManager.current.name}</h4>
        <span class="scoreboard-era-badge current-badge">In Progress</span>
      </div>
      <div class="era-stat-grid">${currentStatCards}</div>
      ${currentTierRow}${currentFav}
    </div>
  `;

  // Totals
  const totalCombos = actionLog.length;
  const totalItems = eraManager.history.reduce((n, h) => n + h.discoveredItems.length, currentItems.length);
  const totalEras = eraManager.history.length + 1;
  const totalMs = eraManager.history.reduce((ms, h) =>
    ms + (h.eraStartedAt && h.eraCompletedAt ? h.eraCompletedAt - h.eraStartedAt : 0), currentDurationMs);

  const totalsHtml = `
    <div class="scoreboard-totals-section">
      <div class="scoreboard-total-stat"><div class="scoreboard-total-value">${formatDuration(totalMs)}</div><div class="scoreboard-total-label">Total Time</div></div>
      <div class="scoreboard-total-stat"><div class="scoreboard-total-value">${totalCombos}</div><div class="scoreboard-total-label">Combinations</div></div>
      <div class="scoreboard-total-stat"><div class="scoreboard-total-value">${totalItems}</div><div class="scoreboard-total-label">Items Found</div></div>
      <div class="scoreboard-total-stat"><div class="scoreboard-total-value">${totalEras}</div><div class="scoreboard-total-label">Eras</div></div>
    </div>
  `;

  scoreboardTimeline.innerHTML = historyHtml + currentHtml + totalsHtml;
  scoreboardOverlay.classList.add("visible");
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
      const combineCount = h.actions.length;
      return `
        <div class="victory-era">
          <h4>${h.eraName}</h4>
          <div class="victory-seeds">Started with: ${seeds}</div>
          <p class="victory-narrative">${h.advancementNarrative}</p>
          <div class="victory-stats">
            <span>${combineCount} combinations</span>
            <span>${h.discoveredItems.length} items discovered</span>
          </div>
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

// --- Palette management ---
function addToPalette(entry: ElementData) {
  const div = document.createElement("div");
  div.className = "palette-item";
  div.dataset.name = entry.name;
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
    item.el.style.zIndex = "10";
  });
  paletteItems.appendChild(div);
}

function addToPaletteIfNew(entry: ElementData) {
  const exists = paletteItems.querySelector(`[data-name="${entry.name}"]`);
  if (exists) return;
  addToPalette(entry);
}

// --- Toast notification ---
let toastTimer: number;
function showToast(msg: string, durationMs = 2000) {
  toast.textContent = msg;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), durationMs);
}

// Expose game reset to React auth layer (called on sign-out)
authStore.setState({
  resetGame: () => {
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
  victoryShareBtn.removeEventListener("click", handleVictoryShare);
  scoreboardBtn.removeEventListener("click", showScoreboard);
  app.innerHTML = "";
};
}
