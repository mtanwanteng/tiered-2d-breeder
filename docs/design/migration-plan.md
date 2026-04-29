# Theme System Migration Plan

> **Goal of this document.** Get from current state (a single Bibliophile theme that mostly works but bakes its identity into code, CSS, and the database) to fully tokenized multi-theme support per `docs/design/theming-architecture.md`. Curator and Cartographer should be a manifest swap, not a code rewrite, and a player should be able to flip themes mid-run without their library re-rendering with stale colors.
>
> **Companion docs.**
> - `docs/design/audit-report.md` — fact-finding pass that grounds this plan
> - `docs/design/theming-architecture.md` — the token system being adopted
> - `docs/design/bibliophile-spec.md` — the v1 theme (base spec)
> - `docs/design/curator-spec.md`, `docs/design/cartographer-spec.md` — delta specs
> - `docs/design/bibliophile-decisions.md` — D24/D25/D26 record recent ink-bloom/Bari/clasp decisions
>
> **Final file location.** This plan ships as `docs/design/migration-plan.md` once approved out of plan mode.

---

## Context

The audit (`audit-report.md`) found that the v1 theme abstraction is *scaffolded* but not *enforced*. A `Theme` interface, a manifest, a `setTheme()` function, and a `[data-theme="bibliophile"]` CSS scope all exist — but theme assets, fonts, audio, copy strings, motion variants, and (most importantly) per-tile colors all live as literals in code, CSS, and the database. Calling `setTheme(curator)` today would not visibly change the game.

The architecture spec is explicit about this being load-bearing: themes are a **live setting**, not a save commitment. A player can switch between runs, mid-run, anywhere — and the renderer must resolve visuals from the active theme so the library re-skins live. Storage Rule 1 (no hex values in tile/era data) is currently violated at five layers — but rather than strip the stored hex (irreversible for AI-generated tile colors), this plan **bypasses the storage at the render path**: the renderer ignores stored hex and resolves from the active theme. Stored colors are preserved as a future-experiment input per user direction.

This plan turns the audit's findings into ordered, independently-shippable work.

**Branching.** Continue on `theme-swapping-date` (already off the bibliophile tip). Each phase commits as a single sub-feature; the branch ships when Phase G passes.

---

## Phase summary

| # | Goal | Effort | Ships to users? |
|---|---|---|---|
| **A** | Expand the `Theme` contract to cover all six architecture-spec categories. No theme behavior change. | medium | No — internal contract only |
| **B** | Refactor Bibliophile to consume the new contract. Layout, copy, textures, fonts route through `getTheme()`. Game looks identical. | large | Yes — silent refactor |
| **C** | Render-path bypass: stripe/binding visuals resolve from the active theme via `chapterStripeColor()`. Storage (DB columns, types, AI prompt, save data, eras.json colors) is **kept intact** for a future experiment. | medium | Yes — silent re-render; existing tiles re-skin to active theme |
| **D** | Add Curator as a parallel theme manifest. Same mechanics, swapped tokens + assets + motion variants. Switch via dev-console flag. | medium | No — gated behind dev flag |
| **E** | Add Cartographer the same way. | medium | No — gated behind dev flag |
| **F** | Settings drawer "Appearance" section + persistence on the user row + SSR-safe initial paint. | small | Yes — players can switch |
| **G** | Live re-skin testing: mid-run switches, library with mixed-theme bound tiles, vault, run-end, accessibility. | small | Verification, no new code |

Total: ~6–8 weeks of solo engineering depending on how much of D/E art is commissioned vs. CC0-sourced.

---

## Phase A — Establish the token contract

**Goal.** Make the `Theme` TypeScript interface and the per-theme `tokens.css` express *all six* architecture-spec categories, even though only Bibliophile fills them today. After this phase, any future theme manifest is a fill-in-the-blanks exercise.

**Why first.** Phases B–F all depend on the contract. Doing this without a code-behavior change means the rest of the work has a stable target.

**Concretely.**

