import "./style.css";
import type { Tier, ElementData } from "./types.ts";
import { recipeKey } from "./types.ts";
import { fuseElements } from "./gemini.ts";
import { InMemoryRecipeStore } from "./recipes.ts";
import { FilePromptProvider } from "./prompt-loader.ts";

// --- Types ---
interface BreedItem {
  id: string;
  name: string;
  color: string;
  tier: Tier;
  el: HTMLElement;
  x: number;
  y: number;
}

// --- Providers ---
const recipeStore = new InMemoryRecipeStore();
const promptProvider = new FilePromptProvider();

// --- Seed palette (Tier 1) ---
const PALETTE: ElementData[] = [
  { name: "Fire", color: "#e94560", tier: 1 },
  { name: "Water", color: "#0f86a1", tier: 1 },
  { name: "Earth", color: "#6b4226", tier: 1 },
  { name: "Air", color: "#a8d8ea", tier: 1 },
  { name: "Plant", color: "#2d6a4f", tier: 1 },
  { name: "Stone", color: "#6c757d", tier: 1 },
];

// --- State ---
const items: BreedItem[] = [];
let idCounter = 0;
let dragItem: BreedItem | null = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

// --- DOM setup ---
const app = document.getElementById("app")!;
app.innerHTML = `
  <div id="palette">
    <h2>Elements</h2>
  </div>
  <div id="workspace"></div>
  <div id="result-toast"></div>
`;

const palette = document.getElementById("palette")!;
const workspace = document.getElementById("workspace")!;
const toast = document.getElementById("result-toast")!;

// --- Build palette ---
for (const entry of PALETTE) {
  addToPalette(entry);
}

// --- Workspace: accept drops from palette ---
workspace.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.dataTransfer!.dropEffect = "copy";
  workspace.classList.add("drag-over");
});

workspace.addEventListener("dragleave", () => {
  workspace.classList.remove("drag-over");
});

workspace.addEventListener("drop", (e) => {
  e.preventDefault();
  workspace.classList.remove("drag-over");
  const raw = e.dataTransfer!.getData("text/plain");
  if (!raw) return;
  try {
    const data = JSON.parse(raw) as ElementData;
    const rect = workspace.getBoundingClientRect();
    spawnItem(data.name, data.color, data.tier, e.clientX - rect.left - 32, e.clientY - rect.top - 32);
  } catch {
    // ignore non-JSON drags
  }
});

// --- Tier stars helper ---
function tierStars(tier: Tier): string {
  return "\u2B50".repeat(tier);
}

// --- Spawn a breed item in the workspace ---
function spawnItem(name: string, color: string, tier: Tier, x: number, y: number): BreedItem {
  const el = document.createElement("div");
  el.className = "breed-item";
  el.style.background = color;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.innerHTML = `${name}<span class="tier-stars">${tierStars(tier)}</span>`;
  workspace.appendChild(el);

  const item: BreedItem = { id: `item-${idCounter++}`, name, color, tier, el, x, y };
  items.push(item);

  // --- Pointer-based drag within workspace ---
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    dragItem = item;
    dragOffsetX = e.clientX - item.x - workspace.getBoundingClientRect().left;
    dragOffsetY = e.clientY - item.y - workspace.getBoundingClientRect().top;
    el.style.zIndex = "10";
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener("pointermove", (e) => {
    if (dragItem !== item) return;
    const rect = workspace.getBoundingClientRect();
    item.x = e.clientX - rect.left - dragOffsetX;
    item.y = e.clientY - rect.top - dragOffsetY;
    el.style.left = `${item.x}px`;
    el.style.top = `${item.y}px`;
    updateOverlapGlow(item);
  });

  el.addEventListener("pointerup", () => {
    if (dragItem !== item) return;
    el.style.zIndex = "1";
    clearAllGlow();
    checkOverlap(item);
    dragItem = null;
  });

  return item;
}

// --- Overlap glow helpers ---
function findOverlap(dragged: BreedItem): BreedItem | null {
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

function updateOverlapGlow(dragged: BreedItem) {
  clearAllGlow();
  const other = findOverlap(dragged);
  if (!other) return;

  if (dragged.tier === 5 || other.tier === 5) {
    dragged.el.classList.add("glow-red");
    other.el.classList.add("glow-red");
  } else {
    dragged.el.classList.add("glow-green");
    other.el.classList.add("glow-green");
  }
}

// --- Check if the dropped item overlaps another; if so, breed ---
function checkOverlap(dropped: BreedItem) {
  const other = findOverlap(dropped);
  if (!other) return;
  if (dropped.tier === 5 || other.tier === 5) return;
  breed(dropped, other);
}

// --- Breed two items into a new one ---
async function breed(a: BreedItem, b: BreedItem) {
  const key = recipeKey(a.name, b.name);
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;

  // Remove parents
  removeItem(a);
  removeItem(b);

  // Check recipe store (hardcoded + cached AI results)
  let elementData = await recipeStore.get(key);

  if (!elementData) {
    const childTier = Math.min(Math.max(a.tier, b.tier) + 1, 5) as Tier;

    showToast(`${a.name} + ${b.name} = ...thinking...`);
    try {
      const template = await promptProvider.getPrompt(childTier);
      const prompt = template.replace("{{a}}", a.name).replace("{{b}}", b.name);
      const result = await fuseElements(a.name, b.name, prompt);
      elementData = { ...result, tier: childTier };
      await recipeStore.set(key, elementData);
    } catch (err) {
      console.error("Fusion failed:", err);
      elementData = { name: `${a.name}+${b.name}`, color: "#daa520", tier: childTier };
    }
  }

  // Spawn child
  const child = spawnItem(elementData.name, elementData.color, elementData.tier, midX, midY);
  child.el.classList.add("merging");
  setTimeout(() => child.el.classList.remove("merging"), 400);

  showToast(`${a.name} + ${b.name} = ${elementData.name}`);
  addToPaletteIfNew(elementData);
}

function removeItem(item: BreedItem) {
  item.el.remove();
  const idx = items.indexOf(item);
  if (idx !== -1) items.splice(idx, 1);
}

// --- Palette management ---
function addToPalette(entry: ElementData) {
  const div = document.createElement("div");
  div.className = "palette-item";
  div.draggable = true;
  div.dataset.name = entry.name;
  div.innerHTML = `
    <div class="palette-swatch" style="background:${entry.color}"></div>
    <span class="palette-label">${entry.name}</span>
  `;
  div.addEventListener("dragstart", (e) => {
    e.dataTransfer!.setData("text/plain", JSON.stringify(entry));
    e.dataTransfer!.effectAllowed = "copy";
  });
  palette.appendChild(div);
}

function addToPaletteIfNew(entry: ElementData) {
  const exists = palette.querySelector(`[data-name="${entry.name}"]`);
  if (exists) return;
  addToPalette(entry);
}

// --- Toast notification ---
let toastTimer: number;
function showToast(msg: string) {
  toast.textContent = msg;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2000);
}
