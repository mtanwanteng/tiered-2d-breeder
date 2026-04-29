# Bibliophile — Implementation Decisions Log

> A running log of (a) decisions Claude made or proposed while implementing the Bibliophile direction and (b) edits to `bibliophile-spec.md`. The point of this file is to keep clear what the **user** decided vs. what **Claude** decided so the spec doesn't accumulate drift.

**Ownership convention:**
- **[USER]** — the user explicitly decided this.
- **[CLAUDE-PROPOSED]** — Claude is recommending this; the user has not signed off. **Default to "treat as a question."**
- **[CLAUDE-DECIDED]** — Claude made a low-risk implementation call without waiting (e.g. variable naming, file location, comment style). The user can reverse any of these at any time.
- **[OPEN]** — flagged for the user; no decision yet.

Entries are append-only. When a decision changes, **add a new entry that supersedes the old** rather than editing the original — the audit trail is more useful than a clean file.

---

## 2026-04-27

### D1. Add a "Data model and persistence" section to the spec
- **Status:** [USER]
- **Detail:** User explicitly requested adding this as section 11 of `bibliophile-spec.md`, citing Claude (web)'s observation that the spec doesn't currently cover data/storage and that capturing existing patterns will save future contributors guessing.
- **Action:** §11 was added to the spec in this same pass. The new section documents what the existing schema already supports (auth, run, bound tile, frontispiece, save state) and what the bibliophile features still need (library view, vault, retiredAt column, optional chapterIndex, settings storage, Bari speech-flag).
- **Spec edit:** Yes — new §11.

### D2. Create `bibliophile-decisions.md` (this file)
- **Status:** [USER]
- **Detail:** User explicitly requested a separate doc to track Claude's decisions and spec edits.
- **Action:** Created.
- **Spec edit:** No (this file lives alongside the spec).

### D3. Create `bibliophile-gap-analysis.md`
- **Status:** [USER]
- **Detail:** Primary deliverable for this pass — the document the user asked for.
- **Action:** Created.
- **Spec edit:** No.

### D4. Naming convention for the section 11 inside the spec
- **Status:** [CLAUDE-DECIDED]
- **Detail:** Section 11 is titled "Data model and persistence." Subsections follow the spec's existing `### Subhead` style. Tables use the same column conventions as elsewhere in the spec.
- **Reversible if:** The user prefers a different heading depth or structure.

### D5. The "Idea Collector" vs "Bari the Architect" naming question
- **Status:** [OPEN]
- **Question:** The spec's title is "Idea Collector — Bibliophile Design Specification." The product in code is "Bari the Architect" (README, `app/layout.tsx` metadata title), the PostHog super-property is `app: 'architect'`, and the marketing domain is `tiered.fun`. The branch name is `bibliophile-2026-04-27`.
- **Why this matters:** Affects: page metadata, social previews, OG share cards, PostHog event tagging, billing-style super-properties, in-game copy ("Bari the Architect" vs "Idea Collector" or some third name).
- **Why not decided:** Branding decision belongs to the user.
- **Until decided:** Engineering keeps both names available — code identifiers use `architect`, user-facing copy stays generic ("the workshop", "your library") wherever possible.

### D6. MIN_ERAS = 5 vs spec's eleven-chapter arc
- **Status:** [OPEN]
- **Question:** `era-manager.ts:6` declares `MIN_ERAS = 5`, which lets the AI-driven era selection skip eras and reach Space Age in as few as five chapters. The spec assumes eleven fixed chapters (the strip illustration shows eleven cubes; "the eleventh chapter's bind ceremony" triggers run end).
- **Two options:**
  1. Drop `MIN_ERAS` and force the full 11-chapter walk. Pro: matches spec exactly, makes the strip illustration accurate, makes 24-tile library math (24 / 11 = ~2 runs to fill) work as the spec implies. Con: longer required playthrough.
  2. Keep variable chapter count. Pro: shorter sessions possible. Con: spec needs revision (strip becomes variable-width, run-end bell triggers earlier than "eleventh").
- **Why not decided:** Game-design call. The spec was written with 11 chapters in mind; the code is currently more flexible. This is a design pacing question.

### D7. Multi-goal-per-era vs single objectives card
- **Status:** [USER] (resolved 2026-04-27)
- **Decision:** Keep the current dual-goal game design. Eras continue to run two parallel goals: deterministic `minTier=3` "Make a ⭐⭐⭐ Item" + AI-judged N-of-M conditions. Both must be satisfied to advance.
- **Implementation note:** The bibliophile objectives card needs to surface both tracks. Two viable UI treatments:
  1. **Stacked panels** — render the tier goal as a chapter-level badge ("This chapter requires a ⭐⭐⭐ idea") in the chapter title bar, with the AI conditions in the main objectives card below.
  2. **Combined list** — fold the tier goal into the same checklist alongside the AI conditions.
- **Recommendation:** Option 1 (stacked) — the tier goal is a different kind of constraint (mechanical floor) than the AI conditions (narrative milestones); separating them visually matches the player's mental model. The reference UI mock (`idea-collector-interface.png`) shows a simple 3-item checklist, which fits AI conditions only — the tier badge would live in the chapter header above.
- **Spec edit:** Yes — §3.2 (Play screen) updated to acknowledge dual-track goals.

