# Bibliophile — Gap Analysis

> A structured comparison of `docs/design/bibliophile-spec.md` (the canonical design) against the current `tiered-2d-breeder` codebase as of 2026-04-27 (branch `bibliophile-2026-04-27`). Intended to inform prioritization, **not** to prescribe an order. No code is being changed in this pass.

**Author:** Claude (read-only research pass)
**Source spec:** `docs/design/bibliophile-spec.md`
**Source code:** `master`-derived branch `bibliophile-2026-04-27`
**Companion docs:** `docs/design/bibliophile-decisions.md` (running log of implementation calls and proposed spec edits)

---

## TL;DR

The codebase already ships **a working, AI-driven, era-progression tile combiner with persistence, auth, S3 storage, PostHog analytics, and a per-era idea-tile pick** that maps directly onto the spec's "bind" primitive. About **60% of the structural mechanics from the spec already exist as plumbing** — the work that's missing is overwhelmingly:

1. **The visual rebrand** — the entire CSS layer (palette, typography, motifs) is dark-navy/red/gold, not leather/marble/vellum.
2. **The ceremonial layer** — there is no hold-to-commit, no cello, no clasp, no page-turn, no audio at all.
3. **The library/vault/retirement loop** — kept tiles do not accumulate across runs; there is no library cap, no retirement, no vault.
4. **The motion grammar** — animations exist (pulse, glow, fade) but the spec's vocabulary (ink-bloom, hold-arc, brush-wipe, brass-clasp, page-turn) is not implemented.
5. **The strip primitive** — `era-progress` is a dim cube row at the bottom, not a leather binding strip with kept-tile faces and four states.
6. **Onboarding** — no first-run sequence; there is a "How to Play" modal but it is unrelated to the spec's 90-second narrative arc.
7. **Bari** — exists as a static emoji avatar with `idle`/`active` only; spec calls for four poses with art-direction guidance.

The data model is **closer to the target than the visual layer**, but it has gaps around the library/vault concepts that need new tables (or repurposed existing ones).

---

## Reading guide

Each subsection of the spec gets its own row in the matrix below. Status keys:

| Symbol | Meaning |
|---|---|
| ✅ | Implemented and matches spec intent |
| 🟡 | Partially implemented — present in some form but reskin/extend required |
| ⛔ | Not implemented |
| ⚠ | Conflicts with current implementation — needs explicit decision before building |

---

## 1. Identity (spec §1)

| Item | Status | Notes |
|---|---|---|
| Bibliophile palette tokens (`--ink-black`, `--oxblood`, `--gilt`, `--vellum`, `--leather-deep`, `--paper-dark`, `--marble-warm`, `--marble-cool`) | ⛔ | Current palette: `#1a1a2e` (body), `#16213e` (sidebar), `#0f3460` (panels), `#e94560` (accent red), `#ffd700` (gold). Zero overlap with spec tokens. |
| Per-chapter chromatic binding stripes (hash of `era_id × kept_tile_id × run_id`) | ⛔ | Era-cube backgrounds today are a single chrome gradient. No per-chapter color, no hash lookup, no curated palette of ~15 muted leathers. |
| **Cardo** humanist serif | ⛔ | Body uses `system-ui, -apple-system, sans-serif`. No web font import. |
| **Inter** grotesque for UI labels | ⛔ | Same — system stack only. |
| Marbled endpaper SVG pattern (curved horizontal veins, ~30% opacity, two-tone) | ⛔ | No marble texture exists. Tile faces are flat-color `data.color` backgrounds. |
| Embossed leather pattern (solid color + 1px noise) | ⛔ | No leather texture. |
| Bookplate frame (marbled fill, sepia border, italic name, optional tier stars) | 🟡 | `.combine-item` and `.palette-item` already render `{emoji, name, tier-stars}` — the data shape is right, the chrome is wrong. Tier stars use `★` (ASCII), italic name absent. |
| Anti-references respected (no neon, no pulse-when-idle) | ⚠ | Current build has a pulse merge animation, glow shadows, and a gold-glow `era-cube--active` that pulses-by-virtue-of-the-CSS-shadow. Will need explicit removal. |

**Verdict:** This entire section is a reskin. The data is shaped right; the visual layer is from a different game. Expect a near-total CSS rewrite plus two web fonts plus three SVG patterns.

---

## 2. Core mechanics (spec §2)

### 2.1 Combining tiles

