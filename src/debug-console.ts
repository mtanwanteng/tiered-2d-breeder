import { log } from "./logger";
import type { LogLevel, LogCategory, LogEntry } from "./logger";

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "#888",
  info: "#8cf",
  warn: "#fc5",
  error: "#f55",
};

const CATEGORY_COLORS: Record<LogCategory, string> = {
  player: "#8f8",
  api: "#c8f",
  game: "#ff8",
  era: "#fca",
  system: "#aaa",
};

const ALL_LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];
const ALL_CATEGORIES: LogCategory[] = ["player", "api", "game", "era", "system"];

export interface DebugActions {
  testVictory?: () => void;
  resetPlayer?: () => void;
  modelOptions?: string;
  onModelChange?: (modelId: string) => void;
  showHeatmap?: () => void;
}

export function initDebugConsole(actions?: DebugActions): { modelSelect: HTMLSelectElement | null } {
  const isProd = process.env.NEXT_PUBLIC_VERCEL_ENV === "production";

  // Toggle button
  const toggle = document.createElement("button");
  toggle.id = "debug-toggle";
  toggle.textContent = "\uD83D\uDC1B";
  toggle.title = "Debug Console";
  document.body.appendChild(toggle);

  // Panel
  const panel = document.createElement("div");
  panel.id = "debug-panel";
  panel.innerHTML = `
    <div id="debug-header">
      <span>Debug Console</span>
      <div id="debug-filters">
        <select id="debug-level-filter">
          ${ALL_LEVELS.map((l) => `<option value="${l}"${l === "debug" ? " selected" : ""}>${l}</option>`).join("")}
        </select>
        ${ALL_CATEGORIES.map((c) => `<label class="debug-cat-label"><input type="checkbox" data-cat="${c}" checked><span style="color:${CATEGORY_COLORS[c]}">${c}</span></label>`).join("")}
      </div>
      ${actions?.modelOptions ? `<select id="debug-model-select">${actions.modelOptions}</select>` : ''}
      <button id="debug-clear">Clear</button>
      ${!isProd ? `<button id="debug-test-victory">Test Victory</button>` : ''}
      ${!isProd ? `<button id="debug-reset-player">Reset Player</button>` : ''}
      <button id="debug-heatmap">Heatmap</button>
    </div>
    <div id="debug-log"></div>
  `;
  document.body.appendChild(panel);

  const logEl = document.getElementById("debug-log")!;
  const levelFilter = document.getElementById("debug-level-filter") as HTMLSelectElement;

  function formatTime(ts: number): string {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  }

  function appendEntry(entry: LogEntry) {
    const show =
      (log.getFiltered().indexOf(entry) !== -1) ||
      // For new entries, check inline
      ((["debug", "info", "warn", "error"].indexOf(entry.level) >=
        ["debug", "info", "warn", "error"].indexOf(log.minLevel)) &&
        log.activeCategories.has(entry.category));

    if (!show) return;

    const div = document.createElement("div");
    div.className = "debug-entry";
    div.innerHTML = `<span class="debug-time">${formatTime(entry.timestamp)}</span> <span style="color:${LEVEL_COLORS[entry.level]}">[${entry.level}]</span> <span style="color:${CATEGORY_COLORS[entry.category]}">[${entry.category}]</span> ${escapeHtml(entry.message)}`;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function rerender() {
    logEl.innerHTML = "";
    for (const entry of log.getFiltered()) appendEntry(entry);
  }

  // Wire up events
  log.onEntry((entry) => appendEntry(entry));

  toggle.addEventListener("click", () => {
    panel.classList.toggle("visible");
  });

  levelFilter.addEventListener("change", () => {
    log.minLevel = levelFilter.value as LogLevel;
    rerender();
  });

  for (const cb of panel.querySelectorAll<HTMLInputElement>("input[data-cat]")) {
    cb.addEventListener("change", () => {
      const cat = cb.dataset.cat as LogCategory;
      if (cb.checked) log.activeCategories.add(cat);
      else log.activeCategories.delete(cat);
      rerender();
    });
  }

  const modelSelect = document.getElementById("debug-model-select") as HTMLSelectElement | null;
  if (modelSelect && actions?.onModelChange) {
    modelSelect.addEventListener("change", () => actions.onModelChange!(modelSelect.value));
  }

  document.getElementById("debug-clear")!.addEventListener("click", () => {
    logEl.innerHTML = "";
  });

  if (!isProd) {
    document.getElementById("debug-test-victory")!.addEventListener("click", () => {
      if (actions?.testVictory) actions.testVictory();
      else log.warn("system", "No testVictory callback registered");
    });

    document.getElementById("debug-reset-player")!.addEventListener("click", () => {
      if (actions?.resetPlayer) actions.resetPlayer();
      else log.warn("system", "No resetPlayer callback registered");
    });
  }

  document.getElementById("debug-heatmap")!.addEventListener("click", () => {
    if (actions?.showHeatmap) actions.showHeatmap();
    else log.warn("system", "No showHeatmap callback registered");
  });

  log.info("system", "Debug console initialized");
  return { modelSelect };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