### D8. Catalog cap of 3 (`MAX_DISCOVERED_SLOTS`)
- **Status:** [USER] (resolved 2026-04-27)
- **Decision:** Remove the +3 cap. Players should be able to access all of their discovered tiles. The original cap was a UI/UX concession for the previous edition's interface; the bibliophile direction designs the inventory (now "card catalog" / "idea tray") around scrollable browsing of the full discovered set.
- **Implementation note:** When implementing, also pick a layout that scales gracefully: the reference mock (`idea-collector-interface.png`) shows a horizontal-scroll **idea tray** at the bottom of the play screen rather than the spec's described 4-up grid. Either is workable — the tray reads as more chapter-end-ish, the grid reads as more catalog-ish. Worth deciding alongside the visual rebrand.
- **Spec edit:** No — the spec already says "the player's catalog grows with each new combination," which is consistent with this decision. The conflict was code-side only.
- **Code action:** Delete `MAX_DISCOVERED_SLOTS` and the trim-on-overflow branch in `addToPaletteIfNew` (`src/main.ts:2612-2622`). Replace with unbounded append.

### D9. Select-five mode disposition
- **Status:** [OPEN]
- **Question:** `selectFiveMode` is a separate experiment (`app/select-five/`). Bibliophile spec doesn't mention it.
- **Why not decided:** Whether to keep, reskin, or retire is a product call.

### D10. "Tile persists" interpretation in spec §2.1
- **Status:** [OPEN]
- **Question:** Spec §2.1 says "**Source tiles persist by default.** Combining doesn't consume them — the player's catalog grows with each new combination." Two possible readings:
  1. **Strict:** Both *workspace instances* persist after a successful combine (so dragging Fire+Wood produces Torch, and you still have Fire and Wood on the workspace afterward). This is a major mechanical change.
  2. **Loose:** Both *palette entries* persist. The workspace tiles vanish (consumed by the combine) but Fire and Wood are still in the palette to drag again. This matches current code.
- **Current code:** `combine()` calls `removeItem(a)` and `removeItem(b)` for the workspace tiles. Palette is untouched.
- **Why this matters:** A strict reading changes the entire feel of the workspace — it becomes a multi-step shape rather than a single combine. Spec's surrounding language ("the player's catalog grows") favors the loose reading, but "source tiles persist" is unusually strong wording.
- **Until decided:** Treating as **loose** for engineering purposes; the workspace remains a transient combine surface, the palette is the persistent catalog.

### D11. Engineering keeps `era` as the term; `chapter` is user-facing copy
- **Status:** [CLAUDE-PROPOSED]
- **Detail:** The codebase is heavily era-centric (`era-manager.ts`, `eraActionLog`, `eraHistory`, `EraGoal`, the `era_idea_tile` table, `/api/check-era`, `/api/choose-era`). Renaming `era` → `chapter` everywhere is a large mechanical refactor with PR-review cost and DB-migration cost (table renames). All it buys is engineer-vocabulary alignment with the spec.
- **Recommendation:** Keep `era` as the engineering term. Surface "Chapter [roman]" in **all user-visible copy** (era display, strip cubes, library bookplates, era summary). Treat the spec's "chapter" as a UI-layer term.
- **Reversible if:** The user wants the rename for clarity.

### D12. `era_idea_tile` table stays; rename deferred
- **Status:** [CLAUDE-PROPOSED]
- **Detail:** The `era_idea_tile` table cleanly maps to the spec's "bound tile." Renaming to `bound_tile` is a Drizzle migration plus rebinding all consumers. It would be cosmetic only.
- **Recommendation:** Keep the table name. Add `retiredAt timestamp NULL` and (optionally) `chapter_index integer` columns when the library/vault feature lands. A comment block on the table explains the spec mapping.
- **Reversible if:** The user wants the rename.

### D13. Vault and library are derived views, not new tables
- **Status:** [CLAUDE-PROPOSED]
- **Detail:** Library = `SELECT … FROM era_idea_tile WHERE owner = ? AND retired_at IS NULL ORDER BY created_at DESC LIMIT 24`. Vault = `… WHERE retired_at IS NOT NULL ORDER BY retired_at DESC`. No new tables required; only one new column.
- **Why this is the right call:** Spec's engineering note already says retired tile data should persist server-side (for future multiplayer). A retiredAt column + the existing tile-data columns satisfy that exactly. Adding a separate `vault_entry` table would duplicate the data.
- **Reversible if:** The user prefers separate tables for clarity (e.g. `library_entry` view + `vault_entry` view).

