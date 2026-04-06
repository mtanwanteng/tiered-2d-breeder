# Analytics Tracking

## Stack

| Layer | Tool | Where |
|-------|------|--------|
| Client events | `posthog-js` | direct import in `src/main.ts`; `usePostHog()` hook in React |
| Server events | `posthog-node` per-request factory | `src/lib/posthog-server.ts` — always `await ph.shutdown()` before returning |
| Scoreboard data | localStorage save (`SaveData` / `EraHistory`) | in-game state, not PostHog |
| Authenticated retention | `lastActiveAt` on `user` table | DB — server-side signal independent of PostHog |

> **Scoreboard display vs analytics**: The in-game scoreboard reads from the localStorage save system, not PostHog. PostHog is for aggregate analysis across all players. Some stats (e.g. era timing) need to be added to **both** the save system (for display) **and** tracked as events (for aggregate analysis).

---

## Scoreboard Display

> Data that feeds the in-game scoreboard UI. All of this must live in `SaveData` / `EraHistory` (localStorage), not PostHog.

### Tile Placement (per era + overall)

| Stat | Data needed | Status |
|------|-------------|--------|
| Tiles placed by tier — e.g. gen1: 20, gen2: 8, gen3: 3, total: 31 | `tileSpawnCounts` on `EraHistory`, grouped by tier | Available |
| Tile combinations discovered by tier — e.g. gen2: 4, gen3: 2, total: 6 | Count of unique results per tier in `eraActionLog` | Available — derivable from `eraActionLog` |
| Number of combinations created | `eraActionLog.length` | Available |
| Highest tier combination made | Max `resultTier` in `eraActionLog` | Available |
| Advanced tiles used (tiles created from inventory, used in combos) | Cross-reference palette items vs `eraActionLog` parents | Partially available |
| Favorite tile (most placed) — e.g. "22× Fire" | Spawn count per palette item | **Missing** — need spawn counts in save |
| Starting tiles / discovered tiles | `startingSeeds` + `discoveredItems` on `EraHistory` | Available |

### Time (per era + overall)

| Stat | Data needed | Status |
|------|-------------|--------|
| Time spent per era | `eraStartedAt` + `eraCompletedAt` on `EraHistory` | Available — note: restored games track from resume point, not original start |
| Total time played | Sum of `(eraCompletedAt - eraStartedAt)` across `EraHistory` | Available |
| Avg time between combinations | Timestamps on `eraActionLog` entries (already have `timestamp`) | Available — `ActionLogEntry.timestamp` exists |
| Avg time per tile placed | `tileSpawnCounts` + `eraStartedAt`/`eraCompletedAt` on `EraHistory` | Available |
| Avg time per new discovery | Timestamps on first-discovery entries in `eraActionLog` | Derivable from `eraActionLog.timestamp` |

### End of Era Snapshot

| Stat | Status |
|------|--------|
| Era name, combinations, items discovered, narrative | Available — in `EraHistory` |
| Advancement conditions met | Available — `eraManager.goalStates` |
| Time to complete era | `eraCompletedAt - eraStartedAt` on `EraHistory` | Available |

---

## Game Design

> Aggregate views for understanding how the game plays, where it's balanced, and where it breaks.

### Tile Placement

| Question | Source events | Status |
|----------|---------------|--------|
| How many tiles do players place per era? | `tile_spawned` count grouped by `era_name` | Available |
| What's the max tiles in play at once? | Peak `tile_spawned` minus combines (complex) | **Missing** — requires per-player state tracking |
| Which palette items do players ignore? | `tile_spawned` by `item` — items with low spawn rate | Available |
| How many combinations per era? | `combination_created` count grouped by `era_name` | Available |
| What's the discovery rate? | `item_discovered` / `combination_created` ratio | Available |
| How often do players repeat known combos? | `is_cache_hit` on `combination_created` | Available |
| What tier are most combinations? | `result_tier` on `combination_created` | Available |

### Timing / Attention

| Question | Source | Status |
|----------|--------|--------|
| How long between combinations? (TikTok threshold ~12s) | Delta between consecutive `combination_created` timestamps | Available — PostHog timestamps |
| How long between tile placements? | Delta between `tile_spawned` timestamps | Available — PostHog timestamps |
| How long does each era take? | `era_advanced` timestamp minus prior `era_advanced` or `game_started` | Available — derivable |
| Total session length | `$pageleave` minus `game_started` / `game_resumed` | Available — PostHog sessions |

### Progression / Balance

| Question | Source | Status |
|----------|--------|--------|
| Where do players quit? | Funnel: `game_started` → `era_advanced (era_number=1)` → ... → `game_completed` | Available |
| How many eras do players complete on average? | `era_number` on `era_advanced` + `game_completed` rate | Available |
| Is an era too hard (low advancement rate)? | Time stuck in era (long gap before `era_advanced`) | Available — derivable |
| Are players exploring or grinding? | `combinations_in_era` on `era_advanced` + cache hit rate | Available |
| How many items does a typical era produce? | `items_discovered_in_era` on `era_advanced` | Available |

### Player Satisfaction (Rating — next branch)

| Question | Source | Status |
|----------|--------|--------|
| How do players rate each era? | `era_rated { era_name, rating, era_number }` | **Missing** — not implemented |
| Correlation between rating and drop-off | `era_rated` vs funnel falloff after that era | **Missing** |
| Game overall rating | `game_rated { rating, total_eras }` at victory | **Missing** |
| Did an era feel too fast / too slow? | `era_rated` with `pace_rating` property | **Missing** |

---

## Market

> Standard business metrics. Most fall out of timestamped session events + PostHog identity.

