/** Tier 1 = base seed, Tier 2 = hardcoded recipe, Tier 3-5 = AI-generated */
export type Tier = 1 | 2 | 3 | 4 | 5;

/** Core element data, independent of UI */
export interface ElementData {
  name: string;
  color: string;
  tier: Tier;
}

/** What the AI returns (tier is assigned by the caller) */
export interface FusionResult {
  name: string;
  color: string;
}

/** Async interface for looking up and storing recipes */
export interface RecipeProvider {
  get(key: string): Promise<ElementData | undefined>;
  set(key: string, value: ElementData): Promise<void>;
}

/** Async interface for loading prompts by tier */
export interface PromptProvider {
  getPrompt(tier: Tier): Promise<string>;
}

/** Build a normalized, order-independent recipe key */
export function recipeKey(a: string, b: string): string {
  return [a, b].sort().join("+");
}
