import type { ElementData, ActionLogEntry, EraHistory, ModelId } from "./types";
import { log } from "./logger";

const SAVE_KEY = "bari-save";

export interface SaveData {
  version: 1;
  runId?: string; // absent on saves predating this field — treated as a new run
  latestTapestryPath?: string | null;
  selectedModel: ModelId;
  actionLog: ActionLogEntry[];
  eraActionLog: ActionLogEntry[];
  recipeCache: Record<string, ElementData>;
  eraCurrentIndex: number;
  eraHistory: EraHistory[];
  eraResolvedSeeds: Record<number, ElementData[]>;
  eraGoalStates: Record<number, { met: boolean; narrative?: string }[]>;
  paletteItems: ElementData[];
}

export function saveGame(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    log.debug("system", "Game saved");
  } catch (err) {
    log.error("system", `Save failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function loadGame(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data.version !== 1) return null;
    log.info("system", "Save data loaded");
    return data;
  } catch {
    log.warn("system", "Failed to load save data");
    return null;
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
  log.info("system", "Save data cleared");
}