| Metric | Source | Status |
|--------|--------|--------|
| **New users per period** | `game_started` (first session = new person in PostHog) | Available |
| **DAU / MAU** | Distinct PostHog persons with `game_resumed` or `game_started` per day/month | Available |
| **D1 / D7 / D30 Retention** | Person has `game_resumed` N days after first `game_started` | Available |
| **Rolling retention / Churn** | Gap between `$pageleave` and next `game_resumed` per person | Available |
| **Session count per user** | `game_started` + `game_resumed` per PostHog person | Available |
| **Session depth** | `combinations_so_far` on `game_resumed` — how deep was the save? | Available |
| **Peak concurrent users** (CCU) | Requires server-side session tracking — PostHog can approximate | Not precise |
| **Auth conversion** | `auth_opened` → `auth_completed` funnel | Available |
| **OAuth provider split** | `provider` on `auth_completed` | Available |
| **Victory-driven signup rate** | `auth_from_victory` → `auth_completed` | Available |
| **ARPU / LTV** | Not applicable until monetization | N/A |

> **Note on anonymous continuity**: `bari-anon-id` in localStorage links sessions on the same browser/device. Cross-device anonymous users get new PostHog identities — churn is undercounted. Login solves this for authenticated users.

---

## Cost

> AI API cost tracking. Goal: know cost per user, per combination, and per model.

| Metric | Source | Status |
|--------|--------|--------|
| AI calls per day | `ai_combination_requested` count | Available |
| AI calls per era | `ai_combination_requested` grouped by `era_name` | Available |
| Error rate | `ai_combination_error` / `ai_combination_requested` | Available |
| Model usage split | `model` on `ai_combination_requested` | Available |
| **Cost per combination** | Needs token counts from Vertex AI response | **Missing** — token counts not captured |
| **Cost per user per day** | Token cost × `ai_combination_requested` per user per day | **Missing** — depends on token tracking |
| Cache hit savings | `is_cache_hit` rate on `combination_created` × avoided API calls | Available — indirect |

> **Token tracking**: Vertex AI returns token usage in the API response. Add `input_tokens` and `output_tokens` as properties on `ai_combination_requested` to enable per-model cost attribution. The multiplier per 1K tokens varies by model and is available in Vertex pricing docs.

---

## Event Catalog

### Client — `src/main.ts`

| Event | Properties |
|-------|------------|
| `game_started` | `era_name` |
| `game_resumed` | `era_name`, `combinations_so_far`, `items_discovered` |
| `game_restarted` | `current_era`, `combinations_so_far` |
| `game_completed` | `total_eras`, `total_combinations`, `total_items_discovered` |
| `combination_created` | `item_a`, `item_b`, `result`, `result_tier`, `is_cache_hit`, `model`, `era_name` |
| `item_discovered` | `item`, `tier`, `era_name` |
| `era_advanced` | `from_era`, `to_era`, `era_number`, `combinations_in_era`, `items_discovered_in_era` |
| `model_changed` | `model` |
| `scoreboard_opened` | — |
| `tile_spawned` | `item`, `tier`, `era_name` |

### Client — auth components

| Event | Properties |
|-------|------------|
| `auth_opened` | — |
| `auth_completed` | `provider` |
| `auth_from_victory` | — |
| `auth_logout` | — |

### Server — `posthog-node`

| Event | Distinct ID | Properties |
|-------|-------------|------------|
| `ai_combination_requested` | `'anonymous'` | `model`, `tier`, `era_name` |
| `ai_combination_error` | `'anonymous'` | `model`, `error_type` |
| `session_started` | real user ID | — |

### Built-in PostHog

| Event | Notes |
|-------|-------|
| `$pageleave` | Fires on tab close/navigate — primary exit signal |
| `$pageview` | Disabled (`capture_pageview: false`) |

---

## Limitations

- **`$pageleave` ≠ quit**: fires on tab switch too. Filter by session gap length to distinguish brief pauses from churn.
- **Server events are anonymous**: `ai_combination_requested` uses `'anonymous'` as distinct ID — no per-user cost attribution without session context in the API route.
- **Cross-device anonymous users**: `bari-anon-id` is localStorage-bound. Different device = new identity. Retention is undercounted for anonymous players.
- **Scoreboard timing gaps**: era start/end timestamps are not yet in `EraHistory` — time-per-era display and game design timing analysis both depend on adding these.

---

## TODO — Mechanics to instrument

> When adding a new game mechanic, check if it creates player behavior worth measuring. If so, add an entry here with the proposed event name, where it fires, and what insight it enables.

### Near-term

- **Scoreboard tile display** — `tileSpawnCounts` and era timestamps are now in `EraHistory`; the scoreboard UI rendering of these stats still needs to be built.
- **Era timestamps** — add `eraStartedAt` / `eraCompletedAt` to `EraHistory` in the save system. Feeds: scoreboard time display, game design pace analysis.
- **`era_rated`** — player rates an era at transition; properties: `{ era_name, era_number, rating, pace }`. Feeds: game design satisfaction + balance.
- **`game_rated`** — player rates the full game at victory; properties: `{ rating, total_eras, total_time_ms }`.
- **Token tracking** — add `input_tokens`, `output_tokens` to `ai_combination_requested`. Feeds: cost per combination, cost per user.

### Future

- **Save sync to DB** (next branch): `save_synced` event — confirms cloud save succeeded; failure rate metric.
- **Combination graph interactions**: if graph becomes interactive, track zoom/click — engagement signal.
- **Monetization** (when applicable): purchase events → ARPU, DARPU, LTV.
- **Social / sharing**: if share button is used beyond current screenshot feature, track `game_shared { method }`.