| Item | Status | Notes |
|---|---|---|
| Drag one tile onto another to combine | ✅ | `src/main.ts:1840-1953` — `combine()`, with overlap detection via 48px proximity (`findOverlap`, `src/main.ts:1801`). |
| AI-driven for novel combos, cached for known | ✅ | `recipeStore.get(key)` short-circuits; otherwise `/api/combine` runs a Vertex AI call (`app/api/combine/route.ts`). |
| Source tiles persist by default | ⚠ | **Conflicts with current code.** `combine()` calls `removeItem(a)` and `removeItem(b)` for the workspace tiles (`src/main.ts:1849-1850`). The *palette* persists, but workspace instances are consumed. If "tile" in the spec means a palette card, current behavior matches; if it means a workspace instance, it doesn't. **Needs decision** — see decisions doc. |
| Successful combine → ink-bloom 600ms | 🟡 | Current animation: 400ms `pulse` (scale 1→1.2→1) on `.combine-item.merging`. Different curve, different metaphor (no opacity ramp, no two-source convergence). |
| Failed combine → 240ms shake (±3px, 3 osc), tile dims, soft inkwell tap sound | 🟡 | Visual: `.combo-reject::before/::after` draws an X over the rejected pair (`src/style.css:442-457`); no shake, no dim, no sound. Spec's "no buzzer" is honored by accident. |

### 2.2 Binding (chapter end)

| Item | Status | Notes |
|---|---|---|
| At chapter end, player picks one tile from chapter's discoveries | 🟡 | A direct analog exists: the **era-idea-slot** above the "Next Age" button. The player drops a workspace tile into it and clicks the button. Captured in `pendingEraIdeaTile` (`src/main.ts:81`), persisted to `era_idea_tile` DB table on transition (`src/main.ts:2110-2127`, `app/api/era-idea-tile/route.ts`), and rendered above completed era cubes (`src/main.ts:101-127`). |
| Bound tile becomes a **permanent kept book** in the player's library | ⛔ | The pick survives in `eraHistory[i].ideaTilePick` for the duration of the run, but it is **wiped on `clearSave()`** (which fires on victory and on restart). There is no library aggregate, no cross-run accumulation, no account-bound shelf. |
| Hold-to-commit interaction | ⛔ | Current binding is a 2-step gesture: drop the tile + click "Next Age →". No hold, no arc, no audio, no commit. |

### 2.3 Retirement (library full)

| Item | Status | Notes |
|---|---|---|
| 24-tile library cap | ⛔ | No library exists. |
| Retirement gesture (press-and-hold) | ⛔ | — |
| Retirement → tile gone from library, full data preserved server-side | ⛔ | No vault table, no retired-tile concept. |

### 2.4 Hold-to-commit (master interaction)

| Item | Status | Notes |
|---|---|---|
| Pre-commit drop (snap, halo brightens, hold-arc appears) | ⛔ | — |
| 2.5s linear hold-arc fill | ⛔ | — |
| Cello G2 (bind) / C2 (retire) sustaining | ⛔ | No audio infrastructure. |
| Brass-clasp commit (220ms `cubic-bezier(0.4, 0, 0.2, 1)`, ±20px slide) | ⛔ | — |
| Plate breathing post-commit (1.0 ↔ 1.02 scale, 3s sine) | ⛔ | — |
| "release to continue" italic line at +1.5s | ⛔ | — |
| 1.2s held silence, then auto page-turn | ⛔ | — |
| Cancellation (lift before 2.5s → graceful, 280ms ease-out, no fail sound) | ⛔ | — |

**Verdict:** §2.4 is the spec's centerpiece interaction and is **entirely absent**. This is the highest-leverage build target — adding it transforms the bind ceremony, retirement ceremony, and onboarding all at once because all three reuse the same primitive.

---

## 3. Surfaces (spec §3)

### 3.1 Onboarding (first 90 seconds)

| Item | Status | Notes |
|---|---|---|
| Black-screen → leather book → title types in gilt → "Chapter I" | ⛔ | No onboarding sequence at all. |
| Bari fades in lower-left, Fire+Wood ink-bloom, italic "Try." | ⛔ | — |
| Idle 4s → gilt arc draws between Fire and Wood, 600ms hold, fades, loops | ⛔ | An `arrow-trail.ts` primitive exists for the *era idea-slot* prompt — analogous mechanism, not analogous styling, not used at run start. |
| Combine resolves → desaturate, cello G2 700ms | ⛔ | — |
| Torch ink-blooms + narrative types in + Bari nods | ⛔ | — |
| Inventory ink-blooms in, objectives card appears, run begins | ⛔ | The objectives card already exists (`#era-goals`, `src/style.css:156`); it just doesn't have a curtain raise. |
| 5-second cold open on subsequent runs | ⛔ | Currently no cold open at all. |
| First-time HTP modal | 🟡 | `app/components/auth-overlay.tsx:30` — `htpKey` localStorage flag; on first visit a "How to Play" video modal opens. This is ad-hoc (using `public/how-to-play.mp4`), unrelated to the spec's narrative arc. **Either repurpose or replace.** |