### D14. Audio layer choice: Web Audio API vs HTMLAudioElement
- **Status:** [OPEN]
- **Question:** The spec requires sustained cello, sample-accurate hold-arc sync (the cello's 2.5s phrase = the hold duration), loudness rules at specific LUFS values, and a singing-bowl that resolves on commit. `<audio>` is simple but bad at sample-accurate cue-up and cross-fading; Web Audio API is the right shape but adds complexity.
- **Recommendation when decided:** Web Audio API for the cello/clasp/bell (P1 + P2 cues that need timing precision), `<audio>` for ambient room tone (which is just a long loop). Mix bus to enforce LUFS rules.
- **Why not decided:** Pre-implementation; user may want to scope audio out of the first cut entirely.

### D15. Frontispiece reveal — embedded in era summary, not standalone modal
- **Status:** [CLAUDE-PROPOSED]
- **Detail:** Currently the tapestry shows in `#tapestry-overlay` **after** the era-summary panel is dismissed. The spec wants the frontispiece embedded in the era-summary spread itself, brush-wipe-revealed inline, with narrative typing in below it.
- **Why this is the right call:** The spec's flow is `bind → page-turn → spread arrives → frontispiece brush-wipes → narrative scratches in → manual continue`. Today's flow is `bind-equivalent → era-summary panel (instant) → click continue → tapestry overlay (after 2s spinner) → click close → next era`. Two extra clicks and a context switch.
- **Implementation note:** The `tapestryPromise` already starts in parallel during the era-advancement pipeline (`runAdvancementPipeline`, `src/main.ts:2017`); embedding it just means awaiting the same promise from inside `era-summary-panel` rather than a sibling overlay.

### D16. PostHog `app` super-property — deferred rename
- **Status:** [CLAUDE-DECIDED]
- **Detail:** All server-side PostHog events tag `app: 'architect'`. The product was previously rebranded `breeder → architect` in commit `171f97c`. Renaming again to `bibliophile` (or whatever the eventual product name is) breaks dashboards.
- **Decision:** Don't touch the PostHog `app` property in this rebrand pass. When the user finalizes the product name (D5), do a single rename then.
- **Reversible if:** The user wants analytics to mirror the visual rebrand immediately.

### D17. Branch metadata
- **Status:** [CLAUDE-PROPOSED] (revised 2026-04-27)
- **Question raised by user:** Are sub-branches more effective for Claude coding?
- **Honest assessment:**
  - **Sub-branches help** when work-streams (a) touch disjoint files, (b) have independent acceptance criteria, (c) want to be reviewed/merged piece by piece, or (d) might need to be partially reverted.
  - **Sub-branches hurt** when (a) multiple work-streams touch the same files (CSS, `src/main.ts`), (b) the work is exploratory and integration matters more than partition, (c) the team is small and PR-management overhead exceeds review value.
  - **For this rebrand specifically:** the visual rebrand (CSS) collides head-on with the hold-to-commit primitive build, the strip refit, the era-summary refit, and the onboarding sequence — all of those touch `src/style.css` and `src/main.ts`. A literal sub-branch per work-stream would create constant merge conflicts.
- **Recommendation:** Hybrid approach.
  - **Long-running `bibliophile-*` rebrand branch** is the trunk for this direction. All visual + interaction work merges into it.
  - **Spawn sub-branches only for genuinely independent work**, primarily:
    1. **DB migrations** (`bibliophile-migration-retirement`, etc.) — must ship independently, and Drizzle has hard ordering requirements.
    2. **Audio asset pipeline** (`bibliophile-audio`) — no overlap with visual code; can land at any time.
    3. **New API routes** (`bibliophile-library-api`, `bibliophile-vault-api`) — touch `app/api/` and `src/db/`, no CSS conflict.
    4. **Single, large, isolatable features** — the Library page, the Vault page, the onboarding sequence — each can be its own sub-branch off the rebrand trunk if they get big enough to warrant scoped review.
  - **Don't sub-branch:** the visual rebrand, the strip refit, the bind ceremony refit, the era-summary refit, Bari's pose system. Those all share the visual layer and should land together or near-together.
- **For Claude Code specifically:** Claude works best when (a) the task scope is local and self-contained, (b) the relevant files are co-located. Sub-branches help when the task description includes a clear list of files to touch and explicit non-goals. They hurt when Claude has to reason about how to split monolithic feature work across boundaries.
- **Until decided:** Continue on the single rebrand branch. The user can spawn sub-branches at any time without losing work.

---

### D18. Visual style scope — `idea-collector-front.png` and `idea-collector-interface.png`
- **Status:** [CLAUDE-PROPOSED] (analysis pass 2026-04-27)
- **Context:** User asked whether the watercolor / illustrated-manuscript style shown in these reference mocks is outside Claude's capability scope.

**What the mocks add to the spec:**

The two PNGs are richer references than the existing SVG illustrations in the spec:
- **`idea-collector-front.png`** — title screen with painted watercolor library interior (perspective-down-aisle bookshelves with a small figure at the back), aged parchment background, decorative floral corner ornaments, large serif "IDEA COLLECTOR" title, tagline "Every idea is a story. Every story builds a civilization.", "TAP TO BEGIN" button.
- **`idea-collector-interface.png`** — three-section spec sheet: (1) initial gameplay state with chapter header "Chapter III · Bronze Age" subtitled "Craft · Survival", a side goals panel ("Build a city / Forge alloy / Write laws"), workspace with "Place two ideas here to combine" prompt, and a horizontal-scroll **idea tray** at the bottom; (2) eight-frame core interaction flow including a **wax-seal combine animation** ("Ink shoots between the cards and the seal is pressed" → "A new discovery rises from beneath the seal"); (3) eight-state catalogue including invalid drop (shake), AI thinking states with copy that "evolves if it takes longer," tier-3+ prominent reveal, goal-completed ink mark, tray scroll.

**Capability scope — what's in Claude's reach:**

| Element | In scope for Claude alone | Notes |
|---|---|---|
| Layout (chapter header, goals panel, workspace, idea tray) | ✅ Yes | HTML/CSS — straightforward port. |
| Cardo + Inter web fonts | ✅ Yes | Standard Google Fonts integration. |
| Parchment / vellum / leather textures | 🟡 Partially | Procedural SVG + CSS gradients + filter:turbulence noise can hit ~80% fidelity. The handful of asset-quality textures (true watercolor parchment) need to be sourced or generated. |
| Floral corner ornaments | 🟡 Partially | Public-domain manuscript scrollwork is widely available CC0 (e.g. Library of Congress, NYPL Digital Collections). Claude can integrate; sourcing is a small content task. |
| Wax-seal combine animation | ✅ Yes | SVG + CSS keyframes — the seal scale-in (1.4 → 1.0 with overshoot) is already in the spec's motion language ("Wax stamp"). |
| Tile cards with emoji + italic serif name | ✅ Yes | Pure CSS reskin of existing `.combine-item` / `.palette-item`. |
| Eight interaction frames (drop, drag, hover, combine, discovery reveal, release) | ✅ Yes | All standard pointer-event flows already wired in `src/main.ts`. The reskin is animation timing + visual polish. |
| Eight state catalogue (empty, invalid, AI-thinking-evolving, tier-3+ prominent, goal-ink-marked, tray scroll) | ✅ Yes | All implementable with CSS classes + state-driven copy. |
| Hold-to-commit gesture, hold-arc, cello-driven timing | ✅ Yes | The spec already specifies the timing precisely; Claude just builds it. |
| Audio (cello, wax click, paper rustle, cathedral bell) | ✅ Yes for the playback layer | Web Audio API + asset registry. **Sourcing the audio assets** is the spec's job (it already lists CC0/CC-BY references in §7); Claude wires them up. |

**Capability scope — what is _not_ in Claude's reach without help:**

| Element | Why out of scope | Path forward |
|---|---|---|
| **Painted watercolor library interior** (title screen perspective scene) | Requires illustration craft. Claude can describe and request, not paint. | (a) AI image generation — the project **already uses Vertex AI's Imagen/Gemini Flash Image** to generate watercolor frontispieces (`/api/generate-tapestry`); the same pipeline can generate the title-screen art. (b) Commission an illustrator. (c) Use a public-domain manuscript engraving as a stand-in for v1. |
| **Bari character art** (Disney-storybook-painted target per spec §5) | Same — illustration craft. | Same three options. The current implementation uses an emoji placeholder (👦 + 🔨); the spec acknowledges placeholder status. |
| **Per-tile painted artwork** (if you ever want to replace emoji with painted icons) | Would require ~300+ illustrations per era × 11 eras. Definitely out of solo-Claude scope. | Stay on emoji for v1. The spec's "bookplate frame is the universal tile motif" already accommodates emoji + frame approach. |
| **High-quality painted parchment textures** (the absolute best 5%) | Procedural ones get ~80% there; the last 20% needs hand-painted asset work. | Use sourced CC0 textures (manuscript scans from public archives) or generate via Imagen. Worth doing **once** and reusing as a CSS background-image. |
| **Floral border ornaments at production polish** | Same — sourced asset work. | Public domain. Free. |

**Bottom line:**

The visual style is **not** outside Claude's capability scope. The **layout, interactions, motion, audio playback, data, accessibility, and ~80% of the visual chrome** are all directly buildable in code. The remaining ~20% is **asset sourcing or generation** — for which the project already has a working AI-image pipeline (Vertex AI / Imagen), so even that is mechanically in reach.

**Practical workflow for the painted assets:**

1. **Title-screen library scene** — write a prompt for Imagen describing "watercolor manuscript illustration of a perspective view down a library aisle, aged parchment palette, sepia + warm gold, no people / one small figure at the back, no text." Generate, pick best, store as `/public/title-library.png` or `.webp`. Reuse forever.
2. **Frontispieces** — already work (existing pipeline).
3. **Bari art** — same Imagen prompt approach for each pose; or commission. Either way: **Claude can wire the asset; it can't paint it.**
4. **Corner ornaments / page borders** — sourced from public domain manuscript scans.
5. **Parchment texture background** — generate one tileable seamless image (CSS `background-image: url(parchment.webp); background-size: 400px 400px;`).

This is the same separation the spec already implies in §5 ("Final art should be illustrated/painted, not vector. The wireframe SVGs in our prototype are placeholders for a Disney-storybook-painted target"). The current project's existing reliance on Vertex AI for tapestry generation is **the precedent for handling this exact gap**.

- **Spec edit:** Optional — the spec already acknowledges placeholder vs. final-art separation in §5 and §6. A new short subsection in §1 (Identity) listing "asset sourcing strategy" might be worth adding when the user wants to lock down the workflow.

---

### D19. Chapter-theme tag added to spec §3.2
- **Status:** [USER] (resolved 2026-04-27)
- **Decision:** Each chapter shows a 2–3-word italic tag beneath the era name in the title bar (e.g. "Craft · Survival" for Bronze Age). Pulled from `idea-collector-interface.png`.
- **Spec edit:** Yes — §3.2 "Layout" point 1 updated; new "Chapter-theme tags" subsection added with the full Bibliophile-theme tag table for all 11 chapters. Tags are theme-manifest content (per §1 "Theme architecture").
- **Tag list (Bibliophile theme, starting points):** Stone *Survive · Discover*, Bronze *Craft · Survival*, Iron *Tools · Order*, Classical *Reason · Empire*, Medieval *Faith · Stone*, Renaissance *Inquiry · Beauty*, Exploration *Horizon · Trade*, Industrial *Steam · Iron*, Modern *Power · Nation*, Information *Signal · Code*, Space *Lift · Wonder*. Copy review can refine.
- **Engineering note:** When implementing, surface this through the theme manifest (`themes/bibliophile/manifest.ts`) keyed by era name or order index — **not** hardcoded in `eras.json`. `eras.json` stays theme-agnostic; the tag is presentation, not mechanic.

### D20. Horizontal idea tray adopted as primary mobile inventory layout
- **Status:** [USER] (resolved 2026-04-27)
- **Decision:** On mobile, the inventory renders as a horizontal-scrolling **idea tray** at the bottom of the play screen (matching `idea-collector-interface.png`). On desktop, it stays as a 4-up grid in a side pane.
- **Spec edit:** Yes — §3.2 "Layout" point 4 rewritten to specify both layouts and the breakpoint that switches between them (`min-width: 720px` suggested grid threshold). Strip stacking order also clarified: above the tray on mobile, below the workspace on desktop.
- **Engineering note:** Use a `@container` query if the idea-tray module is reused in nested contexts (e.g. bind ceremony's "eight chapter pieces" sub-grid); otherwise a plain `@media` query is fine.

### D20.b. Desktop layout revised — single horizontal tray + Card Catalog modal
- **Status:** [USER] (resolved 2026-04-27, supersedes D20 desktop wording)
- **Question raised by user:** Is there space to keep the grid comfortably on desktop?
- **Honest math (1440×900 desktop, ~780px after browser chrome):**
  - Chapter title bar (era + theme tag + tier badge): ~50px
  - Objectives card (4 items + header): ~120px
  - Workspace minimum (tile-on-tile drag needs room to breathe): ~360px
  - Strip (kept-tiles row): ~44px
  - Margins / borders / Bari: ~30px
  - **Remaining for inventory: ~140-180px** — enough for one row of bookplate cards (~110-130px tall with comfortable padding), not for a multi-row grid.
  - A right-sidebar grid recovers the vertical budget but eats horizontal workspace and feels like the "previous edition" sidebar layout that the bibliophile direction is moving away from.
- **Decision:** Drop the desktop 4-up grid. Use the **horizontal tray everywhere**. Add a **"Card Catalog →"** button on the tray that opens a full-screen vellum modal with the full grid (4-up at narrow desktop, 6-up at wide), filter/search, and per-tile bookplate detail.
- **Why this is better than the original D20 wording:**
  - One layout across breakpoints — no flip-on-resize.
  - Matches `idea-collector-interface.png` on every screen size.
  - Workspace keeps its full horizontal budget on desktop.
  - Scales when catalogs get very long (run-5+ players will easily have 50+ tiles, more than any in-line grid can comfortably display).
- **Spec edit:** Yes — §3.2 "Layout" point 4 rewritten to single-layout + catalog modal; explicit "Why one layout" rationale paragraph added after the layout list.
- **Engineering note:** The Card Catalog modal reuses the bookplate-peek component (already needed for strip-tile peek and bind ceremony peek per spec §3.2 and §4). Build that one component once, surface it in three places.

### D21. AI-thinking message-evolves pattern added to spec
- **Status:** [USER] (resolved 2026-04-27)
- **Decision:** During AI combine calls, the placeholder/toast text **evolves** if the call takes longer than expected, rather than showing a static spinner. Pulled from the "AI THINKING (Start)" / "AI THINKING (Longer)" frames in `idea-collector-interface.png`.
- **Spec edit:** Yes — §3.2 "Combine feedback" subsection added with the four-phase copy table (Start / Longer / Long / Failed) and thresholds (+0s, +2.5s, +6s). §6 motion language gains an "AI-thinking copy swap" primitive (280ms crossfade). §5 Bari pose triggers updated: Wonder/leaning-in fires at the *Longer* threshold, Patient/waiting fires at *Long*.
- **Why:** Reduces perceived latency, gives the player a sense that the AI is "thinking deeply" rather than stalling, lets the theme's voice register breathe through.
- **Theme-agnostic; copy is theme-specific.** The thresholds and motion are spec-level invariants; the actual phrases ("Reading the margins…", etc.) live in the theme manifest.
- **Engineering note:** Replace the current static `showToast(\`${a.name} + ${b.name} = ...thinking...\`)` (`src/main.ts:1870`) with a phase machine that swaps copy at the thresholds. The combine API call promise drives state transitions; on resolution, the toast/narrative card replaces the AI-thinking text via the existing combine-resolve flow.

### D22. Theme architecture (swappable visual identity) added to spec §1
- **Status:** [USER] (resolved 2026-04-27)
- **User intent:** Set the system up so we can swap to richer graphics later, with thematic swaps as a first-class concept.
- **Decision:** Added a new "Theme architecture" subsection to §1 (Identity) defining the theme contract — what a theme owns (color tokens, typography, pattern textures, decorative chrome, character art, title-screen art, per-chapter framing, audio cues, copy register, motion overrides) and how it loads (a `tokens.css` file scoped under `[data-theme="<name>"]` plus a `manifest.ts` exporting a typed `Theme` object).
- **Invariant:** Layout, interactions, motion primitives, data model, accessibility are **theme-agnostic**. Themes are skin + assets + copy. This is the firm contract — if a future theme can't be expressed inside it, the abstraction is wrong and the spec needs revision before that theme ships.
- **Spec edit:** Yes — new subsection in §1.
- **Provisional second themes** (mentioned in spec as abstraction validation, not roadmap commitments): *Painted Manuscript*, *Cartographer's Codex*, *Modernist Edition*.
- **Engineering implementation outline (for whoever picks this up first):**
  ```
  themes/
    bibliophile/
      tokens.css          // [data-theme="bibliophile"] { --ink-black: #2a1f15; ... }
      manifest.ts         // export const bibliophile: Theme = { ... }
      patterns/
        marble.svg
        leather.svg
        parchment.png
      ornaments/
        corner-tl.svg
        ...
      bari/
        idle.png
        nod.png
        wonder.png
        patient.png
      audio/
        cello-g2.flac
        cello-c2.flac
        cathedral-bell.flac
        ...
  src/theme/
    Theme.ts              // shared type + loader
    useTheme.ts           // React hook to read current theme manifest
    index.ts              // current theme registration + switch fn
  ```
- **Defer:** `data-theme` switching at runtime is unnecessary in v1 (only Bibliophile exists). The abstraction's job today is to keep code from hard-coding asset paths or copy strings — flexibility for tomorrow, no UX cost today.

---

## Reserved for future entries

Future implementation passes should add entries below, dated and numbered (D23, D24, …).

### Template

```
### D{N}. {short title}
- **Status:** [USER | CLAUDE-PROPOSED | CLAUDE-DECIDED | OPEN]
- **Detail:** {what was decided and why}
- **Spec edit:** {Yes — section X | No}
- **Reversible if:** {what would change this}
```

---

### D23. Main menu — placement, ordering, visual treatment
- **Status:** CLAUDE-DECIDED (user prompted; specifics chosen by Claude per UX best-practices; reversible)
- **User ask:** "Change 'Restart Game' to Menu. Put Restart Game, Sign In, How-To-Play, Debug Menu, and Scoreboard inside that menu. Choose a thematic display, order with best UI/UX hat."

#### Placement
- **Top-right of the play screen, just left of the settings cog.** Replaces the previous `#restart-btn` slot (which was visually conspicuous and semantically narrow — only one of five things now folded in).
- Pairs visually with `#settings-btn`: Settings = persistent player preferences (cog, gilt outlined); Menu = session actions (italic Cardo "Menu" label, gilt italic underline-on-hover). Two distinct affordances, similar weight, predictable cluster.

#### Visual treatment — "ribbon-tab dropdown"
- **Trigger:** Italic Cardo word "Menu" in gilt on transparent background, leather-deep border, subtle gilt highlight on hover / when open. No icon — words read clearly to first-time players, and the bibliophile world is text-led.
- **Panel:** Parchment-on-leather dropdown, ~200px wide, anchors below-right of the trigger. Left edge has a thicker leather "spine" (4px border-left) — visually quotes a book's gathered binding. Slides in 180ms (transform + opacity) on open; collapses on outside-click, ESC, or item-click.
- **Items:** Italic Cardo, ink-black on parchment, gilt-tinted hover background. Destructive item (Restart) wears oxblood. Debug item wears uppercase Inter in muted marble — visually demoted (a dev-only affordance shouldn't compete with player-facing actions).
- **Hidden in production builds** (debug item only): gated by `NEXT_PUBLIC_VERCEL_ENV !== "production"`.

#### Ordering (top-to-bottom)
1. **Scoreboard** — most likely to be opened mid-run (peek progress, see prior chapters); cheap and read-only.
2. **How to Play** — second-most-likely; refresh on rules without leaving the run.
3. **Sign in / Sign out** — auth-state-aware label; auth modal opens via `authStore.openLogin`.
4. *(divider)*
5. **Restart game** — destructive, separated below the divider, oxblood-tinted to signal weight.
6. **Debug console** — uppercase Inter, muted marble, dev-only.

Reasoning: read-only and informational items at top → state-changing items below → destructive last. Divider visually separates "explore" from "commit" actions.

#### Implementation notes
- Standalone floating buttons that previously hosted each function are kept in the DOM (their event handlers stay bound) but visually hidden via CSS scoped to `[data-theme="bibliophile"]`:
  - `#restart-btn`, `#scoreboard-btn`, `#debug-toggle` → `display: none`
  - `.auth-overlay .auth-login-btn`, `.auth-user-chip`, `.htp-btn` → `display: none` (the popovers themselves stay)
- Menu items dispatch through:
  - `Scoreboard` → programmatic `.click()` on `#scoreboard-btn` (re-uses existing handler)
  - `How to Play` → `authStore.getState().openHowToPlay?.()` (new store callback registered by `auth-overlay.tsx`)
  - `Account` → `authStore.openLogin` / `authStore.signOut` based on `isLoggedIn`
  - `Restart` → existing `handleRestart()` (confirms then `clearSave()` + reload)
  - `Debug` → programmatic `.click()` on `#debug-toggle`
- The HTP popup is positioned under the now-hidden `.htp-btn`; CSS overrides the popup's anchor to `right: 12px; top: 56px` so it sits beneath the Menu trigger when invoked.

- **Spec edit:** Yes — Addendum A in §end of spec.
- **Reversible if:** Naming finalizes and we want to expose Sign In as a more prominent first-class affordance again (likely re-promotion as a top-bar action), or if we decide the Menu should also surface tapestry / library shortcuts (currently those are reached via the era-summary spread + dedicated routes).

---

### D24. Ink-bloom on tile arrival — replaced by 400ms scale pulse
- **Status:** CLAUDE-DECIDED, ratified by playtest; deviates from `bibliophile-spec.md` §6
- **Spec called for:** `scale 0 → 1, 600ms cubic-bezier(0.2, 0.8, 0.2, 1). Opacity 0 → 1 first 350ms.` Used for tile arrivals after a successful combine.
- **What shipped:** `.combine-item.merging` runs a 400ms `scale 1 → 1.2 → 1` ease-in-out pulse keyframe (`src/style.css:438-446`, applied in `src/main.ts` after the combine resolves). The dedicated `playInkBloom` primitive in `src/motion/ink-bloom.ts` is spec-correct but unused on tile arrivals.
- **Why we deviated:** the spec's scale-from-zero ink-bloom read as a "pop" that fought with the workspace caption's "From X and Y came Z" beat. The 400ms scale-pulse on a tile that's already at full size felt like "the new tile arrives and breathes," matching the contemplative pace of the rest of the game. The primary feedback the player needs is *that something landed* — the workspace caption already provides the *what*.
- **Detail to keep:** the unused `ink-bloom.ts` primitive remains in the motion library — it still matches the spec, and the ink-bloom-on-narrative-text use case (spec §6 also lists "narrative text, first appearances") may yet want it. Don't delete; just don't dispatch it on tile arrival.
- **Spec edit:** Yes — `bibliophile-spec.md` §6 should annotate ink-bloom: "Tile arrivals use the 400ms scale-pulse documented in D24; the 600ms primitive remains for first-appearance / narrative use cases."
- **Reversible if:** A future playtest pass thinks the scale-pulse is too quiet. The `playInkBloom` primitive is already wired and waiting; one call-site swap reinstates the spec timing.

---

### D25. Painted Bari art — deferred indefinitely
- **Status:** USER-DECIDED, not blocking
- **Detail:** The first Imagen pass for painted Bari poses (idle / nod / wonder / patient) didn't meet the bar. Rather than ship a worse-than-emoji placeholder or block on iterating the AI prompt, Bari stays as the emoji composite (`<span id="bari-char">👦</span><span id="bari-tool">🔨</span>`) for the foreseeable future.
- **What this affects:**
  - Spec §5 "approval nod" pose has no JS dispatch and no CSS class. A nod on strong combine / kept-tile bind / era end is not currently fired. Treat as deferred, not unintended.
  - The four PNG paths in `src/theme/bibliophile/manifest.ts:44-49` reference assets that don't exist on disk (`public/themes/bibliophile/bari/` is empty).
  - Spec §3.1 onboarding Frame 02 calls for "Bari fades in, lower-left margin" — rendered via the existing emoji Bari rather than a painted entrance.
  - Bari pose changes during AI-thinking phases (`bari--leaning`, `bari--patient`, `bari--very-patient` CSS classes) still fire, just on the emoji composite.
- **Spec edit:** No — leave the painted-art ambition in §5 as the design target, but capture this decision so future passes don't read the spec as "this is shipped" or "this is missing because nobody noticed."
- **Reversible if:** A re-pass of the Imagen prompt (or a commissioned painter) produces a Bari that meets the storybook bar. Re-enabling the painted assets is a per-pose CSS swap on the existing pose classes — the JS dispatch layer doesn't change. Adding the approval-nod is independent: a new `bari--nod` class in skin.css plus three call sites in `main.ts` (combine resolve at tier 5, tile bound, era end).

---

### D26. Brass clasp axis — horizontal, matching theming-architecture §3.4
- **Status:** CLAUDE-DECIDED (spec ambiguity disambiguated by architecture spec)
- **Detail:** The bibliophile-spec.md §6 entry for "Brass clasp" reads only *"Two rects slide ±20px"* without an axis. The original implementation used a vertical pair (top rect descending, bottom rect rising) for ~6 weeks. The architecture spec (`theming-architecture.md` §3.4) added later disambiguates: Bibliophile = `"horizontal-clasp"`, Curator and Cartographer = `"vertical-pin"`.
- **What shipped:** `src/motion/brass-clasp.ts` now slides a left-side rect (translateX -20 → 20) and a right-side rect (translateX 20 → -20), meeting at the target's vertical mid-line. Same 220ms duration, same `cubic-bezier(0.4, 0, 0.2, 1)` easing, same 1.0 → 1.12 → 1.0 tile pulse, same fade-out-and-remove tail. The visual semantic difference: clasps clamp the *sides* of the tile rather than the *top-and-bottom*.
- **Why now:** the audit pass surfaced the conflict, and the horizontal axis is the cheap test for "are we ready to support a real cross-theme bind-clasp dispatch?" If horizontal feels right for Bibliophile, Curator's vertical-pin variant (descending from above only) becomes the natural next addition: same primitive, new direction option.
- **Spec edit:** No new content — `bibliophile-spec.md` §6 is intentionally ambiguous on axis. The architecture spec is now the source of truth.
- **Reversible if:** Horizontal looks worse than vertical in playtest. Swap `translateX` back to `translateY` and the `left/right` anchor logic back to `top/bottom`. The 220ms / 1.12× / cubic-bezier numbers are settled either way.

---

## 2026-04-29

### D27. Theme-system migration shipped — Phases A–F + motion variants + placeholder textures
- **Status:** USER-DECIDED (the migration plan was approved out of plan mode); CLAUDE-DECIDED on per-phase implementation calls.
- **Detail:** The seven-phase migration plan in `docs/design/migration-plan.md` was executed end-to-end on `theme-swapping-date`, ship to `master` once Phase G playtest validates. Phase G is the only outstanding phase — it's a manual playthrough, not engineering work.
- **What shipped:**
  - **Phase A — token contract.** `Theme` interface expanded to all six architecture-spec categories (color roles, fonts struct, textures struct, motion discriminators, audio shared/themed split, chapter-color seed bank). Bibliophile manifest fills the new shape.
  - **Phase B — consumer migration.** main.ts copy strings + 12 hex literals migrated to `getTheme().*` reads; Bookplate / library / vault stripe fallbacks tokenized; layout.tsx font URL routes through `getFontStylesheetUrl()`; skin.css partial color sweep (oxblood/gilt/paper-dark/marble-cool → abstract roles, plus 22 texture URL tokenizations).
  - **Phase C — render-path bypass.** Library / Bookplate / vault / retire-picker stripes now resolve from the active theme's `bindingStripePalette` via `chapterStripeColor()`; vault gets a server-computed `chapterColorSeed` so the spine-only contract holds. Storage (DB columns, types, save data, AI prompt color generation, eras.json colors) preserved per user direction "don't strip anything".
  - **Phase D — Curator.** Manifest + tokens.css under `[data-theme="curator"]`; Cormorant Garamond + Inter as free near-equivalents of GT Sectra + Söhne (manifest's font stack lists both); brass-clasp grew vertical-pin variant; THEMES registry; setThemeByName() exposed on window for dev-flag testing.
  - **Phase E — Cartographer.** Manifest + tokens.css under `[data-theme="cartographer"]`; italic EB Garamond + IBM Plex Mono (both free Google Fonts); 800ms page-turn (vs 700ms) per spec. `Theme.fonts.uiCaseRule` union extended with `"sentence-case-with-mono-comments"` for Cartographer.
  - **Phase F — settings drawer + persistence.** APPEARANCE section with three radio cards in the existing settings drawer; localStorage key `bibliophile-theme-preference`; user.theme_preference text column on the user table (drizzle migration `0006_theme_preference.sql`, applied via push); `theme` cookie set on every change so SSR's first paint matches across reloads; `app/layout.tsx` reads the cookie + validates against THEMES.
  - **Motion variants** for the remaining three primitives: `playPageTurn` gained pan-horizontal + fold-3d branches, `playBrushWipe` gained spotlight-wipe + ink-wash, `playInkBloom` gained frame-then-fill + outline-then-fill. main.ts call sites dispatch on `getTheme().motion.*`.
  - **Run-end seal variants** in skin.css: rectangular brushed-brass plaque under `[data-theme="curator"]`, slightly-irregular red wax circle under `[data-theme="cartographer"]`. Compass-rose engraving deferred (needs a real SVG asset; the "A" stays for now).
  - **Placeholder SVG textures** for Curator (linen, archival cream, mat-board) and Cartographer (14×14 hand-ruled grid, vellum, sepia border) — hand-coded SVG approximations of the spec's intended textures. Real commissioned assets can drop into the same paths.
- **What's still deferred (post-migration):**
  - **Phase G manual playthrough** — cold-start in each theme, mid-run switching, mixed-theme library re-skin, vault, accessibility cross-product, SSR first-paint check.
  - **Surface-level Curator/Cartographer skin.css overrides** — gallery-wall library + deaccession-ledger framing for Curator, mono-comment prefixes + expedition-log + copper push-pin sprite for Cartographer. These are layout/typography deltas that need design+engineering with real assets.
  - **Bari painted art across all three themes** (per D25, deferred indefinitely; emoji composite stays).
  - **Sourced audio samples** — procedural Web Audio bus is still kill-switched per D14; the manifest's themed audio paths are forward-looking declarations.
  - **Discoverability gate** (architecture spec §8: surface theme options after run 3) — shipped without the gate; revisit if it disorients first-time players.
  - **Atlas (Cartographer linear-wall library)** — explicit v1.1 per spec §9.
- **Spec gaps surfaced during implementation** (worth ratifying or addressing in follow-up):
  - `theming-architecture.md §3.1` — text-color contract is single-surfaced. Real themes have both light and dark surfaces; raw swatches (`var(--vellum)` for text on dark, `var(--ink-black)` for text on light) stayed in skin.css where role layer was insufficient.
  - `theming-architecture.md §3.2` — Cartographer's `sentence-case-with-mono-comments` value isn't in the spec's union. I extended `Theme.fonts.uiCaseRule` to accept it.
  - `theming-architecture.md §3.3` — texture CSS variable names (`--texture-page-bg` / `--texture-tile-face` / `--texture-border`) chosen during Phase B; spec doesn't dictate names.
  - `theming-architecture.md §3.6` — the three "shared" cello cues map to architecture-spec names `held_breath_inhale` / `post_commit_breath` / `retirement_exhale` but the manifest names them `celloBind` / `celloRetire` / `celloBridge`.
  - `migration-plan.md §B verification` — the "DevTools `setProperty('--accent', 'red')` should turn every gilt accent red" line is wrong; gilt is `--accent-secondary`, oxblood is `--accent`. Fixed in the same commit as this entry.
- **Reversible if:** Any individual theme manifest can be removed by deleting its `src/theme/<name>/` directory + dropping the `THEMES[<name>]` entry + removing the `@import` from `app/globals.css`. The dev-flag `setThemeByName()` exposure on `window` is a one-line revert in main.ts. The DB column rollback is a single `ALTER TABLE "user" DROP COLUMN "theme_preference"`.
