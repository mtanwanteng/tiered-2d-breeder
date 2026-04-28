import type { Era, ElementData, ActionLogEntry, ModelId, EraHistory } from "./types";
import { log } from "./logger";
import erasData from "./eras.json";

const allEras = (erasData as Era[]).sort((a, b) => a.order - b.order);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class EraManager {
  private currentIndex = 0; // index into allEras
  private advancementCheckedAt = 0;
  readonly history: EraHistory[] = [];
  private resolvedSeeds: Map<number, ElementData[]> = new Map();

  get current(): Era {
    return allEras[this.currentIndex];
  }

  get erasCompleted(): number {
    return this.history.length;
  }

  /** Get the seeds for the current era, resolving from pool if needed */
  getSeeds(): ElementData[] {
    return this.getSeedsForEra(this.currentIndex);
  }

  /** Get the seeds for any era by index, resolving from pool if needed.
   *  Pass reroll=true to bypass the cache and re-shuffle — used by select-five's
   *  Change Era so each visit to the same era produces a fresh random selection,
   *  matching the base-edition behavior where each era is only entered once. */
  getSeedsForEra(idx: number, reroll = false): ElementData[] {
    if (!reroll && this.resolvedSeeds.has(idx)) return this.resolvedSeeds.get(idx)!;
    const era = allEras[idx];
    const seeds = era.seedPool && era.seedCount
      ? shuffle(era.seedPool).slice(0, era.seedCount)
      : era.seeds;
    this.resolvedSeeds.set(idx, seeds);
    return seeds;
  }

  /** Total number of eras available */
  get totalEras(): number {
    return allEras.length;
  }

  /** Get an era by index (for select-five cycling) */
  getEraByIndex(idx: number): Era {
    return allEras[idx];
  }

  /** Set the current era by index (used for select-five mode where era is not advanced through normal flow) */
  setCurrentEraIndex(idx: number): void {
    this.currentIndex = idx;
    this.advancementCheckedAt = 0;
  }

  /** Get the next eligible era. Bibliophile locks to a fixed 11-chapter arc:
   *  every run walks every chapter in `order`. Returns the immediate next-by-order
   *  era, or [] if already at the last era. */
  getEligibleNextEras(): Era[] {
    const next = allEras.find((e) => e.order > this.current.order);
    return next ? [next] : [];
  }

  /** Whether the current era is Space Age (last era) */
  get isLastEra(): boolean {
    return this.currentIndex === allEras.length - 1;
  }

  /** Immediately mark any tier goal met if the given tier qualifies. Returns true if anything changed. */
  markTierGoalIfMet(tier: number): boolean {
    let changed = false;
    for (const goal of this.current.goals) {
      if (goal.minTier !== undefined && !goal.conditions[0].met && tier >= goal.minTier) {
        goal.conditions[0].met = true;
        log.info("era", `Tier goal met: Reached Tier ${goal.minTier}`);
        changed = true;
      }
    }
    return changed;
  }

  /** Check if era should advance. Checks each unmet condition individually. */
  async checkAdvancement(
    actionLog: ActionLogEntry[],
    inventory: string[],
    tier5Count: number,
    model: ModelId,
    anonId?: string,
    runId?: string,
  ): Promise<{ narrative: string } | null> {
    if (actionLog.length <= this.advancementCheckedAt) return null;
    this.advancementCheckedAt = actionLog.length;

    const goals = this.current.goals;
    if (goals.length === 0) return null;

    // Find the AI-checked goal (the one without minTier)
    const aiGoal = goals.find((g) => g.minTier === undefined);
    if (aiGoal) {
      // Fallback: tier-5 count marks all conditions as met
      if (tier5Count >= (aiGoal.fallbackTier5Count ?? Infinity)) {
        for (const c of aiGoal.conditions) c.met = true;
        return {
          narrative: `Through sheer ingenuity, your people have transcended the ${this.current.name}. A new era dawns.`,
        };
      }

      // Batch check all unmet conditions in a single API call
      const unmetConditions = aiGoal.conditions.filter((c) => !c.met);
      if (unmetConditions.length > 0) {
        log.debug("era", `Checking ${unmetConditions.length} unmet conditions in one call`);
        try {
          const res = await fetch("/api/check-era", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              goals: unmetConditions.map((c) => c.description),
              actionLog: actionLog.slice(-20),
              inventory,
              eraName: this.current.name,
              anonId,
              runId,
            }),
          });
          if (res.ok) {
            const data = await res.json() as { results: { goal: string; met: boolean; narrative: string }[] };
            for (const r of data.results) {
              const condition = unmetConditions.find((c) => c.description === r.goal);
              if (condition && r.met) {
                condition.met = true;
                condition.narrative = r.narrative;
                log.info("era", `Condition met: "${condition.description}"`);
              }
            }
          } else {
            log.warn("api", `Era check API error: ${res.status}`);
          }
        } catch (err) {
          const checkDetail = process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" ? `: ${err instanceof Error ? err.message : String(err)}` : "";
          log.error("api", `[ERA-CHK] Era check failed${checkDetail}`);
        }
      }
    }

    // All goals must be satisfied (AND)
    const allMet = goals.every((goal) => {
      const metCount = goal.conditions.filter((c) => c.met).length;
      return metCount >= goal.requiredCount;
    });

    if (!allMet) return null;

    return {
      narrative: `Your civilization has achieved all the milestones of the ${this.current.name}. A new chapter begins.`,
    };
  }

  /** Pick the next era and generate a narrative for the transition.
   *  With Bibliophile's fixed 11-chapter arc, the next era is mechanical
   *  (next-by-order); the AI's role here is narrative only. The signature
   *  preserves the older `choose` shape for callers and analytics that still
   *  refer to the era as "chosen". */
  async chooseNextEra(
    actionLog: ActionLogEntry[],
    inventory: string[],
    model: ModelId,
    _anonId?: string,
    _runId?: string,
  ): Promise<{ era: Era; narrative: string }> {
    const eligible = this.getEligibleNextEras();
    if (eligible.length === 0) {
      throw new Error("chooseNextEra called from the last era");
    }
    const next = eligible[0];

    const narrative = await this.generateAdvancementNarrative(actionLog, inventory, model, next.name);
    log.info("era", `Locked next era: ${next.name}`);
    return {
      era: next,
      narrative: narrative ?? `Your civilization advances to the ${next.name}.`,
    };
  }

  /** Generate a narrative for a fixed next era (used for Space Age victory) */
  async generateAdvancementNarrative(
    actionLog: ActionLogEntry[],
    inventory: string[],
    model: ModelId,
    nextEraName: string,
  ): Promise<string | null> {
    try {
      const res = await fetch("/api/choose-era", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          completedEras: this.history.map((h) => h.eraName),
          currentEra: this.current.name,
          actionLog: actionLog.slice(-20),
          inventory,
          eligibleEras: [{ name: nextEraName, order: 9999 }],
        }),
      });
      if (res.ok) {
        const data = await res.json() as { narrative?: string };
        if (data.narrative) return data.narrative;
      }
    } catch (err) {
      const detail = process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" ? `: ${err instanceof Error ? err.message : String(err)}` : "";
      log.error("api", `[ERA-VIC] Victory narrative failed${detail}`);
    }
    return null;
  }

  /** Record the current era's history */
  recordHistory(
    actions: ActionLogEntry[],
    narrative: string,
    discoveredItems: string[],
    eraStartedAt?: number,
    eraCompletedAt?: number,
    tileSpawnCounts?: Record<string, number>,
    tileSpawnByTier?: Record<number, number>,
  ) {
    this.history.push({
      eraName: this.current.name,
      startingSeeds: this.getSeeds().map((s) => `${s.emoji} ${s.name}`),
      actions: [...actions],
      advancementNarrative: narrative,
      discoveredItems: [...discoveredItems],
      eraStartedAt,
      eraCompletedAt,
      tileSpawnCounts: tileSpawnCounts ? { ...tileSpawnCounts } : undefined,
      tileSpawnByTier: tileSpawnByTier ? { ...tileSpawnByTier } : undefined,
    });
  }

  /** Advance to a specific era by name */
  advanceTo(eraName: string): Era | null {
    const idx = allEras.findIndex((e) => e.name === eraName);
    if (idx === -1) return null;
    this.currentIndex = idx;
    this.advancementCheckedAt = 0;
    return this.current;
  }

  /** Export state for saving */
  exportState(): { currentIndex: number; history: EraHistory[]; resolvedSeeds: Record<number, ElementData[]>; goalStates: Record<number, { met: boolean; narrative?: string }[][]> } {
    const resolvedSeeds: Record<number, ElementData[]> = {};
    for (const [k, v] of this.resolvedSeeds) resolvedSeeds[k] = v;

    const goalStates: Record<number, { met: boolean; narrative?: string }[][]> = {};
    goalStates[this.currentIndex] = this.current.goals.map((goal) =>
      goal.conditions.map((c) => ({ met: c.met, narrative: c.narrative }))
    );

    return { currentIndex: this.currentIndex, history: [...this.history], resolvedSeeds, goalStates };
  }

  /** Import state from save */
  importState(state: { currentIndex: number; history: EraHistory[]; resolvedSeeds: Record<number, ElementData[]>; goalStates: Record<number, { met: boolean; narrative?: string }[][] | { met: boolean; narrative?: string }[]> }) {
    this.currentIndex = state.currentIndex;
    this.history.length = 0;
    this.history.push(...state.history);
    this.resolvedSeeds.clear();
    for (const [k, v] of Object.entries(state.resolvedSeeds)) {
      this.resolvedSeeds.set(Number(k), v);
    }
    // Restore goal condition states — handle old flat format (pre-multi-goal saves)
    for (const [k, rawGoalData] of Object.entries(state.goalStates)) {
      const era = allEras[Number(k)];
      if (!era) continue;
      // Old format: flat array of condition objects → treat as goals[0] only
      const goalsData: { met: boolean; narrative?: string }[][] =
        Array.isArray(rawGoalData[0]) ? rawGoalData as { met: boolean; narrative?: string }[][] : [rawGoalData as { met: boolean; narrative?: string }[]];
      for (let gi = 0; gi < goalsData.length && gi < era.goals.length; gi++) {
        const goal = era.goals[gi];
        const conditions = goalsData[gi];
        for (let i = 0; i < conditions.length && i < goal.conditions.length; i++) {
          goal.conditions[i].met = conditions[i].met;
          goal.conditions[i].narrative = conditions[i].narrative;
        }
      }
    }
    this.advancementCheckedAt = 0;
    log.info("era", `Restored to ${this.current.name} (${this.history.length} eras completed)`);
  }
}