1. **Color tokens — add the abstract layer.** Bibliophile's `tokens.css` already declares the 8 spec palette colors plus 9 informal aliases (`--bg-body`, `--accent`, etc.). Replace the informal aliases with the architecture-spec set:

   ```
   --bg-page, --bg-surface, --bg-deep
   --text-primary, --text-secondary, --text-tertiary
   --accent, --accent-secondary
   --border-strong, --border-faint
   ```

   Keep the 8 raw palette names (`--ink-black`, `--gilt`, etc.) — they're the *swatch*, the abstract names are the *role*. Bibliophile's `tokens.css` becomes a mapping: "in this theme, `--bg-page` *means* `--paper-dark`."

2. **Typography tokens — expand.** Today's manifest has `fonts: { serif, sans }`. Replace with architecture-spec shape:

   ```ts
   fonts: {
     display: string;       // role: titles + narrative
     ui: string;            // role: labels + metadata
     mono?: string;         // optional; Cartographer only
     displayStyle: "italic" | "regular";
     uiCaseRule: "all-caps-tracked" | "sentence-case";
   }
   ```

   No CSS migration yet — just the contract.

3. **Texture tokens — formalize.** Manifest's `patterns: { marble, leather, parchment }` is Bibliophile-specific naming. Promote to abstract roles:

   ```ts
   textures: {
     pageBackground: string;  // url
     tileFaceFill: string;    // url
     borderTreatment?: string;
   }
   ```

   Old field stays available for backwards compat during Phase B.

4. **Motion tokens — new struct.** Add to the `Theme` interface:

   ```ts
   motion: {
     pageTransitionType: "peel-2d" | "pan-horizontal" | "fold-3d";
     pageTransitionDurationMs?: number;  // default 700, Cartographer overrides to 800
     bindClaspType: "horizontal-clasp" | "vertical-pin";
     inkBloomType: "fill-expand" | "frame-then-fill" | "outline-then-fill";
     frontispieceRevealType: "brush-wipe" | "spotlight-wipe" | "ink-wash";
   }
   ```

   No primitive variants exist yet — Phase D/E build them. Phase A just declares the discriminator.

5. **Audio textures — same.** Manifest's `audio: { ... }` already has 11 cue paths. Re-shape as `{ shared: { celloBind, celloRetire, celloBridge }, themed: { combineKnock, ..., workshopRoomTone } }` to match architecture's 3-shared / 8-themed split. The audio bus stays procedural for now (kill-switched per D14); the contract change is forward-looking.

6. **Chapter-color seed bank** — already correct (`bindingStripePalette`). Keep.

7. **Bibliophile manifest fills the new shape** with the values it already has. Fill `motion` with `{ pageTransitionType: "peel-2d", bindClaspType: "horizontal-clasp", inkBloomType: "fill-expand", frontispieceRevealType: "brush-wipe" }`.

