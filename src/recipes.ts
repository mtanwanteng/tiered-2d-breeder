import type { RecipeProvider, ElementData } from "./types.ts";

const SEED_RECIPES: Record<string, ElementData> = {
  "Air+Fire":    { name: "Smoke",   color: "#708090", tier: 2 },
  "Air+Earth":   { name: "Dust",    color: "#c2b280", tier: 2 },
  "Air+Plant":   { name: "Pollen",  color: "#f4e285", tier: 2 },
  "Air+Stone":   { name: "Gravel",  color: "#8d8680", tier: 2 },
  "Air+Water":   { name: "Mist",    color: "#d3e8ef", tier: 2 },
  "Earth+Fire":  { name: "Lava",    color: "#cf1020", tier: 2 },
  "Earth+Stone": { name: "Boulder", color: "#7a7267", tier: 2 },
  "Earth+Plant": { name: "Forest",  color: "#1b4332", tier: 2 },
  "Earth+Water": { name: "Mud",     color: "#8b6914", tier: 2 },
  "Fire+Plant":  { name: "Ash",     color: "#4a4a4a", tier: 2 },
  "Fire+Stone":  { name: "Metal",   color: "#aaa9ad", tier: 2 },
  "Fire+Water":  { name: "Steam",   color: "#b0c4de", tier: 2 },
  "Plant+Stone": { name: "Moss",    color: "#4a7c59", tier: 2 },
  "Plant+Water": { name: "Algae",   color: "#3a7d44", tier: 2 },
  "Stone+Water": { name: "Sand",    color: "#c2b280", tier: 2 },
};

export class InMemoryRecipeStore implements RecipeProvider {
  private cache: Record<string, ElementData>;

  constructor() {
    this.cache = { ...SEED_RECIPES };
  }

  async get(key: string): Promise<ElementData | undefined> {
    return this.cache[key];
  }

  async set(key: string, value: ElementData): Promise<void> {
    this.cache[key] = value;
  }
}
