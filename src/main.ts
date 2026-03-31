import "./style.css";
import { fuseElements } from "./gemini.ts";

// --- Types ---
interface BreedItem {
  id: string;
  name: string;
  color: string;
  el: HTMLElement;
  x: number;
  y: number;
}

// --- Seed palette ---
const PALETTE = [
  { name: "Fire", color: "#e94560" },
  { name: "Water", color: "#0f86a1" },
  { name: "Earth", color: "#6b4226" },
  { name: "Air", color: "#a8d8ea" },
  { name: "Plant", color: "#2d6a4f" },
  { name: "Stone", color: "#6c757d" },
];

// --- Combination rules (order-independent) ---
const RECIPES: Record<string, { name: string; color: string }> = {
  "Fire+Water": { name: "Steam", color: "#b0c4de" },
  "Fire+Earth": { name: "Lava", color: "#cf1020" },
  "Fire+Air": { name: "Smoke", color: "#708090" },
  "Fire+Plant": { name: "Ash", color: "#4a4a4a" },
  "Water+Earth": { name: "Mud", color: "#8b6914" },
  "Water+Air": { name: "Mist", color: "#d3e8ef" },
  "Water+Plant": { name: "Algae", color: "#3a7d44" },
  "Earth+Air": { name: "Dust", color: "#c2b280" },
  "Earth+Plant": { name: "Forest", color: "#1b4332" },
  "Air+Plant": { name: "Pollen", color: "#f4e285" },
  "Fire+Stone": { name: "Metal", color: "#aaa9ad" },
  "Water+Stone": { name: "Sand", color: "#c2b280" },
  "Air+Stone": { name: "Gravel", color: "#8d8680" },
  "Plant+Stone": { name: "Moss", color: "#4a7c59" },
};

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
    const data = JSON.parse(raw) as { name: string; color: string };
    const rect = workspace.getBoundingClientRect();
    spawnItem(data.name, data.color, e.clientX - rect.left - 32, e.clientY - rect.top - 32);
  } catch {
    // ignore non-JSON drags
  }
});

// --- Spawn a breed item in the workspace ---
function spawnItem(name: string, color: string, x: number, y: number): BreedItem {
  const el = document.createElement("div");
  el.className = "breed-item";
  el.style.background = color;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.textContent = name;
  workspace.appendChild(el);

  const item: BreedItem = { id: `item-${idCounter++}`, name, color, el, x, y };
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
  });

  el.addEventListener("pointerup", () => {
    if (dragItem !== item) return;
    el.style.zIndex = "1";
    checkOverlap(item);
    dragItem = null;
  });

  return item;
}

// --- Check if the dropped item overlaps another; if so, breed ---
function checkOverlap(dropped: BreedItem) {
  for (const other of items) {
    if (other.id === dropped.id) continue;
    const dx = dropped.x - other.x;
    const dy = dropped.y - other.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 48) {
      breed(dropped, other);
      return;
    }
  }
}

// --- Breed two items into a new one ---
async function breed(a: BreedItem, b: BreedItem) {
  const key1 = `${a.name}+${b.name}`;
  const key2 = `${b.name}+${a.name}`;
  const hardcoded = RECIPES[key1] ?? RECIPES[key2];

  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;

  // Remove parents
  removeItem(a);
  removeItem(b);

  let result: { name: string; color: string };

  if (hardcoded) {
    result = hardcoded;
  } else {
    // Use Gemini for unknown combinations
    showToast(`${a.name} + ${b.name} = ...thinking...`);
    try {
      result = await fuseElements(a.name, b.name);
      // Cache for future use
      RECIPES[key1] = result;
    } catch (err) {
      console.error("Gemini fusion failed:", err);
      result = { name: `${a.name}+${b.name}`, color: "#daa520" };
    }
  }

  // Spawn child
  const child = spawnItem(result.name, result.color, midX, midY);
  child.el.classList.add("merging");
  setTimeout(() => child.el.classList.remove("merging"), 400);

  showToast(`${a.name} + ${b.name} = ${result.name}`);

  // Add the result to the palette if it's new
  addToPaletteIfNew(result.name, result.color);
}

function removeItem(item: BreedItem) {
  item.el.remove();
  const idx = items.indexOf(item);
  if (idx !== -1) items.splice(idx, 1);
}

function addToPaletteIfNew(name: string, color: string) {
  const exists = palette.querySelector(`[data-name="${name}"]`);
  if (exists) return;

  const div = document.createElement("div");
  div.className = "palette-item";
  div.draggable = true;
  div.dataset.name = name;
  div.innerHTML = `
    <div class="palette-swatch" style="background:${color}"></div>
    <span class="palette-label">${name}</span>
  `;
  div.addEventListener("dragstart", (e) => {
    e.dataTransfer!.setData("text/plain", JSON.stringify({ name, color }));
    e.dataTransfer!.effectAllowed = "copy";
  });
  palette.appendChild(div);
}

// --- Toast notification ---
let toastTimer: number;
function showToast(msg: string) {
  toast.textContent = msg;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2000);
}
