import type { RecipeProvider, ElementData } from "./types.ts";

export class InMemoryRecipeStore implements RecipeProvider {
  private cache: Record<string, ElementData> = {};

  async get(key: string): Promise<ElementData | undefined> {
    return this.cache[key];
  }

  async set(key: string, value: ElementData): Promise<void> {
    this.cache[key] = value;
  }

  exportCache(): Record<string, ElementData> {
    return { ...this.cache };
  }

  importCache(data: Record<string, ElementData>): void {
    this.cache = { ...data };
  }
}