**Files.**
- `src/theme/Theme.ts` — interface expansion
- `src/theme/bibliophile/manifest.ts` — fill the new fields
- `src/theme/bibliophile/tokens.css` — add the 10 abstract color tokens
- (no consumer code changes; that's Phase B)

**Verification.** `npx tsc --noEmit` clean. Game runs identically. Open DevTools, confirm `[data-theme="bibliophile"]` exposes both raw and abstract token names.

**Effort.** Medium. Mostly typed plumbing; no behavior to debug.

---

## Phase B — Migrate Bibliophile to consume tokens

**Goal.** Every consumer of theme-coupled values (CSS, JS, Layout, font loader) reads from the active theme rather than a literal. The game looks pixel-identical to today, but a future `setTheme(curator)` would actually re-skin the chrome.

**Why second.** A Curator/Cartographer theme can't ship until skin.css and the layout root stop hardcoding `bibliophile`.

**Concretely.**

1. **`skin.css` — abstract color references.** Sweep `var(--ink-black)`, `var(--gilt)`, etc. → `var(--text-primary)`, `var(--accent)`, etc., where the role is a better fit than the swatch. Keep raw token references where the swatch *is* the intent (the wax-seal radial gradient, e.g.). Net effect: skin.css uses ~70% abstract tokens, ~30% swatch names — Curator can swap the abstract layer cleanly.

2. **`skin.css` — texture URL tokens.** Replace the 22 `url(/themes/bibliophile/patterns/*.svg)` literals with `url(var(--texture-page-bg))`, etc. Bibliophile's `tokens.css` declares those CSS vars from the manifest's `textures.*` URLs.

3. **`main.ts` — kill the literal fallbacks.** Twelve sites identified by audit §2.1: replace each `"#5a4528"`/`"#777"`/`"#daa520"`/`"#0d1b2e"` with `getTheme().tokens.<name>` or `var(--<token>)` (depending on whether it's read in JS or written into a style attribute).

4. **`style.css` — kill the legacy stylesheet.** The 177 hex literals here are mostly dead — overridden by skin.css for the bibliophile theme. Audit each rule:
   - Rules that are pure overrides of skin.css concerns: delete.
   - Rules that are select-five-mode-only (legacy): leave but tokenize colors so the mode picks up the active theme's palette.
   - Rules that are debug-surface (heatmap, debug-console): tokenize where reasonable; defer where the surface is dev-only.
   This is the bulk of the phase's effort.

5. **`app/layout.tsx` — theme-driven font loading.** Replace the hardcoded Google Fonts URL with one built from `getTheme().fonts.display` + `.ui` + `.mono`. The data-theme attribute on `<html>` keeps `bibliophile` for now (the switcher in Phase F changes this). For SSR safety, the font URL is a server-side build, not a client-side string concatenation.

6. **`main.ts` — copy strings via manifest.** Five hardcoded literals identified by audit §4.7:
   - `"— the writing desk —"` workspace caption (l. 488, 2710) → `getTheme().copy.workspaceCaption`
   - `"Place two ideas here to combine."` writing-desk hint (l. 489) → `getTheme().copy.writingDeskHint`
   - `"Your Ideas"` inventory caption (l. 450) → `getTheme().copy.inventoryCaption`
   - `"Catalog →"` card-catalog button (l. 451) → `getTheme().copy.cardCatalogButton` (and update manifest from the stale `"Card Catalog →"` to `"Catalog →"` so they agree)
   - `"Save an idea tile for this era"`, `"Drop a tile here"`, `"Press and hold to bind"`, `"Tap to bind"` — slot prompt copy (l. 3705, 3710, 3712, 3724) → new `copy.slotPrompts` manifest substruct. Add to `Theme` interface.

7. **`OnboardingOverlay.tsx` — copy via manifest.** Five hardcoded strings (`"Idea Collector"` title, tagline, `"Try."`, `"Light pushed back at the dark."`, `"tap to begin"`) → read from `getTheme().copy.onboarding.*`. Touch the React import so it can read the manifest at module load. Keep the ONBOARDED_KEY storage flag.

8. **`Bookplate.tsx` — copy via manifest** (the `"Bound to your codex"` label is the canonical example for D-attributed framing — actually need to grep; may not exist).

**Files.**
- `src/theme/bibliophile/skin.css` — large refactor
- `src/style.css` — large cleanup (likely shrinks by half)
- `src/main.ts` — ~20 sites for copy + colors
- `app/components/OnboardingOverlay.tsx` — copy reads
- `app/components/Bookplate.tsx` — minor
- `app/layout.tsx` — font URL builder
- `src/theme/bibliophile/manifest.ts` — `cardCatalogButton` drift fix; new `slotPrompts` substruct

**Verification.**
- `npm run build` clean.
- `npm run dev` and play through one chapter end-to-end. Compare against pre-phase screenshots. Pixel-identical is the bar; if anything looks different, it's a regression.
- DevTools: `document.documentElement.style.setProperty('--accent', 'red')` should turn every gilt accent red. If it doesn't, that consumer is still reading a literal.
- Grep audit: zero hex literals in `src/main.ts` and `app/components/` for *theme-coupled* visuals (page chrome, accents, borders). Allowed hex sites: `src/theme/bibliophile/manifest.ts`, `tokens.css`, `eras.json` (preserved for future experiment per Phase C), AI-generated tile-face fill (preserved likewise), debug surfaces.

**Effort.** Large. The style.css cleanup alone is multiple sittings. Recommend pacing: skin.css refactor first (small commits), main.ts copy migration second, layout.tsx font loader third, style.css legacy cleanup last.

---

## Phase C — Render-path bypass (ignore stored colors, resolve from theme)

**Goal.** The render path stops reading stored hex values and instead resolves all visuals from the active theme. **Stored color data stays exactly where it is** — `tile_color`, `binding_stripe_color`, `ElementData.color`, `eras.json` color fields, AI prompt color generation, and save-data color fields all remain intact. They are preserved for a future experiment per user direction. This phase is a *render-path-only* change: storage is untouched.

**Why third.** F (the switcher) is mostly cosmetic without C — switching themes won't re-color existing tiles if rendering keeps reading the bound-time hex. D and E need the render path to be theme-driven so they don't have to fight stored data.

**Why preserve storage.** The user has flagged the stored colors as a future-experiment input. Stripping them is irreversible (AI-generated tile colors aren't recoverable), and there's no cost to leaving the columns and fields in place — we just stop reading them in the render path. If the experiment never lands, deletion is still trivial later.

**Concretely.**

1. **No DB migration.** `era_idea_tile.tile_color` and `era_idea_tile.binding_stripe_color` stay in the schema. No drizzle migration this phase.

2. **No schema/API change.** `src/db/schema.ts`, `src/db/era-idea-tiles.ts`, `app/api/library/route.ts`, `app/api/vault/route.ts` continue to return the color fields. Consumers may simply ignore them.

3. **Client render-time resolution — the actual change.**
   - `app/components/Bookplate.tsx`: stop reading `tile.bindingStripeColor`. Replace with `chapterStripeColor(tile.eraName, tile.tileName, tile.runId)` resolved against the **active theme's** `bindingStripePalette`. The `bindingStripeColor` prop may stay defined on the component (so the parent type-check still passes) but is no longer consumed inside the render.
   - `app/library/page.tsx`: same. Resolves from active theme on every render — switching themes re-skins live.
   - `app/vault/page.tsx`: same.
   - `src/main.ts`: any tile-face render that reads `data.color` for stripe/binding visuals must route through the theme. Tile-face *fill* color (the AI-generated swatch) can keep using `data.color` if that's what the user wants for the future experiment — flag for confirmation per call site, but the default rule is **stripe and binding visuals come from the theme; AI-generated tile-face hex stays as a stored attribute that the renderer is free to ignore**.

4. **Chapter-color seed function — already exists.**
   - `src/theme/chapterColor.ts:chapterStripeColor(eraName, tileName, runId)` already hashes the seed and indexes into the active theme's `bindingStripePalette`. No change needed.
   - The hash inputs (`eraName`, `tileName`, `runId`) are already on every `EraIdeaTilePick` row — no new column required.

5. **Types — keep color fields.**
   - `src/types.ts` `ElementData.color`, `CombineResult.color`, `EraIdeaTilePick.color`, `EraIdeaTilePick.bindingStripeColor` all remain. Renderer consumers stop reading them; producers (AI combine, era resolution) keep populating them.

6. **AI prompt — keep generating hex.**
   - `src/prompts.json` keeps `color: a hex color that visually represents it` on all four tier prompts.
   - `lib/server/vertex.ts:COMBINE_SCHEMA` keeps `color` on the structured-output schema.
   - `app/api/combine/route.ts` keeps returning the color.
   - The hex flows into the DB and save data as today — it is simply not consumed by the renderer.

7. **localStorage save — keep colors.**
   - `src/save.ts` SaveData shape unchanged. `eraResolvedSeeds`, `paletteItems`, `recipeCache`, `selectedSlots` keep their color fields. No version bump.

8. **Seeds — keep colors in `eras.json`.** The 136 hex values stay. The seed pool shape stays `{ name, tier, emoji, description, color, narrative, ... }`.

**Files.**
- `app/components/Bookplate.tsx` — switch stripe rendering to `chapterStripeColor(...)`
- `app/library/page.tsx` — same
- `app/vault/page.tsx` — same
- `src/main.ts` — replace stripe/binding hex reads with `chapterStripeColor(...)` from active theme; tile-face fill behavior per call-site decision
- `src/theme/chapterColor.ts` — already correct, no change
- (no schema, no API, no migration, no `src/types.ts`, no `src/save.ts`, no `src/eras.json`, no `src/prompts.json`, no `lib/server/vertex.ts` change)

**Verification.**
- No DB migration to run.
- Open DevTools, swap active theme via `setTheme(curatorStub)` (a manifest with a placeholder `bindingStripePalette`). Every library/vault stripe re-renders in the stub theme's palette without reload. (Validates the live re-skin contract before we even have a real second theme.)
- Bind a new tile, retire it later — DB row still has `tile_color` and `binding_stripe_color` populated, but the rendered stripe matches the active theme's palette, not the stored value.
- AI combine still returns a color; the new tile's stored color matches the AI's output, but the rendered stripe still matches the active theme.

**Effort.** Medium. Smaller than the original Phase C since storage and types are untouched. Mostly a localized sweep of the four render sites.

**Risk callout.** Existing players who reload post-deploy will see their bound tile stripes re-color (from bound-time AI color → active-theme palette resolution). Same one-line "we re-skinned your library" toast as before. The stored colors are still there if a future experiment wants them.

---

## Phase D — Curator theme

**Goal.** A second theme exists as a manifest + assets + motion variants. Toggleable via dev-only flag. Live-switching from Bibliophile to Curator visibly re-skins everything.

**Why fourth.** With the contract (A), the consumers (B), and the data (C) clean, adding a theme is genuinely a manifest exercise. Curator is also a stronger architecture test than Cartographer because its motion variants (vertical-pin clasp, pan-horizontal page turn, spotlight wipe) are entirely new.

**Concretely.**

1. **Curator manifest.** New `src/theme/curator/manifest.ts` filling the `Theme` shape with values from `curator-spec.md`:
   - Tokens: light archival cream / near-black / oxblood-only-at-run-end
   - Fonts: GT Sectra display + Söhne UI; tracked-caps UI rule
   - Textures: linen wallpaper / archival cream / matted black-on-white
   - Motion: `pan-horizontal` page turn / `vertical-pin` clasp / `frame-then-fill` ink-bloom / `spotlight-wipe` frontispiece
   - Chapter-color seed bank: 15 muted near-blacks / charcoals
   - Audio: brass-on-marble timbres throughout (still procedural; Phase F+ may swap to samples)
   - Copy: "Collection" / "Gallery" / "Deaccession" voice substitutions
   - One-shot Bari speech: the Curator variant from spec §6

2. **Curator tokens.css.** New `src/theme/curator/tokens.css` mapping abstract color tokens to Curator's swatches. Identical structure to bibliophile's tokens.css, different values.

3. **Motion variants — new flavors.**
   - `src/motion/brass-clasp.ts`: add `direction: "horizontal" | "vertical"` option. Vertical = top + bottom rect descend/rise from outside (the original implementation we just removed in D26 — restore as the Curator/Cartographer variant). Bibliophile sticks with horizontal.
   - `src/motion/page-turn.ts`: add `type: "peel-2d" | "pan-horizontal"` option. Pan = horizontal slide of the surface, no peel. Same 700ms.
   - `src/motion/brush-wipe.ts`: add `type: "brush" | "spotlight"` option. Spotlight = elliptical alpha mask sweeps left-to-right over the same 1400ms.
   - `src/motion/ink-bloom.ts`: add `type: "fill-expand" | "frame-then-fill"` option. Frame = outline draws first (200ms), interior fades in (400ms).
   - `main.ts` call sites: read the active theme's `motion.<discriminator>` and pass to the primitive.

4. **Curator assets.**
   - `public/themes/curator/patterns/{linen,archival,mat-board}.svg` — at least linen + archival.
   - `public/themes/curator/audio/` — empty for v1; procedural bus stays.
   - `public/themes/curator/bari/` — empty for v1 per D25.
   - `app/layout.tsx`: font loader needs to handle Curator's GT Sectra + Söhne. Probably a fallback chain since GT Sectra is licensed.

5. **Dev-flag toggle.** Add a debug-console action: "Switch theme → bibliophile / curator / cartographer." Not exposed in production. Persists nothing — just calls `setTheme()`. This is the rough edge that Phase F polishes.

6. **Run-end seal — Curator's brass plaque.** The wax-stamp gradient in skin.css hardcodes a red wax look. Move the gradient stops into a token (`--seal-fill`, `--seal-engrave`) and Curator's tokens.css overrides to brushed-brass values. Same shape, same animation, different material.

**Files.**
- New: `src/theme/curator/manifest.ts`, `tokens.css`
- New: `public/themes/curator/patterns/*.svg`
- Modified: motion primitives (4 files) — variant dispatch
- Modified: `main.ts` — pass `getTheme().motion.<type>` to primitives at call sites
- Modified: `app/layout.tsx` — font URL respects active theme's fonts
- Modified: `src/theme/index.ts` — register curator
- Modified: skin.css — move bibliophile-specific `body` selector under `[data-theme="bibliophile"]` (already done) and add Curator-only rules under `[data-theme="curator"]` (the few cases where token values aren't enough — e.g., italic-vs-regular display style)

**Verification.**
- Open DevTools console: `setTheme(curator)`. Game flips to Curator immediately. No reload. Tiles in the library re-paint with Curator's chapter-color palette (because Phase C made render-time resolution correct).
- Bind a tile in Curator: vertical-pin clasp animates correctly; era summary uses spotlight wipe.
- Play through three chapters in Curator. No regressions (mechanics unchanged), no missing assets, no font fallback.
- Switch back to Bibliophile mid-run. State preserved; visuals re-skin.

**Effort.** Medium. Manifest + tokens.css are small; motion variants and font loading are the bulk. Asset sourcing is external (commission or CC0 sweep).

---

## Phase E — Cartographer theme

**Goal.** Same as D, with Cartographer specifics.

**Concretely.** Mirror Phase D structure with Cartographer values from `cartographer-spec.md`. Notable differences from Curator:
- Two accent colors (compass copper + ocean teal); the rest of the system already supports `accent` + `accent-secondary`.
- Mono UI font; the `--ui-case-rule` is `sentence-case-with-mono-comments`. The "// the journal" prefix style needs CSS to render comment-prefixes — Cartographer's tokens.css declares a `::before` content rule scoped to `[data-theme="cartographer"] [data-mono-prefix]` or similar; main.ts adds the data attribute to the relevant labels.
- Page-turn `fold-3d` variant is the most expensive new motion — a CSS 3D rotateY with a thin shadow under the leading edge. Plan ~half a day.
- Ink-wash frontispiece reveal — radial gradient expanding from a corner. Cheap.
- Push-pin clasp is a single descending pin (not a pair) — *another* clasp variant, or reuse `vertical-pin` with a `count: 1` option.
- Italic Garamond display style — the `--font-display-style: italic` token applied to display headers; same rule mechanism as Curator's all-caps-tracked.
- Wax seal stays red but engraves a compass rose instead of an "A" — `--seal-engrave-symbol` token? Or a per-theme SVG asset path. Asset path is cleaner.
- Ship's-bell SFX with tremolo — procedural bus needs a per-theme variant of the cathedral-bell synth. Add `playRunEndBell()` that branches on `getTheme().audio.themed.runSealed`.
- "Atlas" library variant deferred to v1.1 per `cartographer-spec.md §9`.

**Files.** Mirror Phase D structure, scoped to `cartographer/`.

**Verification.** Same checklist as D, with Cartographer specifics. Particular focus: 3D fold page-turn doesn't break on Safari (SVG 3D is a known weak spot); mono UI labels render correctly with the prefix convention.

**Effort.** Medium. Slightly more than Curator because of the 3D page-turn and the mono-prefix rendering convention.

---

## Phase F — Theme switcher

**Goal.** Players can switch themes from the Settings drawer. Choice persists across sessions for authed users (DB) and anon users (localStorage). SSR renders the player's chosen theme on first paint, no flash.

**Why sixth.** Needs A–E to be useful. Without C, switching wouldn't re-color stored tiles. Without D/E, there's nothing to switch to.

**Concretely.**

1. **Schema migration — user.theme_preference.**
   - `drizzle/0007_user_theme_preference.sql`: `ALTER TABLE "user" ADD COLUMN theme_preference text NOT NULL DEFAULT 'bibliophile'`.
   - Constraint: `CHECK (theme_preference IN ('bibliophile', 'curator', 'cartographer'))` — or trust application-layer validation.

2. **API + settings store.**
   - `app/api/settings/route.ts`: PUT accepts `{ themePreference }`; GET includes it in the response.
   - `src/settings.ts`: add `themePreference` to the settings store; localStorage key `bibliophile-theme-preference`.
   - `src/theme/index.ts`: a new `initThemeFromSettings()` reads the active player's preference and calls `setTheme()` once on game mount.

3. **Settings drawer — Appearance section.**
   - `src/main.ts` settings drawer markup gains an "APPEARANCE" group with three radio cards: Bibliophile / Curator / Cartographer. Each card shows a small thumbnail (4-color palette swatch + display-font sample). Tap → setSetting → setTheme → save.
   - Switching is instantaneous (per architecture §6 "no confirm, no transition; the next frame renders in the new theme"). No reload.

4. **SSR-safe initial paint.**
   - `app/layout.tsx`: read theme preference from cookie (or fallback to default `bibliophile`) and render `<html data-theme={preference}>` on the server. Clients with no cookie see Bibliophile first paint, then the client-side `initSettings()` may flip to a different value if the user's localStorage has one — accept that flicker for first visits, OR set a cookie alongside localStorage to make subsequent visits flicker-free.
   - Font loader: the `<link>` URL is built from `getThemeForName(preference).fonts.*`. Server-rendered into the HTML head.

5. **Discoverability gate.** Per architecture §8 open question: "alternative themes need at least one moment of discoverability — surface theme options gently after run 3, not before." Implementation: track run count in localStorage; the Appearance row in settings is grey-and-locked-with-tooltip until the third run completes. Defer this gate if it adds friction; ship the switcher unlocked from the start and revisit.

6. **Theme decision log.** Update `bibliophile-decisions.md` with D27 — "themes are user-level preferences with database + localStorage persistence; bibliophile is the default."

**Files.**
- `drizzle/0007_user_theme_preference.sql`
- `src/db/schema.ts` — add column
- `app/api/settings/route.ts` — new field on PUT/GET
- `src/settings.ts` — store + persistence
- `src/theme/index.ts` — `initThemeFromSettings()`
- `src/main.ts` — settings drawer markup + handlers
- `app/layout.tsx` — SSR theme root + cookie read
- `app/middleware.ts` (new, if needed) — set the theme cookie from the user's session
- `docs/design/bibliophile-decisions.md` — D27

**Verification.**
- Sign in. Set theme to Curator in Settings. Reload. Game renders in Curator on first paint, no flash.
- Sign out. Settings drawer still works (anon localStorage fallback).
- Open the same account in two tabs. Change theme in one — the other re-renders on next interaction (settings store is local but DB persistence makes the *next* session match).
- Mid-run switch: per architecture §6, an in-flight bind ceremony finishes in its starting theme; the next animation uses the new theme. Verify by holding a tile mid-bind and switching themes — the clasp plays with the original variant.

**Effort.** Small to medium. Most of the work is plumbing; the schema migration and SSR cookie are the only fiddly bits.

---

## Phase G — Live re-skin testing

**Goal.** Confirm end-to-end that themes are interchangeable. No surprises in the shipped game when a player flips themes.

**Why last.** Verification, not implementation. Comes after F so a real player workflow exists.

**Concretely.**

A scripted manual playthrough covering the audit's "what would not update on switch" matrix:

1. **Cold start in each theme.** Three runs from a clean localStorage, one per theme. Confirm onboarding overlay, play screen, bind ceremony, era summary, library, retirement (force a 25th bind), vault, run end, all render correctly.

2. **Mid-run theme switching.** Start a Bibliophile run. Bind chapter I. Switch to Curator. Continue to chapter II — bind a tile, watch the Curator clasp animate. Switch back to Bibliophile mid-bind. Verify the in-flight ceremony completes in Bibliophile, the next chapter starts in Bibliophile.

3. **Mixed-theme library.** Play three runs across three themes, binding distinct tiles each. Then switch through themes and confirm each tile in the library re-skins to the active theme — every tile shows that theme's chapter-color palette, its frame style, its placard.

4. **Vault across themes.** Retire some tiles in Bibliophile, some in Cartographer. View the vault in Curator — every spine renders with Curator's near-black mat colors, regardless of bind-time theme.

5. **Reduced-motion + theme.** Enable reduced motion. Each theme should fall back to its reduced-motion variants (already implemented across the board).

6. **High-contrast + theme.** Bibliophile has a high-contrast variant. Curator and Cartographer don't yet. Either ship high-contrast for all three (small Phase G amendment) or scope it to bibliophile-only and surface that limitation in the Appearance settings.

7. **SSR first paint.** Visit `/library` cold from a deep link. Confirm the first paint matches the user's preference (no Bibliophile flash for a Curator user).

8. **Persistence across devices.** Sign in on two browsers. Set theme on one. Sign in on the other. Settings load. Theme matches.

9. **Audit-report regression check.** Re-grep for hex literals in `src/`. Should be limited to manifests, tokens.css, eras.json (or removed in Phase C), and debug-only surfaces.

**Files.** None. Bug fixes during this phase are filed against earlier phases.

**Verification artifact.** Update `docs/design/audit-report.md` with a "post-migration verification" section. Each open-as-of-pre-migration finding either: resolved (cite phase + commit), still open with a recorded reason, or pushed to v1.1.

**Effort.** Small. Manual playthrough; perhaps half a day of bug-bashing.

---

## Out of scope (defer to v1.1+)

- **Painted Bari art** — D25 defers indefinitely.
- **Approval-nod pose dispatch** — D25-adjacent. Adding it without painted art would be CSS-only on the emoji composite; reasonable to bundle with whichever phase touches main.ts post-migration if energy permits.
- **5-second cold open for returning players** — audit §1 surface-level gap. Not theme-coupled; a separate Phase 9 of the bibliophile spec.
- **Onboarding 90s pacing arc** — audit §4.3. Same.
- **Cartographer atlas variant library** — `cartographer-spec.md §9` defers explicitly to v1.1.
- **Curator gallery linear-wall layout** — `curator-spec.md §9` defers explicitly to v1.1.
- **Sourced audio samples** — themes still use the procedural Web Audio bus. Each theme's audio variants are *theoretical* (the manifest declares paths) until D14 resolves with a sample-vs-synth decision.
- **Theme unlocks gated by progress** — architecture spec §8 "all available from start." Confirmed.
- **Narrative-voice theming** — architecture spec §8 open question. Currently style-only; revisit if the difference between themes feels insufficient.

---

## Verification across the whole migration

Beyond phase-specific checks:

1. **TypeScript build.** `npx tsc --noEmit` clean after every phase.
2. **Production build.** `rm -rf .next && npm run build` clean after every phase.
3. **Hex literal grep.** `grep -rE "#[0-9a-fA-F]{6}" src/ app/ --include="*.{ts,tsx}"` should return ~zero hits in Bibliophile non-manifest **render** code by end of Phase C. Allowed survivors: manifest, tokens.css, eras.json, AI prompts, save data, DB layer (preserved for future-experiment per Phase C).
4. **Dead-asset check.** No `url(/themes/<theme>/...)` reference points at a missing file by end of Phase E.
5. **Manifest consumption check.** Every field declared in `Theme` interface has at least one consumer. CI-able grep.
6. **Live re-skin smoke test.** Open DevTools, run `setTheme(curator); setTheme(bibliophile); setTheme(cartographer)` in sequence. No errors, no broken renders, no animation glitches.
7. **Regression check vs. shipped Bibliophile.** Pixel-compare key surfaces (play screen, bind, era summary, library) between pre-Phase-A and post-Phase-G. Bibliophile must be visually identical.

---

## Order rationale

Why A → B → C → D → E → F → G:

- A before B because consumers can't read tokens that aren't declared.
- B before C because the render-path bypass in C is easier on top of an already-tokenized chrome — fewer surprises.
- C before D because Curator's chapter-color palette is meaningless if the renderer keeps reading bind-time hex from `binding_stripe_color` instead of the active theme's `bindingStripePalette`.
- D before E because Curator is a stronger architecture test (its motion variants are more aggressive) — if Curator works, Cartographer's mostly value-swaps from there.
- F after D and E because the switcher has nothing to switch to without them.
- G last because it verifies the whole thing.

The biggest re-orderable choice is C↔D. Doing D before C lets us see Curator first as a proof of life — but every existing bound tile would render with bind-time hex, not Curator's palette, which would feel broken. Better to keep C before D and accept the longer wait for the first visible second-theme moment.

---

*End of plan. Save to `docs/design/migration-plan.md` once approved.*
