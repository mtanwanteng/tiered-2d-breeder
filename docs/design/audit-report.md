# Audit Report: Existing Code vs. Theming Architecture

> **Scope:** compares the current `bibliophile-2026-04-27` branch tip
> against `theming-architecture.md`, `bibliophile-spec.md`,
> `curator-spec.md`, `cartographer-spec.md`. **No code changes** — this
> document is a fact-finding pass, not a fix.
>
> **Method:** read-only sweep of `src/`, `app/`, `public/themes/`,
> `docs/design/`. File:line references are anchors, not commands.
>
> **TL;DR:** The bibliophile surfaces are mostly built. The theming
> *abstraction* is partly scaffolded (a `Theme` type, a manifest, a
> `setTheme()` function) but the *theming discipline* the architecture
> spec requires is not held: hex colors, audio choices, copy strings,
> texture paths, motion variants, and font references all leak out of
> the manifest and live as literals in code, CSS, and the database.
> Live theme-switching would not work today — even if Curator and
> Cartographer manifests existed, calling `setTheme(curator)` would
> not visibly change the game.

---

## Table of contents

1. [Surfaces — bibliophile-spec §3 implementation status](#1-surfaces)
2. [Hardcoded values that the architecture says should be tokenized](#2-hardcoded-values)
3. [Tile / era / run data — storage-rule compliance](#3-storage-rule-compliance)
4. [Spec ↔ code conflicts](#4-spec-vs-code-conflicts)
5. [Summary table — by token category](#5-summary-by-token-category)

---

## 1. Surfaces

Status legend: ✅ implemented · 🟡 partial · ⛔ missing.

| Surface | Status | Where it lives | Notes |
|---|---|---|---|
| 3.1 Onboarding (90s arc) | 🟡 | `app/components/OnboardingOverlay.tsx` | Five-frame state machine exists (`hidden / front / guide / merging / reveal / done`). Frames are **event-driven**, not time-paced — the spec's 0–8s / 8–18s / 18–28s / 28–40s / 40–60s bands aren't enforced; the player advances at their own speed. The "5-second cold open for returning players" (spec §3.1 last line) is not implemented — returning players land directly in the play screen with no fade-in. |
| 3.2 Play screen | ✅ | `src/main.ts` (mount + DOM template, ~ll. 300–600), `src/theme/bibliophile/skin.css` | Chapter title bar, objectives card, workspace caption, idea tray, strip, Bari emoji, settings cog, Menu button, Catalog button — all present. |
| 3.3 Bind ceremony | ✅ | `src/main.ts:beginBindHold` (~l. 4015), `src/motion/hold-arc.ts`, `src/motion/brass-clasp.ts` | 2.5s hold-arc, brass-clasp on commit, bind-slot drop UX. The clasp's *axis* deviates from the architecture spec — see §4 below. |
| 3.4 Era summary | ✅ | `src/main.ts:showEraSummary` (~l. 3540), `src/motion/brush-wipe.ts`, `src/motion/scratch-in.ts` | Frontispiece embed + brush-wipe + scratch-in narrative. Tapestry click→fullscreen via existing `#tapestry-overlay` is wired. Both narratives (next-era + completed-era) typewriter in. |
| 3.5 Library | ✅ | `app/library/page.tsx`, `app/components/Bookplate.tsx`, `app/api/library/route.ts`, `src/db/era-idea-tiles.ts` | 24-slot grid; bookplate pull-up sheet; share button. Counter shifts to gilt at 24/24. |
| 3.6 Retirement ceremony | ✅ | `src/main.ts:openRetirementOverlay` + retirement overlay markup | Hold-to-commit on existing tile, ink-point dispersal, new tile descends, Bari one-shot speech at first wall-full. |
| 3.7 Vault | ✅ | `app/vault/page.tsx`, `src/db/era-idea-tiles.ts:getVaultForOwner` | Spine-only entries (chapter color + Roman numeral); tap → "Given to the world · Run [N] · Chapter [roman]". The DB row carries the full tile data but the API never returns it (per spec §3.7). |
| 3.8 Run end | ✅ | `src/main.ts:victory path` (~l. 3380), `src/motion/wax-stamp.ts`, victory-overlay markup | Wax-seal stamp + cathedral bell (procedural) + Age of Plenty overlay + "Open the library →". |

### Surface-level gaps that are *not* missing implementations but missing-from-spec content

- **Bari pose: approval nod.** Spec §5 declares four poses (idle, approval nod, wonder, patient). Code applies CSS classes for *active*, *leaning*, *patient*, *very-patient* — driven by AI-thinking phase thresholds — but **no pose fires on a successful bind, kept-tile combine, or era end**. The `nod.png` art slot in the manifest (`src/theme/bibliophile/manifest.ts:46`) is referenced but no asset exists, and no JS triggers a "nod" class.
- **Painted Bari art.** `public/themes/bibliophile/bari/` is an empty directory; the four PNG paths in the manifest are dead. Bari renders as the emoji placeholder `<span id="bari-char">👦</span><span id="bari-tool">🔨</span>` in `main.ts:463`.
- **Ornament assets.** `public/themes/bibliophile/ornaments/` is also empty; the five corner/divider URLs in the manifest are dead. No code currently references them anyway, so this is theoretical scope, not active breakage.
- **Title-screen scene** (`titleScene: "/themes/bibliophile/title-library.webp"`). Asset doesn't exist; no code references it.
- **Audio cues.** `public/themes/bibliophile/audio/` is empty. The audio bus (`src/audio/index.ts`) is **fully procedural** — Web Audio synth — and ignores the manifest's `audio:` paths entirely. (See §2 below.)

---

## 2. Hardcoded values

The architecture spec says: themes own colors, fonts, textures, motion variants, and audio textures. Concretely, here is what currently leaks out of the manifest.

### 2.1 Color hex values

**Tokenized correctly:**

- `src/theme/bibliophile/tokens.css` defines 8 spec tokens under `[data-theme="bibliophile"]` and 9 convenience aliases. ✅
- `src/theme/bibliophile/skin.css` overwhelmingly references `var(--ink-black)`, `var(--gilt)`, etc. ✅

**Hardcoded violations:**

| File | Line(s) | Value | Issue |
|---|---|---|---|
| `src/style.css` | numerous (177 hex literals total — count via grep) | `#1a2a1a`, `#0f1a2e`, `#5bc4e5`, `#daa520`, `#a855f7`, `#5865F2`, `#90caf9`, etc. | Legacy stylesheet from the pre-rebrand design. Most rules are overridden by `skin.css`, but the literals still ship. Future-theme browsers parse and discard them; not a runtime bug, but a maintenance hazard. |
| `src/theme/bibliophile/skin.css` | l. 470, 507 | `var(--vellum, #f4e8d3)` | Defensive fallback — and the fallback hex `#f4e8d3` **doesn't match the spec's vellum `#f4ead5`**. Drift bug. |
| `src/theme/bibliophile/skin.css` | l. 898 | `linear-gradient(... var(--leather-deep) 0%, #3f311c 100%)` | Hardcoded gradient endpoint — should resolve via tokens. |
| `src/theme/bibliophile/skin.css` | l. 2361 | `radial-gradient(... #a04832 0%, #7a3e2a 45%, #5a2e1f 100%)` | Wax-seal gradient. The middle stop `#7a3e2a` matches `--oxblood` but the outer stops are bespoke. Curator's brushed-brass plaque can't substitute via tokens. |
| `src/main.ts` | l. 141 | `pick ? chapterStripeColor(...) : "#5a4528"` | Fallback hex (leather-deep) when no idea tile picked. Should be `var(--leather-deep)` or `getTheme().tokens.leatherDeep`. |
| `src/main.ts` | l. 327, 2212, 2366, 2645, 2673 | `"#777"` | Default tile color on lookup failure. Theme-blind grey. |
| `src/main.ts` | l. 903 | `ctx.fillStyle = "#8090b0"` | Heatmap canvas — debug-only but still a non-tokenized literal. |
| `src/main.ts` | l. 2186, 3076 | `color: "#daa520"` | Hardcoded gilt-ish for the "?" fallback tile and the pre-cached Torch. The Torch entry has `emoji: "🪔"` and the spec's narrative — but its color is a literal. |
| `src/main.ts` | l. 2480 | `backgroundColor: "#0d1b2e"` | Legacy navy as the share-card export background. Pure pre-rebrand artifact. |
| `src/theme/chapterColor.ts` | l. 26 | `if (palette.length === 0) return "#5a4528"` | Leather-deep fallback when a theme has no `bindingStripePalette`. Reasonable safety net but still a literal. |
| `src/combination-graph.ts` | l. 2, 83, 109, 129, 144 | `TIER_COLORS = ["", "#a8d8ea", "#6bc5a0", "#f4e285", "#fca", "#ff6b6b"]`, `#0a0a1a`, `#888`, `#eee`, `#fff` | Debug heatmap palette. Bright primary colors that would clash with any of the three themes. Self-contained debug surface; low priority. |
| `src/debug-console.ts` | l. 5–16 | Eight `#xxx` literals for log-level + category coloring | Debug-only. Not user-facing. |

### 2.2 Audio cue references

**Manifest declares** (`src/theme/bibliophile/manifest.ts:69–81`) eleven `.flac` paths. **The code uses zero of them.**

`src/audio/index.ts` is a procedural Web Audio bus. `audio.playCombineKnock()`, `audio.playSingingBowl()`, `audio.playClaspSnap()`, etc. are all hand-tuned synthesis — no file lookup, no manifest read. The bus is even **kill-switched by default** (`disabled = true`, l. 25) because the synth patches sounded irritating in playtest.

Implications for theming:

- Switching from Bibliophile to Curator would change zero sounds. The audio layer is literally identical across (hypothetical) themes.
- The eight per-theme audio cues the architecture spec calls for (combine resolve, combine impossible, era goal met, clasp snap, page turn, tapestry painting, run-sealed, room tone) cannot vary today — they're all in the same procedural code path.
- The `public/themes/bibliophile/audio/` folder is empty. Even if we wanted to swap to sample playback, there are no samples.

### 2.3 Font references

**Tokenized correctly:**

- `tokens.css` declares `--font-serif: "Cardo", ...` and `--font-sans: "Inter", ...` ✅
- `skin.css` uses `font-family: var(--font-serif|sans)` consistently ✅ (67 occurrences, no literal font names)

**Hardcoded violations:**

- `app/layout.tsx:38` loads exactly two font families:

   ```html
   <link href="...family=Cardo:ital,wght@0,400;0,700;1,400;1,700&family=Inter:wght@400;500;600&display=swap">
   ```

   Curator (GT Sectra + Söhne) and Cartographer (EB Garamond + IBM Plex Mono) **cannot load their typefaces** without editing this file. The font-load step is not theme-driven. Switching themes at runtime would either render in the wrong typeface (browser fallback) or 404 for missing fonts.

- `src/style.css:9` sets `body { font-family: system-ui, -apple-system, sans-serif }` directly — overridden by skin.css for `[data-theme="bibliophile"]` body, but the legacy default doesn't use the token.

### 2.4 Texture asset references

**The manifest declares** three pattern paths (marble, leather, parchment). The patterns folder has all three SVGs on disk.

**The CSS hard-codes the URL prefix:** every `url(/themes/bibliophile/patterns/...)` reference in `skin.css` (22 occurrences) embeds the literal string `bibliophile`. Switching to a Curator theme would require either:

- editing every `url(...)` reference in skin.css to use a CSS variable (e.g. `url(var(--pattern-parchment))`), or
- writing a parallel `themes/curator/skin.css` that duplicates layout.

Neither is wired today. The `Theme.patterns` struct in `manifest.ts` is read by **no code**; it exists only as a declaration.

### 2.5 Motion timing constants

**Tokenized correctly:**

- All motion primitives in `src/motion/*.ts` accept a `durationMs?` option with a spec-aligned default. The defaults match `bibliophile-spec.md §6` (ink-bloom 600ms, brush-wipe 1400ms, hold-arc 2500ms, page-turn 700ms, brass-clasp 220ms, wax-stamp 320ms, ink-point-dispersal 1400ms, plate-breathing 3000ms). ✅
- Timings are passed inline at call sites in `main.ts`, not stored anywhere. ✅

**Tokenization gap, not a hardcode bug:**

- The architecture spec exposes only motion *type* tokens (`page-transition-type: "peel-2d" | "pan-horizontal" | "fold-3d"`, etc.) — variants, not durations. Today there is **only one variant of each primitive**:

  - `page-turn.ts` does the 2D peel from the right edge — no `pan-horizontal` or `fold-3d` branch.
  - `brass-clasp.ts` does the brass-clasp animation — no `vertical-pin` branch.
  - No `frontispiece-reveal-type` switch — `brush-wipe.ts` is the only flavor.
  - `ink-bloom.ts` exists as a primitive but has only one variant (`fill-expand`), and even that primitive isn't actually called for tile arrivals — see §4.

  Adding Curator or Cartographer would need new motion variants in each module *plus* a switch on `getTheme().motion.bindClaspType` (etc.) at every call site. The dispatch infrastructure doesn't exist.

- `--page-transition-duration` (architecture token, default 700, override 800 for Cartographer) is also not exposed — the duration is currently a hardcoded primitive default, not a theme override.

---

## 3. Storage-rule compliance

The architecture spec is unambiguous (§5):

> **Rule 1.** No hex values in tile or era data.
> **Rule 2.** No motion timings in tile or era data.
> **Rule 3.** No audio cue references in tile or era data.
>
> Violating any one breaks live re-skinning.

### 3.1 Rule 1 — hex values in tile/era data: **VIOLATED, multiple sites**

#### `ElementData` in `src/types.ts:5-12`

```ts
export interface ElementData {
  name: string;
  color: string;        // ← hex value lives on the tile
  tier: Tier;
  emoji: string;
  description: string;
  narrative: string;
}
```

`color` is required, and every tile in the system carries one. The architecture spec says exactly this should not be stored.

#### `eras.json` (136 hex values)

Every seed and seedPool entry carries a hardcoded `"color"` field — `Fire #e94560`, `Stone #6c757d`, `Water #0f86a1`, etc. Static design-time data, but it propagates: when the player drags Fire from the tray, the spawned `CombineItem` uses `data.color`; when Fire is bound, that color becomes part of `EraIdeaTilePick.color` and then `era_idea_tile.tileColor` in the DB.

#### AI prompt template (`src/prompts.json:3-6`)

Every tier prompt asks the model for `color: a hex color that visually represents it`. The combine result `color` field is non-optional in `CombineResult`. The AI generates a hex per combine; `recipeStore.set(...)` caches it; the cached entry is replayed forever after. There is no theme-aware re-coloring path.

#### `EraIdeaTilePick` and `era_idea_tile` table

`src/types.ts:89-97`:

```ts
export interface EraIdeaTilePick {
  name: string;
  tier: Tier;
  emoji: string;
  color: string;        // ← hex
  description?: string;
  narrative?: string;
  pickedAt: number;
}
```

`src/db/schema.ts:150-178`:

```ts
export const eraIdeaTile = pgTable("era_idea_tile", {
  ...
  tileColor: text("tile_color").notNull(),               // ← hex on every bound tile
  bindingStripeColor: text("binding_stripe_color"),      // ← *resolved* stripe color, not the seed
  ...
});
```

Two strikes per row:

1. `tile_color` — the AI-generated tile color, persisted forever.
2. `binding_stripe_color` — per the comment in the schema file: *"cached deterministic chromatic stripe color (hashed from era_id × tile_id × run_id at write-time)"*. The architecture spec (§4) explicitly says the **seed** should be stored, the *color* should be resolved at render time. The current schema stores the resolved color, freezing every existing library row to its bind-time theme.

#### `SaveData` in `src/save.ts:7-24`

The localStorage save shape persists hex values in three places:

- `recipeCache: Record<string, ElementData>` — every cached combine result, with its hex
- `paletteItems: ElementData[]` — current inventory tiles, with hex
- `eraResolvedSeeds: Record<number, ElementData[]>` — resolved seeds per era, with hex
- `selectedSlots?: ({ name; tier; emoji?; color? } | null)[]` — select-five mode slots, with hex

All four would carry stale colors across a theme switch.

#### `Library` and `Vault` API responses

`src/db/era-idea-tiles.ts:LibraryRow`, `VaultRow` — both return `bindingStripeColor` directly to the client. `app/library/page.tsx:84` reads it inline:

```ts
const stripe = tile.bindingStripeColor ?? "var(--leather-deep, #5a4528)";
```

No render-time recomputation; the page paints whatever the DB stored.

### 3.2 Rule 2 — motion timings in tile/era data: **OK**

Spot-checked `era_idea_tile`, `tapestry`, `bari_generated_map`, `SaveData`, `EraHistory`, `EraIdeaTilePick`. No animation duration / easing / timing fields. ✅

### 3.3 Rule 3 — audio cue references in tile/era data: **OK**

No tile, era, or run record stores an audio cue identifier. ✅ (The audio bus is procedural and theme-agnostic anyway, so there's nothing meaningful to cache, but the *schema* doesn't violate the rule.)

### 3.4 Net storage-rule status

| Rule | Status | Severity |
|---|---|---|
| 1 — no hex | VIOLATED at 5 layers (types, eras.json, AI prompt, DB schema, save) | High — blocks live re-skinning of every existing tile |
| 2 — no motion timings | OK | — |
| 3 — no audio cues | OK | — |

If a player switches from Bibliophile to Curator today, every tile in their library, vault, save file, and inventory would render with **its bind-time hex color**, not the new theme's. Curator's near-black mat-board palette could not substitute for Bibliophile's chromatic leather palette without per-tile re-resolution.

---

## 4. Spec ↔ code conflicts

### 4.1 Brass clasp axis (Bibliophile vs. Curator)

`src/motion/brass-clasp.ts:54-61`:

```ts
const aTop = top.animate(
  [{ transform: "translateY(-20px)" }, { transform: "translateY(20px)" }],
  ...
);
const aBottom = bottom.animate(
  [{ transform: "translateY(20px)" }, { transform: "translateY(-20px)" }],
  ...
);
```

The two clasp rects move **vertically** — one descends from above, one rises from below. The architecture spec (§3.4 motion tokens) lists Bibliophile's `bind-clasp-type` as **`"horizontal-clasp"`** and Curator's as `"vertical-pin"` (descending pins). The implementation matches Curator's described variant, not Bibliophile's.

The bibliophile-spec.md §6 entry for "Brass clasp" says only *"Two rects slide ±20px"* without naming an axis, so the bibliophile spec by itself isn't violated. The architecture spec's *disambiguation* between Bibliophile and Curator is.

Either:
- The architecture spec needs to be relaxed (Bibliophile has always been vertical) — a doc fix, or
- The clasp module needs to grow a `direction: "horizontal" | "vertical"` option and Bibliophile's call site needs to pick horizontal — a code fix.

Worth confirming with the spec authors before either side changes.

### 4.2 Ink-bloom not used for tile arrivals

`bibliophile-spec.md §6` lists ink-bloom (`scale 0 → 1, 600ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0 → 1 first 350ms`) as the primary motion for "tile arrivals, narrative text, first appearances."

`src/motion/ink-bloom.ts` exists and matches the spec exactly. **It is imported by no module** (`grep -rn "playInkBloom\|inkBloom"` returns no call sites in `src/main.ts`).

Tile arrivals after a combine instead use `src/style.css:438-446`:

```css
.combine-item.merging {
  animation: pulse 0.4s ease-in-out;
}
@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
```

A 400ms scale-1 → 1.2 → 1 pulse — wrong duration (400 ≠ 600), wrong easing (ease-in-out, not the cubic-bezier), no opacity ramp, no scale-from-zero. The motion is functional but doesn't match the spec.

### 4.3 Onboarding pacing

`bibliophile-spec.md §3.1` defines six time bands totalling 60–90s with explicit second-by-second triggers (gilt arc loops every 4s, narrative scratches in at 40s, etc.). The implementation in `OnboardingOverlay.tsx` is purely **event-driven** — front cover stays until tap, guide stays until combine starts, reveal advances on combine end. The spec-mandated arcs and pacing aren't held; the player can spend 4 seconds or 4 minutes in each frame.

This is a deliberate divergence (the player can self-pace), not a bug, but it's worth flagging because the spec's narrative arc depends on the timing.

### 4.4 No 5-second cold open

`bibliophile-spec.md §3.1` opening line: *"Plays on the player's first-ever run. Subsequent runs use a 5-second cold open instead."* No cold-open code exists. Returning players go directly to the play screen.

### 4.5 Bari has no "approval nod" pose

Spec §5 requires four poses: idle, approval nod, wonder, patient. The CSS (`skin.css:1238-1252`) defines `bari--leaning`, `bari--patient`, `bari--very-patient`. There is no `bari--nod` rule, and no JS dispatches a nod on:

- Strong combine (5★)
- Kept tile bound
- Era end

Per spec §5 the nod is a load-bearing celebratory beat with a 240ms hold, capped at "twice per chapter." It's currently silent.

### 4.6 Bari's one-shot speech runs in unconditional copy

The architecture spec (§7 in curator-spec, §6 in cartographer-spec) calls for a **theme-specific** one-line speech at first wall-full retirement:

- Bibliophile: *"a shelf is what we choose to keep here. press one to send it onward."*
- Curator: *"a collection is what we have chosen to keep. press a piece to send it onward."*
- Cartographer: *"an atlas is what we have charted. press a pin to return its place to the world."*

The bibliophile manifest carries the right string at `bibliophile/manifest.ts:95-96` under `copy.bariFirstWallFull`. **No code reads it.** Grepping for "bariFirstWallFull" outside the manifest returns zero hits in `src/` and `app/`. The string is presumably hardcoded somewhere (or simply absent — I didn't find a "shelf is what we choose to keep" string anywhere in the retirement code path either; this might be deferred copy, not yet written).

### 4.7 Manifest-declared copy is not consumed

Beyond `bariFirstWallFull`, six manifest copy fields are declared but unread:

- `copy.workspaceCaption` — manifest says `"— the writing desk —"`; main.ts hardcodes the same string at l. 488 and l. 2710.
- `copy.writingDeskHint` — manifest says `"Place two ideas here to combine."`; main.ts hardcodes it at l. 489.
- `copy.inventoryCaption` — manifest says `"Your Ideas"`; main.ts hardcodes it at l. 450.
- `copy.cardCatalogButton` — manifest says `"Card Catalog →"`; main.ts hardcodes `"Catalog →"` at l. 451 (and the two strings have **drifted** — manifest is stale).
- `copy.onboarding.title` / `tagline` / `tryPrompt` / `torchNarrative` / `tapToBegin` — all duplicated as hardcoded literals in `OnboardingOverlay.tsx`.

The aiThinking phase machine (`src/ai-thinking-state.ts:79`) does read `getTheme().copy.aiThinking` correctly. Everything else is duplicate state.

### 4.8 Layout root is hardcoded to one theme

`app/layout.tsx:32` has `<html lang="en" data-theme="bibliophile">` — the data-theme attribute that drives every CSS variable scope is a string literal, not a value derived from the user setting. Even if `setTheme(curator)` ran, the browser-level `data-theme` would only update via `setTheme()`'s side effect (`document.documentElement.dataset.theme = theme.name`) — but on the **next** SSR / page navigation, layout.tsx would clobber it back to bibliophile. Server-rendered first paint would always be bibliophile.

### 4.9 No theme switcher / no persisted theme preference

- `setTheme()` is exported from `src/theme/index.ts` but called by **no code**.
- The Settings drawer (4 toggles: reduced motion, tap-to-commit, high contrast, room tone) has no "Appearance" section.
- The `user` table in the DB schema has no `theme` column. `src/settings.ts` and `app/api/settings/route.ts` carry only the four accessibility flags — no theme preference.
- `localStorage` carries no `theme` key.

The architecture spec §5 says: *"user.preferences.theme = 'bibliophile' | 'curator' | 'cartographer'. Default: 'bibliophile'. New users land here."* This datum has no home.

### 4.10 `binding_stripe_color` cached at write-time

`src/db/schema.ts` comment at l. 147–149 documents the deliberate decision:

> `binding_stripe_color — cached deterministic chromatic stripe color (hashed from era_id × tile_id × run_id at write-time) so library rendering doesn't recompute the hash.`

The architecture spec §4 says exactly the opposite: *"What gets stored: chapter_color_seed: hash(era_id, tile_id, run_id). … Visual treatment is computed at render time from (active_theme, tile_data)."*

The seed (or the inputs to the hash) should be stored; the resolved hex should not. This is a real schema decision that was made before the architecture spec was written — and it now blocks live re-skinning of bound tiles.

---

## 5. Summary by token category

| Category | Manifest declares | Code reads it | Live theme-switching today would update? |
|---|---|---|---|
| **3.1 Color tokens** | ✅ (8 spec colors as `tokens` + 9 aliases via `tokens.css`) | ✅ for skin.css, ❌ for `main.ts` (~10 fallback literals), ❌ for `style.css` (177 legacy literals), ❌ for stored tile colors (DB + save) | **Partial** — UI chrome would re-skin, but tile colors and bound stripes would stay frozen at bind-time |
| **3.2 Typography tokens** | ✅ (`fonts.serif`, `fonts.sans`) | ✅ for skin.css, ❌ for `app/layout.tsx` (Google Fonts URL is a literal hardcoded to Cardo+Inter only) | **No** — Curator's GT Sectra+Söhne and Cartographer's Garamond+Plex Mono can't load |
| **3.3 Texture tokens** | ✅ (`patterns.{marble,leather,parchment}`) | ❌ — `skin.css` hardcodes `/themes/bibliophile/patterns/...` paths in 22 places; `Theme.patterns` is consumed by zero modules | **No** — switching would 404 every pattern URL |
| **3.4 Motion tokens** | 🟡 — `Theme` interface has no motion fields at all | N/A | **No** — only one variant of each primitive exists; no dispatch on theme |
| **3.5 Chapter-color seed bank** | ✅ (`bindingStripePalette`) | ✅ — `chapterColor.ts` reads it via `getTheme()` | **Partial** — new bound tiles would use the new palette, but existing bound tiles in DB carry resolved hex already |
| **3.6 Audio textures** | ✅ (11 cue paths in `audio.*`) | ❌ — audio bus is procedural Web Audio synth; ignores the manifest entirely | **No** — all themes sound identical (or silent, since the synth is kill-switched) |

---

## What's not a problem

For balance — these areas are clean:

- **Hold-to-commit duration** is 2.5s in code (`main.ts:4017,4195`) and matches spec exactly.
- **Brush-wipe** is 1400ms (`brush-wipe.ts:11`) — matches spec.
- **Page-turn** is 700ms (`page-turn.ts:10`) — matches spec.
- **Plate-breathing** is 3000ms iteration on a sine — matches spec §6.
- **Wax-stamp** is 320ms with overshoot — matches spec.
- **Cathedral bell** is fired exactly once per run from the victory path — matches spec's "once per run" rule.
- **Motion timings live in code, not in stored data** — Storage Rule 2 OK.
- **Audio cue identifiers don't bleed into stored data** — Storage Rule 3 OK.
- **Vault information-loss rule** is enforced server-side: the `getVaultForOwner` query selects only spine fields; tile name / face / narrative are never returned to the client even though they exist in the row.
- **The `getTheme()` indirection** is structurally sound — it's just thinly used.

---

## What this audit does *not* cover

- I didn't run the dev server. All findings are static.
- I didn't verify pixel-level layout fidelity against the spec's SVG mockups.
- I didn't audit the select-five mode against any of these specs (the architecture spec doesn't mention it; bibliophile spec barely does).
- I didn't audit the AI prompt templates against the architecture spec's "should themes affect text content" open question (§8).
- I didn't audit the tapestry pipeline for theme-coupling (the AI image generator may take theme-coupled style hints in the prompt).

---

*End of audit. Findings are observational; no code changed. Recommended next step: triage the ten conflicts in §4, then decide whether to fix Storage Rule 1 violations before or after a Curator or Cartographer manifest is written.*
