# Idea Collector — Curator Theme

> Delta spec. This document describes only the differences from `bibliophile-spec.md`. Everything not specified here behaves as Bibliophile.

**Status:** Design locked, ready for implementation
**Audience:** Engineering and design
**Related docs:** `bibliophile-spec.md` (base spec), `theming-architecture.md` (token system)

---

## Table of contents

1. [Identity](#1-identity)
2. [Token values](#2-token-values)
3. [Surface deltas](#3-surface-deltas)
4. [Motion deltas](#4-motion-deltas)
5. [Audio deltas](#5-audio-deltas)
6. [Bari · the curator's apprentice](#6-bari--the-curators-apprentice)
7. [Curator-specific copy](#7-curator-specific-copy)
8. [Run-end seal](#8-run-end-seal)
9. [Open questions](#9-open-questions)

---

## 1. Identity

### Design intent

A small permanent collection. The player isn't keeping a private codex — they're curating a museum someone might one day visit. The same act of choice (what to bind, what to retire) but a different cultural register: from "I made this history" to "I assembled this collection."

The Curator is more public, more institutional, more deliberately spare than Bibliophile. Where Bibliophile fills a leather page edge to edge, Curator leaves whitespace. Where Bibliophile uses ornament and gilt, Curator uses negative space and a single accent.

### Tone words

Reverent (shared with Bibliophile). Composed. Spare. Considered. Not minimalist — there's still warmth — but disciplined.

### Anti-references

- Modern minimalist app aesthetics (Notion, Linear) — Curator is not "clean tech"
- Generic "museum" video game UIs (gold frames everywhere)
- Anything that says "luxury"

---

## 2. Token values

### 2.1 Color tokens

```
--bg-page          #fafaf5  archival cream
--bg-surface       #e8e2d4  warmer cream (cards, modals)
--bg-deep          #1a1a1a  near-black (deep modals, frontispiece backdrops)
--text-primary     #1a1a1a  near-black body text
--text-secondary   #444444  mid-gray
--text-tertiary    #888780  ghost gray
--accent           #1a1a1a  near-black is the accent (no gold)
--accent-secondary #7a3e2a  oxblood — only for run-end seal ribbons
--border-strong    #1a1a1a  near-black, 0.5px
--border-faint     #c4c0b6  faint gray
```

The inverse contrast of Bibliophile. Light page, dark text, near-black accents. The single warm color (oxblood) appears only at the run-end seal — restraint by design.

### 2.2 Typography tokens

```
--font-display     "GT Sectra" (display serif with sharp wedge serifs)
--font-ui          "Söhne" (clean grotesque)
--font-mono        unused
--font-display-style  regular (not italic)
--ui-case-rule     "all-caps-tracked"  (placards: ACQUISITIONS NEEDED, GALLERY III)
```

Two-weight rule still applies. Regular and medium only.

**Casing convention:** UI labels and placard headers use ALL CAPS LETTERSPACED (museum convention). Body narrative remains sentence case. Italic is reserved for narrative wall texts, not titles. (This is the inverse of Bibliophile's approach, where italics carried the narrative voice and titles were upright.)

### 2.3 Texture tokens

- **Background pattern:** linen wallpaper at 2% opacity. Almost invisible; readable as fabric only at close inspection.
- **Tile-face fill:** plain archival cream (`#fafaf5`). No marbling, no veins.
- **Border treatment:** beveled mat board around tiles (3px outer black frame, 4px white mat, 1.5px thin inner mat-bevel line).

The texture story is restraint. Linen wallpaper, white mat, brass placard — that's it.

### 2.4 Motion tokens

```
--page-transition-type     "pan-horizontal"
--page-transition-duration 700ms (shared)
--bind-clasp-type          "vertical-pin"
--ink-bloom-type           "frame-then-fill"
--frontispiece-reveal-type "spotlight-wipe"
```

### 2.5 Chapter-color seed bank

Curator's chapter-color palette is muted near-blacks and charcoals — not chromatic. The "color" of a kept tile is which shade of charcoal frames it. Subtle but present at close inspection.

```
[
  "#1a1a1a",  // near-black
  "#2a2a2a",  // soft black
  "#333333",  // charcoal
  "#3d3d3d",  // warm charcoal
  "#3a3a3a",  // mid charcoal
  "#444444",  // mid gray
  "#4d4a44",  // warm gray
  "#3a3a3a",  // mid charcoal (repeat for distribution)
  "#5a5a5a",  // light charcoal
  "#383838",  // deep charcoal
  "#414141",  // mid-warm charcoal
  "#2d2d2d",  // soft warm black
  "#3e3e3e",  // mid warm
  "#48453f",  // deep warm gray
  "#33312d",  // espresso
]
```

This is intentionally less expressive than Bibliophile's chromatic palette. Curator says "every tile is the same kind of important." Bibliophile says "every chapter has its own character." Both are valid.

### 2.6 Audio textures

See **Section 5** for the full cue list. Music layer (cello G2, C2, tonic resolve) is shared with Bibliophile and Cartographer.

---

## 3. Surface deltas

### 3.1 Onboarding

Same five-frame structure as Bibliophile. Replace:

- "Idea Collector / — Chapter I —" book cover → cast-bronze placard with engraved title, displayed on a gallery wall against linen wallpaper.
- "Try." italic line → "BEGIN." in tracked caps.
- Bari's introduction is unchanged (he fades in lower-left margin), but he wears a linen apron and white gloves.
- The ink-bloom of starter tiles is replaced with frame-then-fill (mat board outline draws first, then the tile face fades in inside it).

Total duration unchanged: 60–90 seconds.

### 3.2 Play screen

The "writing desk" caption becomes "THE STUDIO" (tracked caps).

The card catalog at right becomes "COLLECTION" — same component, same grid, new label.

The strip at the bottom is now a long horizontal display rail with mini matted frames, not bound spines. Same 11 cubes, same kept-tile-as-inventory behavior, but each cube is a small framed thumbnail instead of a leather-bound spine.

Bari sits in the lower-left as before, but the surface he sits on is gallery floor (parquet line visible), not workshop floor (suggested by warm brown).

### 3.3 Bind ceremony

Mechanically identical to Bibliophile. Six frames, hold-to-commit at 2.5s, post-commit breathing optional. The visual differences:

- The "plate" the tile gets dragged into is a **cast-bronze placard frame** mounted on a gallery wall, not a marbled bookplate frame on a leather page.
- The bind dropzone shows a thin dashed black-on-white line indicating where the piece will be matted (instead of dashed gilt-on-leather).
- The hold-arc is darker and thinner than Bibliophile's gilt arc — a single thin black line with no glow. Curator doesn't glow.
- On commit, **vertical pins descend from above** (one each side) to fix the placard to the wall, instead of brass clasps sliding horizontally. Same 220ms timing, same `cubic-bezier(0.4, 0, 0.2, 1)`, same haptic.
- The post-commit breathing is reduced to a 1.5%-amplitude scale instead of 2%. Galleries don't breathe as much as workshops.
- The "release to continue" italic line becomes "RELEASE" in tracked caps with no period.

### 3.4 Era summary

Same three-frame structure. Replace:

- The open-spread book becomes a **gallery wall** with the era's piece hung center, a brushed-brass placard underneath, and date range in mono-style notation ("3300–1200 BCE").
- The brush wipe revealing the frontispiece becomes a **spotlight wipe** — a soft elliptical highlight sweeps across the painted piece left to right (1400ms, same timing). The piece is dim before the spotlight passes; lit after.
- "Begin Chapter [next] →" becomes "OPEN GALLERY [next] →" in tracked caps.

The narrative line stays italic and lowercase (Cardo equivalent in Curator is GT Sectra italic for narrative). This is the only italic in the Curator UI — a deliberate exception.

### 3.5 Library

The library is no longer a shelf — it's a **gallery wall**. Spatial metaphor change:

- 24 framed pieces hanging in a 6×4 grid on a section of warmly-lit gallery wall.
- Each tile is a small matted frame: outer black, white mat, image, brass placard underneath with the tile name.
- Per-chapter color is the **mat board's tone** (varying near-blacks per the seed bank), not a binding stripe.
- Below the grid: a wall plaque reading "THE PERMANENT COLLECTION · 24 PIECES."

When the player taps a tile, the pull-up sheet uses Curator's frame style (matted, brass placard with tier stars, wall text in italic narrative).

**Wall-full state:** plaque changes to "THE PERMANENT COLLECTION · COMPLETE." No counter shift to gilt — Curator stays restrained. The gravity is in the word "complete," not in color.

### 3.6 Retirement ceremony

The framing changes from "give it back to the world" to **"deaccession to the world."** This is real museum terminology — when an institution removes an item from its permanent collection, that's deaccession.

The four-frame structure is identical. Visual deltas:

- The new tile suspended above the wall is in its full Curator frame (matted, placard).
- "twenty-four spaces. one must yield." → "TWENTY-FOUR PIECES. ONE MUST GO."
- "hold a tile to give it back" → "HOLD A PIECE TO DEACCESSION"
- The dispersal animation is unchanged — the retiring tile's matted frame dissolves into ink-points (using the existing wax-droplet primitive) that drift up. Curator's points are a slightly cooler near-black instead of warm gilt; otherwise identical.
- The cello descent (C2 → G1) plays unchanged.

**Wall-full first-time copy.** Bari speaks once, only here, in Curator-italic margin text:

> *"a collection is what we have chosen to keep. press a piece to send it onward."*

(Same structural framing as Bibliophile's line, with "shelf" → "collection.")

### 3.7 Vault → Deaccession Ledger

The vault is renamed the **Deaccession Ledger**. Visually:

- Vertical scrolling list of small placards.
- Each placard shows: chapter Roman numeral, run number, retire date. No image, no name, no narrative — same information loss as Bibliophile's vault.
- Tap a placard → "DEACCESSIONED · Run [N] · Gallery [roman] · [date]."
- Header: "THE DEACCESSION LEDGER."

Same data stored, same retrieval rule (none); different framing.

### 3.8 Run end

After the eleventh bind ceremony's clasp completes, hold ~600ms, then a **brushed-brass commemorative plaque** stamps onto the strip's center. Replaces Bibliophile's red wax seal.

- The plaque scales 1.4 → 1.0 (320ms with overshoot, same as Bibliophile's wax stamp).
- Engraved gilt "A" in the center.
- Cathedral bell SFX is replaced with **museum-bell SFX** — same ~110Hz fundamental, slightly more harmonics. Same 4s tail. Still played only here.
- The "Age of Plenty" overlay rises with text in tracked caps:
  ```
  RUN COMPLETE
  AGE OF PLENTY
  A COLLECTION NO ONE ELSE HAS ASSEMBLED
  ```

---

## 4. Motion deltas

Five primitives change. The other nine are shared with Bibliophile.

| Primitive | Bibliophile | Curator |
|---|---|---|
| Brass clasp | Two horizontal rects slide ±20px from sides | Two vertical pins descend 20px from above and below |
| Page turn | 2D peel from right edge | Horizontal pan to next gallery (camera moves left, room scrolls right) |
| Brush wipe | Clip-path inset 100% → 0%, +4px drift | Spotlight wipe: soft elliptical alpha mask sweeps left-to-right |
| Cube bloom | Fill `#3a2818` → tile face | Frame draws first (200ms), fills with placard (400ms) |
| Ink-bloom | Scale 0 → 1, fill expands | Frame-then-fill: outline draws first, fade fills inside |

Shared timings preserved: 220ms, 700ms, 1400ms, 600ms, 600ms respectively.

**Three Curator-specific motion notes:**

1. The hold-arc is thinner (1.4px instead of 2.4px) and pure black (no glow at all). Curator doesn't use gilt halos; it uses negative space.
2. Bari's nod is unchanged in timing but the pose itself is slightly different — his head dip is shorter (-4° instead of -6°), more reserved. Galleries are quieter spaces.
3. Bari's wonder pose loses the "leaning in" — replaced with a single small step backward, as if to take in a piece from a better angle. Same duration (~1.5s hold), inverse direction.

---

## 5. Audio deltas

The music layer is shared with Bibliophile. Eight texture cues swap.

| Cue | Bibliophile | Curator |
|---|---|---|
| Combine resolve | Woody knock (~120ms, −18 LUFS) | Brass-on-marble tap (~120ms, −18 LUFS) |
| Combine impossible | Soft inkwell tap (~80ms, −24 LUFS) | Soft brass-on-felt tap (~80ms, −24 LUFS) |
| Era goal met | Singing bowl (~196Hz, 1.4s, −16 LUFS) | Single struck museum bell (~220Hz, 1.4s, −16 LUFS) |
| Tile bound (clasp snap) | Leather press + brass click + cello tonic (340ms, −14 LUFS) | Pin-into-cork + brass click + cello tonic (340ms, −14 LUFS) |
| Page turn | Old paper rustle (700ms, −20 LUFS) | Soft footsteps on parquet + brass key turn (700ms, −20 LUFS) |
| Tapestry painting | Brush-on-canvas loop (1.4s, −26 LUFS) | Single soft brush stroke + spotlight hum (1.4s, −26 LUFS) |
| Run sealed (cathedral bell) | Cathedral bell, low (~110Hz, 4s, −12 LUFS) | Museum bell, low (~110Hz, 4s, −12 LUFS) |
| Workshop room tone | Fire crackle + distant wind (loop, −25 LUFS) | Footsteps echoing + faint HVAC hum (loop, −25 LUFS) |

Loudness budget identical. Cello cues identical. Only timbres swap.

**One Curator-specific audio note:** the spotlight-wipe frontispiece reveal benefits from a faint *spotlight hum* underneath the brush stroke — a subliminal electric-warmth sound suggesting a real museum spotlight switching on. This is a Curator-only addition, not an override.

---

## 6. Bari · the curator's apprentice

Same character, same four poses (idle, approval nod, wonder/leaning back, patient), same silence rule (speaks once, only at first wall-full retirement), same painted style.

**Costume changes:**

- Linen apron over a simple white shirt (replacing leather smock).
- White cotton gloves on his hands.
- A small brass label-maker or dust brush in place of the hammer.
- Hair tied back; same boyish face.

**Pose change:** "wonder / leaning in" becomes "wonder / leaning back." Curator's apprentice stands back to admire a piece, doesn't lean toward it. Single small step backward; same ~1.5s hold.

**Bari's location:** lower-left margin still, but now sitting on the gallery floor with his back against the wall, rather than cross-legged on the workshop floor. Subtle but reinforces the spatial difference.

**Bari's one line of speech** (first wall-full retirement only):

> *"a collection is what we have chosen to keep. press a piece to send it onward."*

Same structure as Bibliophile's line. Lowercase italic. Never repeats.

---

## 7. Curator-specific copy

A small set of word substitutions reflecting Curator's institutional voice.

| Bibliophile | Curator |
|---|---|
| Codex | Collection |
| Bind a piece into your codex | Add a piece to your collection |
| Bound to your codex | Added to your collection |
| Your library | Your collection |
| Your shelf is full | Your collection is full |
| Send it onward | Deaccession (it) |
| Vault | Deaccession Ledger |
| Card Catalog (inventory) | Collection (sidebar) |
| The writing desk | The studio |
| Chapter | Gallery |
| Begin Chapter IV → | OPEN GALLERY IV → |
| Age of Plenty | Age of Plenty (unchanged — both themes use this) |
| Bari | Bari (name unchanged across all themes) |

A few of these substitutions are content-affecting and matter for AI-generated narrative seeding. The narrative voice itself stays the same per the architecture spec — only the framing words change.

---

## 8. Run-end seal

Replaces Bibliophile's red-wax-and-gilt-A with a **brushed-brass commemorative plaque.**

- Rectangular brass plaque, 80×40px on the strip's center.
- Engraved gilt "A" in serif (same letterform as the wax seal's "A," different material).
- Plaque has a 1px dark border below for shadow, suggesting it sits proud of the strip.
- No droplets, no splash — brass is poured in a foundry, not dripped.
- Stamps onto the strip with the same 320ms overshoot as Bibliophile's wax stamp.
- Three small brass shavings fan out and fade (replacing the wax droplets) — a foundry detail, not a wax detail.

**Audio:** the museum-bell SFX described in Section 5. Same ~110Hz fundamental as Bibliophile's cathedral bell, but with more upper harmonics, suggesting a smaller, more contained bell hung indoors rather than in a tower.

---

## 9. Open questions

### Should the gallery layout for the library be linear instead of grid?

Currently: 6×4 grid, same as Bibliophile.

Alternative: a single horizontal wall the player scrolls along, broken into rooms (groups of 4–6 frames per "exhibition wall"). This is more cohesive with the gallery metaphor, but it changes the spatial reading of the library and complicates the wall-full ceremony.

Recommendation: ship grid for v1 (matches the architecture, easier to build). Revisit linear-wall layout if Curator becomes the most-played theme and benefits from differentiation.

### Should Bari wear different gloves at different career stages?

There's a small detail opportunity: Bari's gloves could subtly stain or wear over time, suggesting the player has been working with him through many runs. This is the kind of detail that lands on long-time players without new players noticing.

Cost: ~5 small art variations on the gloves, possibly a few on the apron. Reward: a quiet "you've been at this a while" recognition.

Recommendation: defer to v1.1. Ship Bari with a single Curator costume. Add wear-state if the game has the staying power to deserve it.

### Is the "single accent only at run-end" rule too restrictive?

Currently: oxblood appears only on the run-end seal's plaque ribbon. Some Curator UIs might benefit from a small accent for active-state feedback (e.g., the active chapter on the strip, the current goal in the objectives card).

The Bibliophile equivalent is gilt, which appears generously. Curator's restraint is part of its identity, but pure near-black-on-white may feel cold without any warm tone in normal play.

Recommendation: experiment. Try Curator with no warm accent during play (only at run-end), then try Curator with a tiny oxblood usage on the active chapter's strip cube. Whichever feels more alive in playtest wins.

### Should the gallery have visitors?

Implication: tiny faint silhouettes of museum visitors walking through in the background, glimpsed at the edges of frames. They could appear once per run during a quiet moment, never approach Bari, never affect gameplay.

This is wildly out of scope for v1 but worth flagging for v1.1+. It would land Curator's "your collection might be visited" framing in a way that nothing else does.

Recommendation: hold this as a far-future polish target. Note in the spec, do not build.


## Visual reference

*Mobile-first mockups from early design exploration. These show the Curator direction at four key surfaces: mid-combine play screen, the era-complete bind moment, the era-summary unveiling, and the collection (library) view across runs. The mockups predate some refinements (e.g. the strip-as-inventory mechanic, the four-beat chapter end) but capture the Curator visual language.*

<p><strong>Mid-combine · the studio</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 220 440" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;border-radius:22px;">
          <rect width="220" height="440" fill="#e8e2d4"/>
          <rect x="10" y="14" width="200" height="26" fill="#1a1a1a"/>
          <text x="110" y="31" text-anchor="middle" font-family="Söhne, Helvetica, sans-serif" font-size="10" fill="#fafaf5" letter-spacing="3">GALLERY III · BRONZE</text>
          <rect x="10" y="48" width="200" height="56" fill="#fafaf5" stroke="#1a1a1a" stroke-width="0.5"/>
          <text x="20" y="62" font-family="Söhne, sans-serif" font-size="7" fill="#666" letter-spacing="2">ACQUISITIONS</text>
          <text x="20" y="76" font-family="Söhne, sans-serif" font-size="9" fill="#1a1a1a">✓  Smelt copper</text>
          <text x="20" y="90" font-family="Söhne, sans-serif" font-size="9" fill="#1a1a1a">✓  Build a city</text>
          <text x="120" y="76" font-family="Söhne, sans-serif" font-size="9" fill="#999">○  Forge alloy</text>
          <text x="120" y="90" font-family="Söhne, sans-serif" font-size="9" fill="#999">○  Write laws</text>
          <rect x="10" y="112" width="200" height="170" fill="#fafaf5" stroke="#1a1a1a" stroke-width="0.5"/>
          <line x1="10" y1="266" x2="210" y2="266" stroke="#1a1a1a" stroke-width="0.3"/>
          <text x="110" y="278" text-anchor="middle" font-family="Söhne, sans-serif" font-size="7" fill="#666" letter-spacing="3">— THE STUDIO —</text>
          <g transform="translate(40, 134)">
            <rect width="56" height="74" fill="#3a3a3a"/>
            <rect x="4" y="4" width="48" height="66" fill="#fafaf5"/>
            <text x="28" y="38" text-anchor="middle" font-size="22">🔥</text>
            <rect x="4" y="50" width="48" height="20" fill="#e8e2d4"/>
            <text x="28" y="62" text-anchor="middle" font-family="GT Sectra, Georgia, serif" font-size="8" fill="#1a1a1a">Fire · 1.2</text>
          </g>
          <g transform="translate(124, 158)" opacity="0.85">
            <rect width="56" height="74" fill="#3a3a3a"/>
            <rect x="4" y="4" width="48" height="66" fill="#fafaf5"/>
            <text x="28" y="38" text-anchor="middle" font-size="22">🪨</text>
            <rect x="4" y="50" width="48" height="20" fill="#e8e2d4"/>
            <text x="28" y="62" text-anchor="middle" font-family="GT Sectra, serif" font-size="8" fill="#1a1a1a">Copper · 2.4</text>
          </g>
          <circle cx="110" cy="220" r="14" fill="#1a1a1a" opacity="0.08"/>
          <circle cx="110" cy="220" r="9" fill="#1a1a1a" opacity="0.18"/>
          <text x="20" y="306" font-family="Söhne, sans-serif" font-size="7" fill="#666" letter-spacing="2">COLLECTION</text>
          <g transform="translate(20, 314)"><rect width="36" height="46" fill="#3a3a3a"/><rect x="3" y="3" width="30" height="40" fill="#fafaf5"/><text x="18" y="28" text-anchor="middle" font-size="14">🌊</text></g>
          <g transform="translate(60, 314)"><rect width="36" height="46" fill="#3a3a3a"/><rect x="3" y="3" width="30" height="40" fill="#fafaf5"/><text x="18" y="28" text-anchor="middle" font-size="14">🌾</text></g>
          <g transform="translate(100, 314)"><rect width="36" height="46" fill="#3a3a3a"/><rect x="3" y="3" width="30" height="40" fill="#fafaf5"/><text x="18" y="28" text-anchor="middle" font-size="14">🏛</text></g>
          <g transform="translate(140, 314)"><rect width="36" height="46" fill="#3a3a3a"/><rect x="3" y="3" width="30" height="40" fill="#fafaf5"/><text x="18" y="28" text-anchor="middle" font-size="14">📜</text></g>
          <g transform="translate(180, 314)"><rect width="36" height="46" fill="#3a3a3a"/><rect x="3" y="3" width="30" height="40" fill="#fafaf5"/><text x="18" y="28" text-anchor="middle" font-size="14">⚱</text></g>
          <text x="20" y="378" font-family="Söhne, sans-serif" font-size="7" fill="#666" letter-spacing="2">PERMANENT COLLECTION</text>
          <g transform="translate(16, 386)"><rect width="14" height="22" fill="#3a3a3a"/><rect x="1.5" y="1.5" width="11" height="19" fill="#fafaf5"/><text x="7" y="14" text-anchor="middle" font-size="8">🔥</text></g>
          <g transform="translate(34, 386)"><rect width="14" height="22" fill="#3a3a3a"/><rect x="1.5" y="1.5" width="11" height="19" fill="#fafaf5"/><text x="7" y="14" text-anchor="middle" font-size="8">🌾</text></g>
          <g transform="translate(52, 386)"><rect width="14" height="22" fill="#1a1a1a"/><rect x="1.5" y="1.5" width="11" height="19" fill="#fafaf5"/><text x="7" y="14" text-anchor="middle" font-size="8">⚒</text></g>
          <g transform="translate(70, 386)"><rect width="14" height="22" fill="#3a3a3a" opacity="0.3"/></g>
          <g transform="translate(88, 386)"><rect width="14" height="22" fill="#3a3a3a" opacity="0.3"/></g>
          <g transform="translate(106, 386)"><rect width="14" height="22" fill="#3a3a3a" opacity="0.3"/></g>
          <g transform="translate(124, 386)"><rect width="14" height="22" fill="#3a3a3a" opacity="0.3"/></g>
          <g transform="translate(142, 386)"><rect width="14" height="22" fill="#3a3a3a" opacity="0.3"/></g>
          <g transform="translate(160, 386)"><rect width="14" height="22" fill="#3a3a3a" opacity="0.3"/></g>
          <g transform="translate(178, 386)"><rect width="14" height="22" fill="#3a3a3a" opacity="0.3"/></g>
          <g transform="translate(196, 386)"><rect width="14" height="22" fill="#3a3a3a" opacity="0.3"/></g>
          <text x="110" y="424" text-anchor="middle" font-family="GT Sectra, serif" font-size="9" font-style="italic" fill="#666">Bari · the apprentice curator</text>
        </svg>

</div>

<p><strong>Era complete · choose a piece for the collection</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 220 440" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;border-radius:22px;">
          <rect width="220" height="440" fill="#e8e2d4"/>
          <rect x="10" y="14" width="200" height="26" fill="#1a1a1a"/>
          <text x="110" y="31" text-anchor="middle" font-family="Söhne, sans-serif" font-size="10" fill="#fafaf5" letter-spacing="3">GALLERY III · COMPLETE</text>
          <rect x="10" y="48" width="200" height="50" fill="#fafaf5" stroke="#1a1a1a" stroke-width="0.5"/>
          <text x="20" y="62" font-family="Söhne, sans-serif" font-size="7" fill="#666" letter-spacing="2">ACQUISITIONS</text>
          <text x="20" y="76" font-family="Söhne, sans-serif" font-size="9" fill="#1a1a1a">✓ Copper  ✓ City  ✓ Alloy  ✓ Laws</text>
          <text x="20" y="90" font-family="GT Sectra, serif" font-size="9" font-style="italic" fill="#666">All requirements met.</text>
          <text x="110" y="120" text-anchor="middle" font-family="Söhne, sans-serif" font-size="8" fill="#1a1a1a" letter-spacing="2">FOR THE PERMANENT COLLECTION</text>
          <path d="M 110 130 L 110 154" stroke="#7a3e2a" stroke-width="1" stroke-dasharray="2 2"/>
          <path d="M 104 148 L 110 156 L 116 148" stroke="#7a3e2a" stroke-width="1" fill="none"/>
          <rect x="60" y="160" width="100" height="80" fill="none" stroke="#1a1a1a" stroke-width="1" stroke-dasharray="4 3"/>
          <text x="110" y="200" text-anchor="middle" font-family="GT Sectra, serif" font-size="10" font-style="italic" fill="#666">drop a piece here</text>
          <text x="110" y="216" text-anchor="middle" font-family="Söhne, sans-serif" font-size="8" fill="#999" letter-spacing="1">— ONE OF EIGHT —</text>
          <text x="20" y="262" font-family="Söhne, sans-serif" font-size="7" fill="#666" letter-spacing="2">FROM THIS GALLERY</text>
          <g transform="translate(20, 270)"><rect width="40" height="50" fill="#3a3a3a"/><rect x="3" y="3" width="34" height="44" fill="#fafaf5"/><text x="20" y="30" text-anchor="middle" font-size="16">🌾</text></g>
          <g transform="translate(64, 270)"><rect width="40" height="50" fill="#3a3a3a"/><rect x="3" y="3" width="34" height="44" fill="#fafaf5"/><text x="20" y="30" text-anchor="middle" font-size="16">🏛</text></g>
          <g transform="translate(108, 270)"><rect width="40" height="50" fill="#1a1a1a"/><rect x="3" y="3" width="34" height="44" fill="#fafaf5"/><text x="20" y="30" text-anchor="middle" font-size="16">⚒</text></g>
          <g transform="translate(152, 270)"><rect width="40" height="50" fill="#3a3a3a"/><rect x="3" y="3" width="34" height="44" fill="#fafaf5"/><text x="20" y="30" text-anchor="middle" font-size="16">📜</text></g>
          <g transform="translate(20, 326)"><rect width="40" height="50" fill="#3a3a3a"/><rect x="3" y="3" width="34" height="44" fill="#fafaf5"/><text x="20" y="30" text-anchor="middle" font-size="16">⚱</text></g>
          <g transform="translate(64, 326)"><rect width="40" height="50" fill="#3a3a3a"/><rect x="3" y="3" width="34" height="44" fill="#fafaf5"/><text x="20" y="30" text-anchor="middle" font-size="16">🏺</text></g>
          <g transform="translate(108, 326)"><rect width="40" height="50" fill="#3a3a3a"/><rect x="3" y="3" width="34" height="44" fill="#fafaf5"/><text x="20" y="30" text-anchor="middle" font-size="16">🛡</text></g>
          <g transform="translate(152, 326)"><rect width="40" height="50" fill="#3a3a3a"/><rect x="3" y="3" width="34" height="44" fill="#fafaf5"/><text x="20" y="30" text-anchor="middle" font-size="16">🐎</text></g>
          <rect x="20" y="392" width="180" height="32" fill="#999" opacity="0.5"/>
          <text x="110" y="412" text-anchor="middle" font-family="Söhne, sans-serif" font-size="10" fill="#fafaf5" letter-spacing="3">OPEN GALLERY IV  →</text>
        </svg>

</div>

<p><strong>Era summary · the gallery unveiling</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 220 440" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;border-radius:22px;">
          <rect width="220" height="440" fill="#1a1a1a"/>
          <ellipse cx="110" cy="20" rx="80" ry="14" fill="#fafaf5" opacity="0.05"/>
          <rect x="20" y="36" width="180" height="140" fill="#3a3a3a"/>
          <rect x="28" y="44" width="164" height="124" fill="#7a3e2a"/>
          <text x="110" y="110" text-anchor="middle" font-family="GT Sectra, serif" font-size="9" font-style="italic" fill="#e8e2d4">[ AI-painted gallery piece ]</text>
          <rect x="20" y="186" width="180" height="64" fill="#fafaf5"/>
          <text x="32" y="202" font-family="Söhne, sans-serif" font-size="7" fill="#666" letter-spacing="2">GALLERY III · BRONZE AGE</text>
          <text x="32" y="220" font-family="GT Sectra, serif" font-size="12" fill="#1a1a1a">Smoke from a Hundred Furnaces</text>
          <text x="32" y="234" font-family="GT Sectra, serif" font-size="9" font-style="italic" fill="#444">A king learns the weight of laws.</text>
          <text x="32" y="245" font-family="Söhne, sans-serif" font-size="7" fill="#999" letter-spacing="1">73 ACQUISITIONS · 14 NEW PIECES</text>
          <text x="110" y="272" text-anchor="middle" font-family="Söhne, sans-serif" font-size="8" fill="#999" letter-spacing="2">FOR THE COLLECTION</text>
          <g transform="translate(74, 282)">
            <rect width="72" height="86" fill="#fafaf5"/>
            <rect x="4" y="4" width="64" height="78" fill="#e8e2d4"/>
            <text x="36" y="50" text-anchor="middle" font-size="32">⚒</text>
            <rect x="4" y="62" width="64" height="20" fill="#fafaf5"/>
            <text x="36" y="74" text-anchor="middle" font-family="GT Sectra, serif" font-size="9" fill="#1a1a1a">The Forge</text>
            <text x="36" y="80" text-anchor="middle" font-family="Söhne, sans-serif" font-size="6" fill="#666" letter-spacing="1">★★★★★  TIER V</text>
          </g>
          <rect x="20" y="386" width="180" height="32" fill="#fafaf5"/>
          <text x="110" y="406" text-anchor="middle" font-family="Söhne, sans-serif" font-size="10" fill="#1a1a1a" letter-spacing="3">OPEN GALLERY IV  →</text>
        </svg>

</div>

<p><strong>The collection across runs</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 220 440" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;border-radius:22px;">
          <rect width="220" height="440" fill="#fafaf5"/>
          <rect x="10" y="14" width="200" height="36" fill="#1a1a1a"/>
          <text x="110" y="32" text-anchor="middle" font-family="GT Sectra, serif" font-size="14" fill="#fafaf5">Your Collection</text>
          <text x="110" y="44" text-anchor="middle" font-family="Söhne, sans-serif" font-size="7" fill="#999" letter-spacing="2">4 RUNS · 44 PIECES · 12 EXHIBITIONS</text>
          <text x="20" y="68" font-family="Söhne, sans-serif" font-size="7" fill="#666" letter-spacing="2">EXHIBITION I  ·  STONE → SPACE</text>
          <line x1="20" y1="74" x2="200" y2="74" stroke="#1a1a1a" stroke-width="0.4"/>
          <g transform="translate(16, 84)"><rect width="32" height="40" fill="#3a3a3a"/><rect x="2" y="2" width="28" height="36" fill="#fafaf5"/><text x="16" y="24" text-anchor="middle" font-size="14">🔥</text></g>
          <g transform="translate(52, 84)"><rect width="32" height="40" fill="#3a3a3a"/><rect x="2" y="2" width="28" height="36" fill="#fafaf5"/><text x="16" y="24" text-anchor="middle" font-size="14">🌾</text></g>
          <g transform="translate(88, 84)"><rect width="32" height="40" fill="#1a1a1a"/><rect x="2" y="2" width="28" height="36" fill="#fafaf5"/><text x="16" y="24" text-anchor="middle" font-size="14">⚒</text></g>
          <g transform="translate(124, 84)"><rect width="32" height="40" fill="#3a3a3a"/><rect x="2" y="2" width="28" height="36" fill="#fafaf5"/><text x="16" y="24" text-anchor="middle" font-size="14">📜</text></g>
          <g transform="translate(160, 84)"><rect width="32" height="40" fill="#3a3a3a"/><rect x="2" y="2" width="28" height="36" fill="#fafaf5"/><text x="16" y="24" text-anchor="middle" font-size="14">⛵</text></g>
          <g transform="translate(16, 130)"><rect width="32" height="40" fill="#3a3a3a"/><rect x="2" y="2" width="28" height="36" fill="#fafaf5"/><text x="16" y="24" text-anchor="middle" font-size="14">📖</text></g>
          <g transform="translate(52, 130)"><rect width="32" height="40" fill="#3a3a3a"/><rect x="2" y="2" width="28" height="36" fill="#fafaf5"/><text x="16" y="24" text-anchor="middle" font-size="14">⚙</text></g>
          <g transform="translate(88, 130)"><rect width="32" height="40" fill="#3a3a3a"/><rect x="2" y="2" width="28" height="36" fill="#fafaf5"/><text x="16" y="24" text-anchor="middle" font-size="14">💡</text></g>
          <g transform="translate(124, 130)"><rect width="32" height="40" fill="#1a1a1a"/><rect x="2" y="2" width="28" height="36" fill="#fafaf5"/><text x="16" y="24" text-anchor="middle" font-size="14">⚛</text></g>
          <g transform="translate(160, 130)"><rect width="32" height="40" fill="#3a3a3a"/><rect x="2" y="2" width="28" height="36" fill="#fafaf5"/><text x="16" y="24" text-anchor="middle" font-size="14">🛰</text></g>
          <text x="20" y="200" font-family="Söhne, sans-serif" font-size="7" fill="#666" letter-spacing="2">EXHIBITION II  ·  JOMON → REIWA</text>
          <line x1="20" y1="206" x2="200" y2="206" stroke="#1a1a1a" stroke-width="0.4"/>
          <g transform="translate(16, 216)"><rect width="32" height="40" fill="#3a3a3a"/><rect x="2" y="2" width="28" height="36" fill="#fafaf5"/><text x="16" y="24" text-anchor="middle" font-size="14">🌊</text></g>
          <g transform="translate(52, 216)"><rect width="32" height="40" fill="#3a3a3a"/><rect x="2" y="2" width="28" height="36" fill="#fafaf5"/><text x="16" y="24" text-anchor="middle" font-size="14">🏹</text></g>
          <g transform="translate(88, 216)"><rect width="32" height="40" fill="#3a3a3a"/><rect x="2" y="2" width="28" height="36" fill="#fafaf5"/><text x="16" y="24" text-anchor="middle" font-size="14">🐎</text></g>
          <g transform="translate(124, 216)"><rect width="32" height="40" fill="#1a1a1a"/><rect x="2" y="2" width="28" height="36" fill="#fafaf5"/><text x="16" y="24" text-anchor="middle" font-size="14">🗡</text></g>
          <g transform="translate(160, 216)"><rect width="32" height="40" fill="#3a3a3a"/><rect x="2" y="2" width="28" height="36" fill="#fafaf5"/><text x="16" y="24" text-anchor="middle" font-size="14">⚖</text></g>
          <text x="20" y="288" font-family="Söhne, sans-serif" font-size="7" fill="#666" letter-spacing="2">TAPESTRIES</text>
          <line x1="20" y1="294" x2="200" y2="294" stroke="#1a1a1a" stroke-width="0.4"/>
          <g transform="translate(16, 304)"><rect width="60" height="46" fill="#a8794a"/><text x="30" y="28" text-anchor="middle" font-family="GT Sectra, serif" font-size="6" font-style="italic" fill="#1a1a1a">Stone Age</text></g>
          <g transform="translate(80, 304)"><rect width="60" height="46" fill="#7a3e2a"/><text x="30" y="28" text-anchor="middle" font-family="GT Sectra, serif" font-size="6" font-style="italic" fill="#fafaf5">Bronze</text></g>
          <g transform="translate(144, 304)"><rect width="60" height="46" fill="#3a3a3a"/><text x="30" y="28" text-anchor="middle" font-family="GT Sectra, serif" font-size="6" font-style="italic" fill="#fafaf5">Classical</text></g>
          <g transform="translate(16, 354)"><rect width="60" height="46" fill="#5a4528"/><text x="30" y="28" text-anchor="middle" font-family="GT Sectra, serif" font-size="6" font-style="italic" fill="#fafaf5">Industrial</text></g>
          <g transform="translate(80, 354)"><rect width="60" height="46" fill="#1a1a1a"/><text x="30" y="28" text-anchor="middle" font-family="GT Sectra, serif" font-size="6" font-style="italic" fill="#fafaf5">Atomic</text></g>
          <g transform="translate(144, 354)"><rect width="60" height="46" fill="#888780"/><text x="30" y="28" text-anchor="middle" font-family="GT Sectra, serif" font-size="6" font-style="italic" fill="#1a1a1a">Space</text></g>
          <rect x="20" y="412" width="180" height="14" fill="#1a1a1a"/>
          <text x="110" y="423" text-anchor="middle" font-family="Söhne, sans-serif" font-size="8" fill="#fafaf5" letter-spacing="3">SHARE COLLECTION  →</text>
        </svg>

</div>


---

*End of Curator delta spec. Implement against `bibliophile-spec.md` as the base, with substitutions specified here.*
