/** Tier 1 = base seed, Tier 2 = hardcoded recipe, Tier 3-5 = AI-generated */
export type Tier = 1 | 2 | 3 | 4 | 5;

/** Core element data, independent of UI */
export interface ElementData {
  name: string;
  color: string;
  tier: Tier;
  emoji: string;
  description: string;
  narrative: string;
}

/** What the AI returns (tier is assigned by the caller) */
export interface CombineResult {
  name: string;
  color: string;
  emoji: string;
  description: string;
  narrative: string;
}

/** Async interface for looking up and storing recipes */
export interface RecipeProvider {
  get(key: string): Promise<ElementData | undefined>;
  set(key: string, value: ElementData): Promise<void>;
}

/** Async interface for loading prompts by tier and era */
export interface PromptProvider {
  getPrompt(tier: Tier, eraName: string): Promise<string>;
}

/** Available AI models */
export type ModelId = "gemini-2.5-flash" | "gemini-3.1" | "claude-haiku-4.5";

export interface ModelOption {
  id: ModelId;
  label: string;
}

export const MODELS: ModelOption[] = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gemini-3.1", label: "Gemini 3.1" },
  { id: "claude-haiku-4.5", label: "Claude Haiku 4.5" },
];

/** Build a normalized, order-independent recipe key */
export function recipeKey(a: string, b: string): string {
  return [a, b].sort().join("+");
}

/** Action log entry for era advancement tracking */
export interface ActionLogEntry {
  timestamp: number;
  parentA: string;
  parentB: string;
  result: string;
  resultTier: Tier;
}

/** A single condition within a goal */
export interface EraCondition {
  description: string;
  met: boolean;
  narrative?: string;
}

/** A goal with a pool of conditions — requiredCount must be met to advance */
export interface EraGoal {
  conditions: EraCondition[];
  requiredCount: number;
  fallbackTier5Count?: number; // only used for AI-checked goals
  minTier?: number; // if set, goal is checked deterministically: any item of this tier or higher
}

/** An era of civilization with its starting items and goals */
export interface Era {
  name: string;
  seeds: ElementData[];
  seedPool?: ElementData[];
  seedCount?: number;
  goals: EraGoal[];
  required?: boolean;
  order: number;
}

/** Record of what the player did in a completed era */
export interface EraHistory {
  eraName: string;
  startingSeeds: string[];
  actions: ActionLogEntry[];
  advancementNarrative: string;
  discoveredItems: string[];
  eraStartedAt?: number;       // ms timestamp — absent on saves predating this field
  eraCompletedAt?: number;     // ms timestamp
  tileSpawnCounts?: Record<string, number>; // item name → times spawned from palette
  tileSpawnByTier?: Record<number, number>; // tier → total spawn count
}

export interface TapestryGameData {
  selectedModel: ModelId;
  totalCombinations: number;
  eraCurrentIndex: number;
  eraHistory: EraHistory[];
  eraActionLog: ActionLogEntry[];
  discoveredItems: string[];
  eraStartedAt: number;
  eraCompletedAt: number;
}