### 3.2 Play screen (mid-run)

| Item | Status | Notes |
|---|---|---|
| Mobile-first vertical stack: chapter title bar, objectives card, workspace, inventory, strip, Bari | 🟡 | Current layout: left **sidebar** (palette, era display, goals, idea slot, restart, Bari), right workspace. **Sidebar is on the left**, not stacked top-to-bottom. The spec layout is portrait-mobile-first; current is desktop landscape. Mobile portrait CSS exists (`@media (max-width: 600px)`) but it is select-five-specific. |
| Chapter title bar (`#1a1208` bg, gilt italic Cardo) | 🟡 | `#era-name` exists with gold color (`#ffd700`), but no `#1a1208` bar, no italic Cardo, no "Chapter [roman]" framing — just an era name. |
| Objectives card (vellum bg, leather border, two-column ✓/○ list) | 🟡 | `#era-goals` shows ✓/○ with strike-through (`src/style.css:184-202`), but rendering is single-column dark navy. Also: spec's "four objectives" implies a single goal track; code has **two parallel goals per era** (one minTier=3 deterministic + one AI-checked with N-of-M conditions). |
| Workspace / "writing desk" with `#1a1208` bg + leather border + italic caption | 🟡 | `#workspace` exists as a flex-1 region with no border, no caption. The bg is body-color (`#1a1a2e`). |
| Card catalog / inventory (4-up grid, scrollable) | 🟡 | `.palette-item` is a row-style list, not a 4-up grid. Scrolls fine. **Cap of 3 discovered slots** (`MAX_DISCOVERED_SLOTS = 3`, `src/main.ts:2612`) — this means only 3 most-recent non-seed discoveries persist in the inventory at once. **Conflicts with spec's "the player's catalog grows with each new combination."** |
| Strip (kept-tiles-as-books at bottom edge) | 🟡 | `#era-progress` (`src/style.css:2226-2310`) renders 36×36 chrome cubes + dots/dashes, scroll-snapped, anchored to bottom of workspace. The shape is right; the visual treatment is sci-fi chrome, not leather binding. See §4 detail below. |
| Bari (lower-left margin, fixed) | 🟡 | `#bari` is in the palette sidebar bottom-left, but it's a child of the palette flex column, not absolutely positioned. Anchors to bottom-left only because the sidebar puts it there. |
| Drag from inventory or workspace → drop onto another tile | ✅ | `src/main.ts:2589-2608` (palette pointerdown spawns workspace item and starts drag); workspace drag in `src/main.ts:1784-1795`. |
| Drag from strip (kept-tile cubes act as inventory) | 🟡 | The era-cube-idea (the bound idea tile sitting on a completed-era cube) **is already draggable** to spawn a workspace copy without depleting the cube — `wireEraCubeIdeaTiles` (`src/main.ts:132-162`). This is a precise match for spec's "Strip tiles persist when combined." |
| Long-press any tile → narrative card slides in from below | ⛔ | Current behavior: hover shows a tooltip card (`src/style.css:320-355`). On mobile there's no equivalent — no long-press handler. |
| Tap a strip cube → narrative card | ⛔ | Tapping era-cube does nothing (the cube has a `title=` attribute only). |

### 3.3 Bind ceremony

The current code has **a two-step bind**: drop tile in slot, click "Next Age →" button. The spec replaces this with a **single hold-to-commit gesture**.

| Frame | Spec | Current code |
|---|---|---|
| Bind-A | Last objective ticks → border warms `#8b6f47` → `#c9a85f`, singing-bowl 1.4s tail | Last objective ticks → era-idea-slot wrapper unhides (`showEraIdeaSlot`, `src/main.ts:2349-2358`), `chartEraBtn` becomes visible. No audio, no border warm. |
| Bind-B | Workshop dims to silhouette, plate scales 0.92 → 1.0 with halo, eight chapter pieces ink-bloom (50ms stagger), cello G2 inhale | Wrapper appears; arrow-trail (`createArrowTrail`, `src/main.ts:2343`) animates pointing at the slot. No dim, no scale, no chapter-piece ink-bloom, no cello. The "eight chapter pieces" concept doesn't exist — the player picks from the **whole inventory**, not from a curated set of "this chapter's discoveries." |
| Bind-C | Player drags tile into plate, snap, halo brighten, hold-arc, cello sustain, soft leather press | Player drags any workspace tile to slot, slot highlights, slot fills. No hold, no arc, no sustain, no SFX. |
| Bind-D | Hold-arc fills clockwise 2.5s linear, hue shift, plate border thickens, second cello note enters at 1.0s | — |
| Bind-E | Brass clasps slide ±20px, hold-arc completes, strip cube blooms, cello G2 resolves up a fifth, sharp medium haptic + soft second tick | Player clicks "Next Age →" button. `chartEraBtn` click handler (`src/main.ts:2557-2570`) triggers `doEraTransition`. No clasps, no haptic, no audio. |
| Bind-F | Plate breathes, halo alpha 0.06↔0.12, sustained low cello C2, "release to continue" at +1.5s | — (no hold = no breathe) |
| Release | Stillness → page auto-turn into era summary | After ~600ms of internal pipeline work, `showEraSummary` opens an overlay panel. No page-turn animation. |
| Cancellation | Lift before 2.5s → tile rises 60px out, hold-arc fades, cello breath G2→F2 | Drop tile in slot, drag it back out, slot empties. No animation, no SFX. |

