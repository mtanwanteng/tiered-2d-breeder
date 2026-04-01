import "./style.css";
import type { Tier, ElementData, ModelId, ActionLogEntry } from "./types.ts";
import { recipeKey, MODELS } from "./types.ts";
import { combineElements } from "./gemini.ts";
import { InMemoryRecipeStore } from "./recipes.ts";
import { FilePromptProvider } from "./prompt-loader.ts";
import { EraManager } from "./era-manager.ts";
import { log } from "./logger.ts";
import { initDebugConsole } from "./debug-console.ts";

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

// --- Providers ---
const recipeStore = new InMemoryRecipeStore();
const promptProvider = new FilePromptProvider();
const eraManager = new EraManager();

// --- State ---
let selectedModel: ModelId = MODELS[0].id;
const items: CombineItem[] = [];
const actionLog: ActionLogEntry[] = [];
let eraActionLog: ActionLogEntry[] = [];
let idCounter = 0;
let dragItem: CombineItem | null = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

// --- DOM setup ---
const app = document.getElementById("app")!;
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
    <h2>Inventory</h2>
    <div id="era-display">
      <div id="era-name"></div>
      <div id="era-goals"></div>
    </div>
    <div id="model-selector">
      <label for="model-select">Model</label>
      <select id="model-select">${modelOptions}</select>
    </div>
    <div id="palette-items"></div>
    <div id="bari">\uD83D\uDC66</div>
  </div>
  <div id="workspace"></div>
  <div id="result-toast"></div>
  <div id="era-toast">
    <h3 id="era-toast-title"></h3>
    <p id="era-toast-text"></p>
    <button id="era-toast-btn">Continue</button>
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
const victoryTimeline = document.getElementById("victory-timeline")!;
const victoryShareBtn = document.getElementById("victory-share-btn")!;

modelSelect.addEventListener("change", () => {
  selectedModel = modelSelect.value as ModelId;
  log.info("system", `Model switched to ${selectedModel}`);
});

eraToastBtn.addEventListener("click", () => {
  eraToast.classList.remove("visible");
});

// --- Initialize ---
initDebugConsole();

renderEraName();
renderGoals();
const initialSeeds = eraManager.getSeeds();
log.info("era", `Starting ${eraManager.current.name} with seeds: ${initialSeeds.map((s) => s.name).join(", ")}`);
for (const entry of initialSeeds) {
  addToPalette(entry);
}

// --- Document-level pointer drag handlers ---
document.addEventListener("pointermove", (e) => {
  if (!dragItem) return;
  const rect = workspace.getBoundingClientRect();
  dragItem.x = e.clientX - rect.left - dragOffsetX;
  dragItem.y = e.clientY - rect.top - dragOffsetY;
  dragItem.el.style.left = `${dragItem.x}px`;
  dragItem.el.style.top = `${dragItem.y}px`;
  updateOverlapGlow(dragItem);
});

document.addEventListener("pointerup", (e) => {
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
});

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
  const other = findOverlap(dropped);
  if (!other) return;
  if (dropped.name === other.name || dropped.tier === 5 || other.tier === 5) return;
  combine(dropped, other);
}

// --- Combine two items into a new one ---
async function combine(a: CombineItem, b: CombineItem) {
  const key = recipeKey(a.name, b.name);
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;

  // Remove parents
  removeItem(a);
  removeItem(b);

  // Check recipe store (cached AI results)
  let elementData = await recipeStore.get(key);

  if (elementData) {
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
      const result = await combineElements(selectedModel, prompt);
      elementData = { ...result, tier: childTier };
      await recipeStore.set(key, elementData);
      log.info("api", `Result: ${result.emoji} ${result.name} (${result.color})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error("api", `Combine failed: ${msg}`);
      if (msg.includes("gcloud auth") || msg.includes("invalid_grant") || msg.includes("RAPT")) {
        showToast("\u26A0\uFE0F GCP auth expired — run: gcloud auth application-default login", 8000);
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

  // Spawn child
  const child = spawnItem(elementData, midX, midY);
  child.el.classList.add("merging");
  setTimeout(() => child.el.classList.remove("merging"), 400);

  showToast(`${a.emoji} ${a.name} + ${b.emoji} ${b.name} = ${elementData.emoji} ${elementData.name}`);
  addToPaletteIfNew(elementData);

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

  // Check era advancement
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
  // Don't check advancement until the player has created something beyond tier 2
  const hasAdvancedItem = eraActionLog.some((e) => e.resultTier >= 3);
  if (!hasAdvancedItem) return;
  log.debug("era", "Checking era advancement...");

  const tier5Count = eraActionLog.filter((e) => e.resultTier === 5).length;
  const inventory = getDiscoveredItems();

  const result = await eraManager.checkAdvancement(
    actionLog,
    inventory,
    tier5Count,
    selectedModel,
  );

  // Re-render goals to show newly checked-off conditions
  renderGoals();

  if (!result) return;

  // Record this era's history
  eraManager.recordHistory(eraActionLog, result.narrative, inventory);
  eraActionLog = [];

  // Check if this was the last era (Space Age)
  if (eraManager.isLastEra) {
    log.info("era", "VICTORY — Space Age completed!");
    showVictory();
    return;
  }

  // Ask AI which era to advance to
  showToast("Bari is charting the next age...", 5000);
  bari.classList.add("active");
  const choice = await eraManager.chooseNextEra(actionLog, inventory, selectedModel);
  bari.classList.remove("active");

  const nextEra = eraManager.advanceTo(choice.era.name);
  if (nextEra) {
    log.info("era", `Era advanced to: ${nextEra.name}`);
    showEraToast(`${nextEra.name} Begins!`, choice.narrative);
    // Clear workspace
    for (const item of [...items]) removeItem(item);
    // Clear palette and load new seeds
    paletteItems.innerHTML = "";
    const newSeeds = eraManager.getSeeds();
    log.info("era", `Seeds: ${newSeeds.map((s) => s.name).join(", ")}`);
    for (const seed of newSeeds) addToPalette(seed);
    renderEraName();
    renderGoals();
  }
}

function showEraToast(title: string, text: string) {
  eraToastTitle.textContent = title;
  eraToastText.textContent = text;
  eraToast.classList.add("visible");
}

function showVictory() {
  // Set era name to The Age of Plenty
  document.getElementById("era-name")!.textContent = "The Age of Plenty";
  document.getElementById("era-goals")!.innerHTML =
    '<div class="era-goal met">Your civilization has transcended the ages</div>';

  // Build timeline
  victoryTimeline.innerHTML = eraManager.history
    .map((h) => {
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
        </div>
      `;
    })
    .join("");

  victoryOverlay.classList.add("visible");
}

victoryShareBtn.addEventListener("click", async () => {
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
});

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
    e.preventDefault();
    const rect = workspace.getBoundingClientRect();
    const x = e.clientX - rect.left - 36;
    const y = e.clientY - rect.top - 36;
    const item = spawnItem(entry, x, y);
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
