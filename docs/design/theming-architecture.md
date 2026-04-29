# Idea Collector — Theming Architecture

> The token system that lets Bibliophile, Curator, and Cartographer share a single codebase. Read this **before** the individual theme delta specs.

**Status:** Architecture spec, ready for implementation
**Audience:** Engineering (primary), design (reference)
**Related docs:** `bibliophile-spec.md` (base), `curator-spec.md`, `cartographer-spec.md`

---

## Table of contents

1. [Architecture decision](#1-architecture-decision)
2. [What's shared, what's themed](#2-whats-shared-whats-themed)
3. [Token categories](#3-token-categories)
4. [Live re-skinning](#4-live-re-skinning)
5. [Storage rules](#5-storage-rules)
6. [Theme switching UX](#6-theme-switching-ux)
7. [Adding a new theme](#7-adding-a-new-theme)
8. [Open questions](#8-open-questions)

---

## 1. Architecture decision

**Themes as skins, not forks.** One codebase. A `theme` token (`bibliophile` | `curator` | `cartographer`) drives all stylistic differences. The game's mechanics, flow, surfaces, and musical clock are identical across themes.

**Themes are a live setting, not a save commitment.** A player can switch themes between runs, mid-run, or at any point. The library re-skins live: every kept tile's stored data is theme-agnostic; rendering is the active theme's job.

**Themes share the cello.** G2 (bind) and C2 (retirement) are the game's harmonic identity, not Bibliophile's. All themes use the same musical clock; only audio textures around it swap.

These three commitments shape everything below.

---

## 2. What's shared, what's themed

### Shared (theme-agnostic — implement once)

| Layer | What it covers |
|---|---|
| Mechanics | Drag-to-combine, hold-to-commit (2.5s), cancel-before-commit, retirement, vault, "don't keep this chapter" |
| Flow | 11-chapter run, four-beat chapter end, onboarding 90s arc, run-end seal |
| Timing | Hold duration, page-turn duration, brush-wipe duration, breathing cycle, all motion easings |
| Music | G2 (bind hold), C2 (retirement hold), perfect fifth resolution, loudness budget |
| Library structure | 24 tiles, 6×4 grid, retirement at full, vault for retired tiles |
| Strip behavior | 11 cubes, kept-tiles-as-inventory, four states (locked, active, awaiting, bound) |
| Bari's poses | Idle, approval nod, wonder, patient — same animation timings |
| Bari's silence | Speaks once, only at first wall-full retirement |
| Accessibility | Reduced-motion mode, tap-to-commit, audio captions |

### Themed (swaps per theme — implement once per theme)

| Layer | What changes |
|---|---|
| Palette | Background, surface, text, accent, chapter-color seed bank |
| Typography | Display face, UI face, casing rules |
| Texture | Background fill (leather, linen, vellum), surface treatments |
| Tile motif | Bookplate / mat board / pinned card |
| Bari's costume | Mason / curator's assistant / surveyor |
| Combine SFX | Woody knock / brass-on-marble / quill on paper |
| Room tone | Workshop / gallery / field tent |
| Page-turn animation | 2D peel / horizontal pan / 3D fold |
| Page-turn SFX | Old paper / footsteps + key / parchment fold |
| Bind clasp animation | Brass clasp / pin-press / pin-descent |
| Bind clasp SFX | Leather press + brass / pin-into-cork / pin-into-cork (varied) |
| Era goal SFX | Singing bowl / struck bell / sextant click + tone |
| Cathedral bell SFX | Bell tower / museum bell / ship's bell |
| Frontispiece reveal | Brush wipe / spotlight wipe / ink wash |
| Library spatial metaphor | Shelf / gallery wall / atlas pages |
| Retirement framing | "Send it onward" / "deaccession" / "return to the territory" |
| Vault framing | Vault / deaccession ledger / expedition log |

---

## 3. Token categories

Six categories of theme tokens. Each theme provides values for all six.

### 3.1 Color tokens

```
--bg-page          Primary background (large surfaces)
--bg-surface       Secondary background (cards, modals, panels)
--bg-deep          Tertiary background (workspace, deep modals)
--text-primary     Body text on primary surface
--text-secondary   Captions, metadata, supporting text
--text-tertiary    Disabled, ghost, very-low-emphasis text
--accent           Primary accent (highlights, halos, active states)
--accent-secondary Secondary accent (rare; used for run-end seal in some themes)
--border-strong    Primary border weight
--border-faint     Faint border / divider
```

Plus a per-chapter chromatic seed bank — see **Section 3.5**.

### 3.2 Typography tokens

```
--font-display     Display serif/grotesque for titles, narrative
--font-ui          UI grotesque/serif for labels, metadata
--font-mono        Optional monospace (Cartographer only)
--font-display-style    "italic" | "regular" — Cartographer uses italic display
--ui-case-rule     "all-caps-tracked" | "sentence-case" — Curator uses tracked caps
```

### 3.3 Texture tokens

Each theme provides:

- A background pattern SVG (leather / linen / vellum)
- A tile-face fill pattern (marbled / archival / gridded)
- An optional border treatment (gilded / matted / ruled)

These are loaded as theme assets at runtime, not generated procedurally.

### 3.4 Motion tokens

A small set of motion overrides per theme:

```
--page-transition-type    "peel-2d" | "pan-horizontal" | "fold-3d"
--page-transition-duration  ms (default 700; theme can override)
--bind-clasp-type         "horizontal-clasp" | "vertical-pin"
--ink-bloom-type          "fill-expand" | "frame-then-fill" | "outline-then-fill"
--frontispiece-reveal-type   "brush-wipe" | "spotlight-wipe" | "ink-wash"
```

All other motion timings (ink-bloom 600ms, brass clasp 220ms, hold-arc 2.5s linear, plate breathing 3s sine, etc.) are **shared across themes**. Don't expose them as theme-overridable — that way drift cannot accumulate.

### 3.5 Chapter-color seed bank

Each theme provides a curated palette of ~15 muted colors for per-chapter binding stripes / mat boards / pin shadows. The hash function `hash(era_id, kept_tile_id, run_id)` produces a deterministic index into the bank.

```
bibliophile_palette = [oxblood, cordovan, slate, ochre, indigo, ...]
curator_palette     = [near-black variants, charcoal, deep gray, ...]
cartographer_palette = [sepia, teal, copper, plum, deep ocean, ...]
```

Same hash seed, different palette → same player's same chapter renders different colors in different themes. This is intentional and meaningful.

### 3.6 Audio textures

Eleven cues. Three are shared (cello G2, cello C2, cello tonic resolution). The other eight have per-theme variants.

```
shared:
- held_breath_inhale (cello G2)
- post_commit_breath (cello C2)
- retirement_exhale (cello C2 → G1)

themed:
- combine_resolve
- combine_impossible
- era_goal_met
- tile_bound (clasp snap)
- page_turn
- tapestry_painting
- run_sealed (cathedral bell)
- workshop_room_tone
```

All themed audio cues conform to the loudness budget defined in `bibliophile-spec.md` Section 7. Don't let themes exceed −14 LUFS or fall below −26 LUFS without explicit reason.

---

## 4. Live re-skinning

The most consequential implication of "themes are a live setting": **stored data must be theme-agnostic.**

### Tile data (theme-agnostic)

What gets stored per kept tile:

```
{
  id: "tile_xyz",
  name: "The Forge",
  emoji: "⚒",
  narrative: "The first hammer to strike a city into being.",
  parent_ids: ["tile_abc", "tile_def"],
  tier: 5,
  bound_in: { run_id, chapter_index, era_name },
  chapter_color_seed: hash(era_id, tile_id, run_id),
  retired_at: null | timestamp,
  retired_in: null | { run_id, chapter_index }
}
```

What does **not** get stored:

- Hex color values
- Texture asset references
- Motion timings
- Bari's pose at bind time
- Audio cue selections
- Any visual treatment whatsoever

Visual treatment is computed at render time from `(active_theme, tile_data)`.

### Era data (theme-agnostic)

The era's tapestry / frontispiece / plate (the AI-painted image generated at chapter end) is stored as an image asset reference. The frame around it (mat board, gilded edge, sepia border) is theme-applied at render time.

The era's narrative line is stored as plain text. Type face and italic styling come from the active theme.

### Per-run data (theme-agnostic)

A run records which tiles were kept, in what order, at what timestamps. It does not record what theme was active when the run was played. (Reasoning: themes can switch live, so "active theme at run-end" is a meaningless property.)

### Theme is a user setting

Stored at the user level, not the run level:

```
user.preferences.theme = "bibliophile" | "curator" | "cartographer"
```

Default: `"bibliophile"`. New users land here.

---

## 5. Storage rules

Three rules for engineering to enforce.

### Rule 1: No hex values in tile or era data

If a developer is tempted to store `binding_color: "#7a3e2a"`, that's the bug. Store the hash seed; let the theme resolve it.

### Rule 2: No motion timings in tile or era data

If a developer is tempted to store `bind_animation_duration: 220`, same bug. Motion timings live in shared code.

### Rule 3: No audio cue references in tile or era data

If a developer wants to cache "what sound played when this tile was bound" — don't. The active theme decides what plays, every time the player views the tile detail card.

These rules look small but they're load-bearing. Violating any one of them breaks live re-skinning.

---

## 6. Theme switching UX

### Where the toggle lives

In Settings, under "Appearance." Three options with small thumbnail previews. Switching is instantaneous — no confirm, no transition; the next frame renders in the new theme.

### What changes immediately on switch

- All UI surfaces (palette, typography, textures)
- Bari's costume (cross-fade his current pose to the new theme's variant of that pose, 240ms)
- All motion overrides (next animation uses the new theme's variants)
- All audio textures (next cue plays with the new theme's variant)
- Library tile rendering (every tile re-renders in the new theme's mat / binding / pin)
- Strip rendering (cubes re-render in new theme's palette)

### What stays the same on switch

- The current run state (what tiles exist, what objectives are met, what's bound)
- The library contents (same 24 tiles, just re-skinned)
- The vault (same retired tiles, same chronological order)
- Any in-flight animation (let it finish in the old theme; new animations use the new theme)
- The cello — if a hold is in progress, the cello continues in its sustained note unchanged

### Edge case: switching during the bind ceremony

Lowest-friction handling: let the in-flight ceremony finish in its starting theme. The next frame after the page-turn into the era summary uses the new theme. This avoids the visual jarring of clasps becoming pins mid-snap.

### Edge case: switching during onboarding

Allowed but unusual. The 90-second onboarding adapts immediately. If the player switches at frame 3 of onboarding, frames 4 and 5 play in the new theme. Bari's costume cross-fades.

---

## 7. Adding a new theme

Procedure for designing and implementing a fourth theme:

1. Write a delta spec following the structure of `curator-spec.md` or `cartographer-spec.md`.
2. Provide values for all six token categories (Section 3 above).
3. Provide assets: background pattern SVG, tile-face fill pattern, border treatment.
4. Provide eight themed audio cues conforming to the loudness budget.
5. Design Bari's costume variant — same four poses, new clothes/tools.
6. Provide chapter-color seed bank (~15 muted colors).
7. Choose retirement and vault framings (the verbs and nouns the theme uses).
8. Choose page-turn type (peel / pan / fold) and bind-clasp type (horizontal / vertical).
9. Run the theme-test checklist (Section 8 of this doc — TBD).

A new theme should require no changes to shared mechanics, flow, or timing.

---

## 8. Open questions

### Should themes affect text content, not just style?

Currently the proposal is: only style swaps. The narrative line "Smoke from a hundred furnaces" reads the same in all three themes; only the typeface, casing, and surrounding chrome differ.

Alternative: themes could rewrite narrative voice. Curator narratives sound like museum wall texts ("In this chapter, the player witnessed..."), Cartographer narratives sound like field journal entries ("Sighted a king's furnace, smoke rising..."). This is more cohesive but triples the AI generation cost — three narrative variants per chapter.

Recommendation: ship style-only theming for v1. Revisit narrative-voice theming if the difference feels insufficient.

### Should the run-end "Age of Plenty" overlay be themed?

It's currently described in Bibliophile terms (gilt "A" in red wax). Curator could use a brushed-brass plaque instead; Cartographer could use a compass rose with the run's name engraved. The overlay is the most distinctive run-end visual; theming it strongly helps each theme feel complete.

Recommendation: yes, theme this. Each theme delta spec will define its run-end seal.

### Should themes be unlockable, or available from start?

If the game wants progression beyond the library: theme unlocks could be tied to library milestones (Curator unlocks at 24 tiles kept, Cartographer at 48 across runs). This adds a meta-game.

If themes are pure aesthetic preference: all three are available from start.

Recommendation: all available from start. The library and run-end seal are the meta-progression; themes are taste, not reward. Locking themes behind progress turns aesthetic identity into a grind.

### What happens to a player who never opens settings?

They play in Bibliophile forever and never know the others exist. This is fine — Bibliophile is a complete experience. But it means alternative themes need at least one moment of discoverability: probably a small "appearance" hint in the run-end overlay after the third run.

Recommendation: surface theme options gently after run 3, not before. The first three runs should be undistracted by aesthetic choices.

---

*End of theming architecture spec. Read alongside `curator-spec.md` and `cartographer-spec.md`.*
