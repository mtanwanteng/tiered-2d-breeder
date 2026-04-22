import type { ElementData, ActionLogEntry, EraHistory, ModelId, Tier } from "./types";
import { log } from "./logger";

export const SAVE_KEY = "bari-save";
export const SELECT_FIVE_SAVE_KEY = "bari-select-five-save";

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
  eraGoalStates: Record<number, { met: boolean; narrative?: string }[][] | { met: boolean; narrative?: string }[]>;
  paletteItems: ElementData[];
  // select-five mode only (absent in normal saves)
  selectedSlots?: ({ name: string; tier: Tier } | null)[];
  selectFiveEraIndex?: number;
}

export function saveGame(data: SaveData, key: string = SAVE_KEY): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    log.debug("system", "Game saved");
  } catch (err) {
    log.error("system", `Save failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function loadGame(key: string = SAVE_KEY): SaveData | null {
  try {
    const raw = localStorage.getItem(key);
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

export function clearSave(key: string = SAVE_KEY): void {
  localStorage.removeItem(key);
  log.info("system", "Save data cleared");
}