**Verdict:** The pipeline (idea-slot pick → button click → era-summary) is the right *information flow*. The spec is rewriting the *gesture*. The hold-to-commit is the load-bearing change.

### 3.4 Era summary

Spec's flow: `bind commit → page-turn auto → spread translates from y+40 → frontispiece brush-wipe → narrative types in → manual "Begin Chapter [next] →"`.

| Item | Status | Notes |
|---|---|---|
| Spread translate from y+40 to 0 over 600ms `cubic-bezier(0.2, 0.8, 0.2, 1)` | ⛔ | Current: `#era-summary-overlay` toggles `.visible` class (instant). |
| Frontispiece brush wipe (clip-path inset 100% → 0%, 1400ms ease-out, +4px drift) | ⛔ | The frontispiece **is** generated (it's called the "tapestry") via `/api/generate-tapestry` → S3 → `<img>` in `#tapestry-overlay`. But the reveal is just an overlay open, not a brush wipe. Tapestry shows in a **separate** overlay (`tapestryOverlay`) **after** the era-summary continue, not embedded in the summary spread. |
| Narrative types in ~30ms/char with pen scratch every 6 chars | ⛔ | `era-summary-narrative` text is set instantly via `textContent`. |
| Stats fade in after typing | 🟡 | Stats render is instant but **the data is rich** (`renderEraStatCards`, `src/main.ts:2229-2267` — tier-by-tier table, favorite tile, totals). |
| Thin gilt "Begin Chapter [next] →" button | 🟡 | `era-summary-continue-btn` exists, label = "Begin {nextEraName} →". Visual is a gold rounded button — close enough to gilt with a reskin. Label format is right. |
| Manual tap (not auto-advance) | ✅ | Player must click; spec matches. |
| Page-turn 700ms peel → next chapter | ⛔ | Continue click triggers `onContinue` callback (`src/main.ts:2306-2310`) which removes overlay (instant) and rebuilds palette. No peel. |

### 3.5 Library

| Item | Status | Notes |
|---|---|---|
| Persistent, account-bound, accessible from main menu and run-end | ⛔ | The closest thing is the **scoreboard** (`src/main.ts:2391-2429`) which shows `eraManager.history` for the current run only — it does **not** survive `clearSave()`. There is no main-menu library. |
| 24 tiles maximum | ⛔ | No cap. |
| 6 rows × 4 columns | ⛔ | Scoreboard is a vertical timeline of era cards, not a grid of tile spines. |
| 32×44 tile + 2.5px binding stripe | ⛔ | — |
| Empty slot / filled tile / counter visual states | ⛔ | — |
| Tap tile → pull-up bookplate sheet | ⛔ | — |
| "X of 24 kept" counter, gilt when full | ⛔ | — |
| Share button → Open Graph card + stable URL | 🟡 | `victoryShareBtn` and `tapestry-share-btn` use `html-to-image` to PNG-export the panel, then `navigator.share` or anchor download (`saveImage`, `src/main.ts:199-213`). That's a download path, not a stable URL. Tapestries do have a stable share URL pattern (`/tapestries/{id}`, see `app/tapestries/[id]/`). |
| Wall-full state (24/24 → footer "your shelf is full…") | ⛔ | — |

### 3.6 Retirement ceremony

| Item | Status | Notes |
|---|---|---|
| Triggered when binding while library at 24/24 | ⛔ | — |
| 4-frame ceremony (Retire 01–04) | ⛔ | — |
| First-time copy + Bari speech | ⛔ | Bari has no speech; there's no mechanism to surface margin text from him. |
| "Don't keep this chapter" affordance | ⛔ | — |
| Ink-point dispersal (~9 small circles, 1.4s, drift up + fade) | ⛔ | A "wax-droplet primitive" is mentioned in the spec; nothing analogous exists. |
| Cello C2 → G1 descending tail | ⛔ | — |
| Wax stamp click ~80ms SFX | ⛔ | — |

### 3.7 Vault

| Item | Status | Notes |
|---|---|---|
| Separate persistent page for retired tiles | ⛔ | — |
| Vertical scrolling list of binding spines (no tile face/name/narrative) | ⛔ | — |
| Tap spine → minimal info card ("Given to the world · Run [N] · Chapter [roman]") | ⛔ | — |
| Store full tile data on retire (engineering note) | ⛔ | A new table or a `retiredAt` column on `era_idea_tile` would handle this. See §11 of the spec (to be added). |

### 3.8 Run end

| Item | Status | Notes |
|---|---|---|
| Triggered after eleventh chapter's bind | 🟡 | Triggered after the **last era's** bind. Currently the era list has 11 entries (Stone Age → Space Age), but `MIN_ERAS = 5` in `era-manager.ts:6` means a player won't necessarily see all 11. **Conflicts** — see decisions doc. |
| Red wax seal scales 1.4 → 1.0 (320ms with overshoot) onto the strip's center | ⛔ | — |
| Three small wax-droplet dots fan out and fade | ⛔ | — |
| Gilt "A" embossed inward on seal | ⛔ | — |
| Cathedral bell (~110Hz, 4s tail) — the only place this sound exists | ⛔ | No audio at all. |
| Heavy low thud haptic — the only "thud" haptic in the run | ⛔ | No haptics anywhere. |
| "Age of Plenty" overlay rises | ✅ | Hardcoded literal "Age of Plenty" already in `src/main.ts:2052, 2143-2158`. The `#victory-overlay` opens with a stats panel. |
| Title types in 1.6s after bell starts | ⛔ | Title is set via `textContent` instantly. |
| Stats fade in 800ms after title | ⛔ | — |
| "Open the library →" button appears 1.5s after stats | ⛔ | The continue button is a "Continue" / "Play Again" button. No library link. |
| Workshop bed restored very quietly | ⛔ | — |

---

## 4. Strip behavior (spec §4)

The spec specifies four states (Locked, Active, Awaiting binding, Bound) and a per-cube state machine.

| State | Spec | Current code |
|---|---|---|
| Locked | Dim cube, leather border `#5a4528`, era roman numeral muted | `.era-cube--unknown` (`src/style.css:2277-2280`) — uses opacity 0.22 + grayscale; no roman, no leather. The future-eras placeholder is a single cube, not a sequence of locked cubes for all 11 chapters. |
| Active | Bright cube, gilt border, italic Cardo roman | `.era-cube--active` (`src/style.css:2270-2275`) — chrome gradient + blue glow box-shadow. No roman, no italic. |
| Awaiting binding | Active + dashed inner border, ⌑ glyph | The `#era-idea-slot` itself shows a dashed border + "Drop a tile here" hint when empty (`src/style.css:1402-1431`). The state lives **on the idea slot, not on the cube**. Spec wants both. |
| Bound | Tile face visible inside cube (binding stripe + emoji + roman) | The `era-cube-idea` element (`src/style.css:1478-1500`) injects an oversized emoji inside the completed era's cube with a gold halo. **Closest existing primitive to the bound state.** Roman numeral missing; binding stripe absent; chapter-color hash absent. |

| Item | Status | Notes |
|---|---|---|
| Cube sizes by context (16×20 mid-run, 24×30 bind, 36×24 era summary, 32×44 library, 60×36 run end) | ⛔ | Today there is one cube size: 36×36. |
| State diagram per cube (locked → active → awaiting binding → bound) | 🟡 | The first three states map to era-progress rendering logic in `renderEraProgress` (`src/main.ts:90-128`); the fourth maps to era-cube-idea injection. The diagram is implicit in the if/else cascade. |
| Bound cube interaction: tap → narrative card | ⛔ | Bound cube has no tap handler. |
| Bound cube interaction: drag → tile lifts out, treated as inventory tile, source cube stays bound | ✅ | `wireEraCubeIdeaTiles` (`src/main.ts:132-162`) does exactly this — drag spawns a workspace copy, source remains. |
| Active cube enlarges 16×20 → 24×30 during bind ceremony | ⛔ | No size morph; cube stays 36×36. |
| Cube bloom-fills on commit, sync'd with brass clasp (400ms) | ⛔ | No bloom-fill primitive. |

**Verdict:** The strip is the most-onscreen element in the spec, and the current cube row is structurally close (the right number of slots, the right state cascade, drag-from-bound already works). **Pure visual + audio reskin** — interactions are mostly there.

---

## 5. Bari (spec §5)

| Pose | Status | Notes |
|---|---|---|
| Idle / watching (default 90% of screen time) | 🟡 | `#bari-char` (boy emoji 👦) + `#bari-tool` (hammer 🔨) static side-by-side. No breath cycle, no eye tracking. |
| Approval nod (head -6°, 240ms hold, 800ms total) | ⛔ | — |
| Wonder / leaning in | ⛔ | — |
| Patient / waiting | ⛔ | — |
| `.active` class for AI calls (currently bouncing) | ⚠ | Exists (`src/main.ts:1871, 1895`) but bounces during combine API call — **not a spec pose**. Will need to be retired or repurposed. |
| Final art is illustrated/painted | ⛔ | Placeholder is two emojis. The spec acknowledges the SVG wireframes are placeholder and the target is "Disney-storybook-painted." |
| Bari speaks once, on first wall-full retirement | ⛔ | No speech, no first-wall-full state. |

---

## 6. Motion language (spec §6)

| Primitive | Status | Notes |
|---|---|---|
| Ink-bloom | ⛔ | Closest existing animation is `pulse` (scale 1→1.2→1, `src/style.css:436-440`). Different curve, no opacity ramp. |
| Page-darken | ⛔ | — |
| Gilt halo (3 concentric circles, 1.6s sine) | 🟡 | The era-idea-slot uses a dashed border + soft glow, and `glow-green` / `glow-red` shadows on combine items, but neither is concentric or sine-pulsed. |
| Brass clasp | ⛔ | — |
| Hold-arc | ⛔ | — |
| Plate breathing | ⛔ | — |
| Brush wipe | ⛔ | — |
| Page turn (2D peel from right edge) | ⛔ | — |
| Cube bloom | ⛔ | The era-cube-idea pops in via class addition (instant). |
| Wax stamp | ⛔ | — |
| Ink-point dispersal | ⛔ | — |
| Bari nod | ⛔ | — |
| Failed-combine shake | ⛔ | The failed-combine X (`combo-reject`, `src/style.css:442-457`) does not shake. |
| Scratch-in (typewriter) for narrative text | ⛔ | All narrative is set instantly. |

**Three rules:**
- "No bounces above 12% overshoot" — current `pulse` goes to 1.2 (20% overshoot) → **violates**.
- "Easing is asymmetric" — current animations are symmetric `ease-in-out`.
- "Reduced-motion mode" — no `prefers-reduced-motion` handling anywhere.

---

## 7. Audio cues (spec §7)

| Cue | Status | Notes |
|---|---|---|
| Combine resolve | ⛔ | No audio infrastructure. No `<audio>` tags, no Web Audio API, no asset directory. |
| Combine impossible | ⛔ | — |
| Held-breath inhale (cello G2 sustain) | ⛔ | — |
| Era goal met (singing bowl ~1.4s) | ⛔ | — |
| Tile bound (clasp snap) | ⛔ | — |
| Post-commit breath (cello C2 subliminal) | ⛔ | — |
| Retirement exhale (cello C2→G1) | ⛔ | — |
| Page turn (paper rustle) | ⛔ | — |
| Tapestry painting (brush on canvas) | ⛔ | — |
| Run sealed (cathedral bell, once per run) | ⛔ | — |
| Workshop room tone (toggleable) | ⛔ | — |
| Loudness rules (-14 to -25 LUFS) | ⛔ | — |
| Master-clock relationship (cello = 2.5s = hold duration) | ⛔ | — |

**Verdict:** Audio is ground-zero. There are no assets, no playback layer, no settings UI. This is **the largest single missing piece** by surface area.

---

## 8. Accessibility (spec §8)

| Item | Status | Notes |
|---|---|---|
| Reduced motion (ink-bloom → 200ms fade, brush wipe → instant, Bari nod → opacity flicker, audio unchanged) | ⛔ | No `prefers-reduced-motion` media query anywhere. |
| Hold alternative ("tap-to-commit" mode for users who can't sustain a press) | ⛔ | No settings UI for input alternatives. |
| Audio always paired with visual cue | 🟡 | Trivially true today (no audio). Becomes an active requirement when audio lands. |
| Cardo at minimum 14pt for narrative, 11pt for UI labels | ⛔ | No Cardo. Current font sizes range from 7pt (palette stars) to 16pt (era name). Many existing labels are below 11pt. |
| High-contrast mode (swap vellum/ink-black, +50% borders, no marble) | ⛔ | No high-contrast toggle. |

---

## 9. Open questions and future scope (spec §9)

These are spec-level items already deferred or open. Tracking here only for completeness.

- **Letter-form transformation** for retirement → spec deferred to v1.1; gap is that retirement itself isn't built yet.
- **Library expansion mechanic** → deferred.
- **Community pool / "give it to the world"** → deferred to multiplayer phase. The DB design should already account for this (retired tile data is preserved server-side); see §11.
- **Codex view** vs. detail card → open.
- **Open Graph share card design** → open.

---

## 10. Appendix: design rationale (spec §10)

This is documentation, not implementation. No gap.

---

## 11. Data model and persistence (NEW — added to spec at user's request)

The spec doesn't currently cover this. **The user explicitly requested adding it as section 11.** The detailed write-up will live in the spec itself; this gap-analysis section just confirms that the existing data model **partially** supports the bibliophile features.

| Concept | Existing storage | Gaps for bibliophile |
|---|---|---|
| Identity (anonymous + authenticated) | `user`, `session`, `account`, `verification` (Better Auth, Drizzle) + `bari-anon-id` localStorage key + unique `user.anon_id` for claim-on-signup | None — solid. |
| Run | `runId` is a UUID minted in `src/main.ts:395` and stored in `SaveData.runId` (localStorage) and on `tapestry.run_id` and `era_idea_tile.run_id` columns | Need a `run` table or run-scoped queries to support "From your Nth run · Chapter X" copy in the library bookplate sheet. Today the run only exists as a foreign-key column on three tables. |
| Bound tile (per chapter) | `era_idea_tile` table — userId/anonId, runId, eraName, full tile data (name, tier, emoji, color, description, narrative). Persisted server-side via `/api/era-idea-tile` (`app/api/era-idea-tile/route.ts`). Anonymous→authenticated claim handled in `record-activity`. | Already represents a bound tile cleanly — could be **renamed `bound_tile`** or **kept as `era_idea_tile` with a comment**. Needs (a) an explicit `boundAt` timestamp (currently uses `createdAt`), (b) optional `chapterIndex` so library queries don't depend on era name string, (c) optional `bindingStripeColor` cached at write-time so library rendering doesn't need to recompute the hash. |
| Library (the 24-slot shelf) | ⛔ Does not exist | Two viable options: (a) treat the library as a **derived view** over `era_idea_tile WHERE retiredAt IS NULL ORDER BY createdAt DESC LIMIT 24` (no new table — most flexible); (b) maintain a `library_slot` table with explicit positions. Option (a) is cleaner. |
| Vault (retired tiles) | ⛔ Does not exist | Add a `retiredAt` timestamp to `era_idea_tile`. Library = `WHERE retiredAt IS NULL`. Vault = `WHERE retiredAt IS NOT NULL ORDER BY retiredAt DESC`. Spec requires the **full tile data persists** so future multiplayer can use it; the existing schema already holds full tile data. |
| Frontispiece (a.k.a. tapestry) | `tapestry` table — userId/anonId, runId, S3 bucket+key, mimeType, byteSize, eraName, nextEraName, narrative, gameData JSONB | Already supports the spec's "Era summary frontispiece." Renaming to `frontispiece` is optional. |
| Save state (localStorage) | `SaveData` v1 — see `src/save.ts` | Will need a v2 if we add: bound-tile pick draft state (currently `pendingEraIdeaTile`), library snapshot for offline use, hold-state mid-flight. |
| Bari first-wall-full speech flag | ⛔ Does not exist | Single bit on `user`: `seenFirstRetirementSpeech`. Or store on save (account-bound only matters when authenticated; anon users can re-trigger if they clear localStorage). |
| Player settings (reduced motion, hold-alternative, room tone toggle) | ⛔ Does not exist | New `user_setting` table or JSONB on user. Anonymous players use localStorage. |

**Verdict:** The schema is closer to bibliophile than the visual layer suggests. Adding two columns (`retiredAt`, `chapterIndex`) and an optional `bound_tile` rename would unlock the library/vault entirely.

---

## Cross-cutting concerns

### Naming alignment

| Spec term | Current code term | Recommendation |
|---|---|---|
| Chapter | Era | Rename in user-facing copy; keep `era` as the engineering term. |
| Bound tile | `eraIdeaTile` / "idea tile pick" | User-facing: "kept book" or "bound tile". Engineering: keep table as-is or rename to `bound_tile`. |
| Frontispiece | Tapestry | User-facing: "frontispiece". Engineering: `tapestry` table is fine; the field is content, not name. |
| Library | (no equivalent — closest is "Scoreboard") | New surface; existing scoreboard is timeline-of-runs, not shelf-of-books. Scoreboard can survive as a separate "Civilization Progress" page. |
| Vault | (no equivalent) | New surface. |
| Strip | `era-progress` | Engineering name fine; reskin the visuals. |
| Workspace / "writing desk" | `#workspace` | Add the italic caption "— the writing desk —"; otherwise the same element. |
| The Age of Plenty | "the Age of Plenty" hardcoded string | Already correct. ✓ |

### Branch / app naming

The branch is `bibliophile-2026-04-27`, but PostHog events still tag `app: 'architect'` (`app/api/auth/record-activity/route.ts:57`, `combine/route.ts:57`, etc.) and the metadata title is "Bari The Architect" (`app/layout.tsx:11`). The product name in the README is "Bari the Architect." If "Idea Collector" / "Bibliophile" is the new direction, **none of these have been updated yet**. Worth deciding whether the rebrand is deep (rename product, change metadata title, switch PostHog `app` super-property) or thin (visual reskin only, marketing name stays).

### Select-five mode

`selectFiveMode` is a parallel UX (see `app/select-five/`, large blocks in `src/main.ts:1455-1648`) where players hand-curate 5 tiles instead of progressing through eras. **The bibliophile spec doesn't mention this mode at all.** Either:
- Treat select-five as out-of-scope for the rebrand and let it ride on the current visual treatment;
- Reskin select-five with bibliophile colors but leave its mechanics alone;
- Retire select-five if the bibliophile direction supersedes it.

This needs an explicit call.

### MIN_ERAS = 5 vs eleven-chapter spec

`era-manager.ts:6` enforces `MIN_ERAS = 5`. Players who advance quickly may transition to "Space Age" after as few as five eras out of eleven. The spec assumes a fixed 11-chapter arc with eleven binds. **Either drop `MIN_ERAS` (forcing the full 11-chapter walk) or have the spec acknowledge variable chapter count** (which would change a lot of strip illustrations and the 24-tile library cap math).

### Multi-goal-per-era vs single objectives card — resolved

Each era runs **two goals in parallel** (deterministic `minTier=3` + AI-judged N-of-M). User decided 2026-04-27 to keep this design. The spec was updated (§3.2) to acknowledge the dual-track model: the deterministic tier goal renders as a small badge in the chapter title bar; the AI-judged conditions populate the objectives card. See decisions doc D7.

### Catalog cap of 3 — resolved

`MAX_DISCOVERED_SLOTS = 3` (`src/main.ts:2612`) silently drops the oldest discovered tile when a fourth comes in. User decided 2026-04-27 to remove the cap entirely — players should be able to access all of their discovered tiles. The original cap was a UI/UX concession for the previous edition's interface and does not apply to the bibliophile direction. Spec §3.2 updated to specify "No cap." See decisions doc D8. Code change: delete `MAX_DISCOVERED_SLOTS` and the trim-on-overflow branch in `addToPaletteIfNew` (`src/main.ts:2612-2622`).

---

## Suggested categories of work

These are not a build order — just useful buckets when prioritizing.

1. **Visual rebrand** — palette, fonts, marble/leather/gilt patterns, typography scale, page chrome. Self-contained. Runs in parallel with everything else.
2. **Strip primitive completion** — four states, per-context sizes, chromatic binding stripes, roman numerals, italic Cardo on cubes.
3. **Hold-to-commit primitive** — the heart. Once built, it powers bind, retirement, and onboarding.
4. **Audio layer** — Web Audio API or `<audio>` elements, asset registry, loudness normalization, settings toggle. The cello drives hold duration so should land before / alongside the hold primitive.
5. **Library + Vault + Retirement** — adds two columns to `era_idea_tile`, two new pages/surfaces, and the wall-full ceremony with Bari's one line of speech.
6. **Onboarding** — first-run 90s sequence + 5-second cold open thereafter; replaces or repurposes the HTP modal.
7. **Era summary refit** — embed the frontispiece in the spread, brush-wipe reveal, scratch-in narrative, page-turn transitions on commit.
8. **Bari poses** — replace placeholder emoji with painted art; add three new poses.
9. **Motion language** — ink-bloom, page-turn, brush-wipe, brass-clasp, hold-arc, ink-point dispersal as reusable primitives.
10. **Accessibility** — reduced motion, tap-to-commit alternative, high-contrast, font-size floor.
11. **Run-end ceremony** — wax seal, cathedral bell (once-per-run audio, hardest to test), Age of Plenty overlay reflow, "Open the library →" link.
12. **Naming sweep** — chapter↔era, Idea Collector↔Bari the Architect, app metadata, PostHog super-property.
13. **MIN_ERAS / chapter-count alignment** — spec or code, pick one.
14. **Catalog cap** — remove or move to a chapter-bounded model.
15. **Select-five mode disposition** — keep, reskin, or retire.

---

## Confidence and limitations

- **Confidence is high** for what's implemented (verified by reading the code).
- **Confidence is mixed** for the spec's intent on a few items: e.g. whether "tile" in §2.1 means a palette card (persists) or a workspace instance (currently consumed). These are flagged ⚠ and surfaced in the decisions doc for the user to resolve.
- **Not investigated:** select-five mode flows in detail (out of scope for spec); Discord activity flow; debug console; the specifics of `arrow-trail.ts`. These are tangential to the rebrand.

---

*Generated 2026-04-27. Read with `bibliophile-spec.md` and `bibliophile-decisions.md`.*
