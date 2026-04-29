# Idea Collector — Cartographer Theme

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
6. [Bari · the apprentice surveyor](#6-bari--the-apprentice-surveyor)
7. [Cartographer-specific copy](#7-cartographer-specific-copy)
8. [Run-end seal](#8-run-end-seal)
9. [The atlas — a Cartographer-only library variant](#9-the-atlas)
10. [Open questions](#10-open-questions)

---

## 1. Identity

### Design intent

A field journal of an unfolding world. The player is a surveyor, not a scribe or a curator. Each tile is a discovery pinned to a leaf of the journal. Each chapter is a leaf. The kept tile is pinned onto the master map — a map that becomes more complete with every run.

Where Bibliophile is private (your codex, your hours) and Curator is public (a collection visitors might see), Cartographer is **exploratory**. The metaphor is "I went somewhere. I made a record. I kept what I found."

### Tone words

Reverent (shared). Wondering. Curious. Slightly weather-beaten. The visual register is older than Bibliophile (18th-century rather than monastic), more textured than Curator, more frequently warm.

### Anti-references

- Modern travel-app aesthetics (clean grids, big photos)
- "Adventure game" tropes (treasure chests, quest markers, X-marks-the-spot)
- AAA fantasy maps (overly detailed, video-gamey iconography)

---

## 2. Token values

### 2.1 Color tokens

```
--bg-page          #f0e6cf  vellum / aged paper
--bg-surface       #e8dcc0  warmer paper (cards, modals)
--bg-deep          #1a1208  near-black (deep modals, plate backdrops)
--text-primary     #3a2818  sepia ink
--text-secondary   #7a3e2a  oxblood ink (used heavily, not just for accents)
--text-tertiary    #a8794a  faded sepia
--accent           #b8732a  compass-rose copper
--accent-secondary #1d5e6e  ocean teal (water, routes, isobaths)
--border-strong    #3a2818  sepia ink, 0.5px
--border-faint     #a8794a  faded sepia
```

The warmest of the three palettes. Two accents (copper and teal) instead of one — old maps used multiple inks. The teal appears for any "water-like" element: routes, sea routes, deep isobaths, occasionally for the active state of the current expedition.

### 2.2 Typography tokens

```
--font-display     "EB Garamond" (old-style serif)
--font-ui          "IBM Plex Mono Light"
--font-mono        "IBM Plex Mono Light"  (same as UI — Cartographer uses mono for all UI text)
--font-display-style  italic  (Cartographer narrative is in italic Garamond — feels like 18th-century journal hand)
--ui-case-rule     "sentence-case-with-mono-comments"
```

This is Cartographer's most distinctive type story: **italic Garamond for romantic narrative + monospaced UI labels for surveyor's precision.** The contrast between the two is the theme's character.

UI labels use a "// comment" prefix style for metadata, mimicking surveyor's notation:

```
// surveys to complete
✓ smelt copper
✓ build a city
○ forge alloy
○ write laws
```

Body narrative remains italic Garamond, no quote marks (the journal voice doesn't need them):

> *Smoke from a hundred furnaces. A king learns the weight of laws.*

### 2.3 Texture tokens

- **Background pattern:** hand-ruled grid at 14×14px, faint sepia (`#3a2818` at 30% opacity). This is the most prominent texture of the three themes — Cartographer pages always show their paper grid.
- **Tile-face fill:** plain vellum (`#f0e6cf`). No marbling, no veins. A single faint grid line down the right edge for "this is a journal tile."
- **Border treatment:** thin sepia border (0.4px). Pinned tiles get a small copper push-pin in the top-right corner.
- **Embellishments:** compass roses appear in the corners of frontispiece plates. Faint isobath lines suggest water on the master map. Small sea-monster motifs may appear in margins (rare; flavor only).

The texture story is layered notation. A grid underneath, ink on top, pins fastening, the occasional hand-drawn flourish in a margin.

### 2.4 Motion tokens

```
--page-transition-type     "fold-3d"
--page-transition-duration 800ms (longer than Bibliophile — old paper has more give)
--bind-clasp-type          "vertical-pin"  (descending from above)
--ink-bloom-type           "outline-then-fill"  (sketched in)
--frontispiece-reveal-type "ink-wash"
```

### 2.5 Chapter-color seed bank

Cartographer's palette is the most chromatic of the three — old maps used many inks. Each chapter's binding "color" is the color of the wax used to seal that leaf, or the ink used for that survey.

```
[
  "#7a3e2a",   // oxblood (most common)
  "#1d5e6e",   // ocean teal
  "#b8732a",   // compass copper
  "#3a2818",   // sepia ink
  "#5a4528",   // brown ink
  "#8b3a3a",   // red ink
  "#2d4a3e",   // mossy green
  "#4a2828",   // dark red wax
  "#3d5a2a",   // forest ink
  "#5a3a4a",   // plum ink
  "#1a3030",   // deep teal
  "#7a2a4a",   // crimson
  "#4a4628",   // olive
  "#2a3a3a",   // slate
  "#5a4a28",   // umber
]
```

This palette is closest to Bibliophile's chromatic spirit, but the colors are mappier (ink colors, wax colors, route colors) rather than leather colors.

### 2.6 Audio textures

See **Section 5**. Music layer (cello G2, C2, tonic resolve) is shared with Bibliophile and Curator.

---

## 3. Surface deltas

### 3.1 Onboarding

Same five-frame structure. Replace:

- "Idea Collector / — Chapter I —" book cover → **a closed leather-bound field journal** with a brass clasp, sitting on a desk with a brass spyglass and an inkwell beside it. The journal opens (page-flip animation) into the first leaf.
- "Try." italic line → "*sketch.*" (Cartographer-italic, lowercase, with period — feels like a journal entry, not a directive).
- The starter tiles ink-bloom in via outline-then-fill: sepia outline draws first, then the emoji and label fill in (suggesting the player is watching them being sketched).
- A small compass rose appears in the lower-right corner of the leaf, present from frame 02 onward.

Total duration unchanged: 60–90 seconds.

### 3.2 Play screen

The "writing desk" caption becomes "**// the journal**" (mono-style comment with double-slash prefix).

The card catalog at right becomes "**// pinned discoveries**" or simply "**// discoveries**."

The strip at the bottom is **the leaf-edges of the journal** — a horizontal strip showing the bound side of all eleven leaves, each with its kept-tile pinned to its visible edge. Same 11 cubes, same kept-tile-as-inventory behavior, but visually each cube is a small section of the journal's bound spine, with a tiny pinned card showing the kept tile.

Bari sits in the lower-left as before, but his prop is now a brass spyglass or a small compass, not a hammer.

### 3.3 Bind ceremony

Mechanically identical. Six frames, hold-to-commit at 2.5s. Visual differences:

- The "plate" the tile gets dragged into is a **rectangular drop area on the master map** — a partial map of the territory explored so far, with empty pin holes indicating where new pins can land.
- The bind dropzone shows a thin dashed sepia line — the same dashed-border indicator as Bibliophile, in sepia ink.
- The hold-arc is sepia ink, 1.6px wide. Slightly thinner than Bibliophile's gilt arc, no glow but a faint paper texture. Cartographer's arc looks like ink being drawn on paper.
- On commit, **a copper push-pin descends from above** and presses into the tile, fixing it onto the map. Same 220ms timing, same `cubic-bezier(0.4, 0, 0.2, 1)`. The pin lands with a small "pin shadow" appearing underneath — a 2px soft shadow.
- The post-commit breathing is replaced with a subtle **inked ripple** — a faint sepia ring expands outward from the pin once per cycle, suggesting drying ink. 3s cycle, same as Bibliophile's plate breathing.
- The "release to continue" line becomes "*release to continue*" (Cartographer-italic lowercase, no period — same as Bibliophile, different typeface).

### 3.4 Era summary

Same three-frame structure. Replace:

- The open-spread book becomes a **journal leaf** — a single sheet of vellum with hand-ruled grid, the era's plate (AI-painted) hanging from a thin pin at top, the era's date range in mono-style notation, and the narrative entry below.
- The brush wipe becomes an **ink wash**: the era's plate fills in like sepia ink dropped onto wet paper, spreading outward from one corner. 1400ms, same timing as Bibliophile's brush wipe.
- A small compass rose draws itself in a corner of the leaf as the plate completes (300ms, hand-sketched style).
- Stats use mono notation:
  ```
  // 73 surveys
  // 14 finds
  // ★★★★★ forge
  // ★★★★ city-state
  ```
- "Begin Chapter [next] →" becomes "*turn to leaf [next] →*" (Cartographer-italic lowercase).

### 3.5 Library

Cartographer has a unique opportunity for an alternate library layout — **the atlas** (described in Section 9 below). Recommendation: ship the standard 6×4 grid for v1 to match shared architecture; revisit the atlas layout if Cartographer becomes the most-played theme.

For the standard grid:

- 24 framed pieces in 6×4, each shown as a small pinned card on a vellum sheet.
- Per-chapter color is the pin's wax-seal color (varying per the seed bank above).
- The grid background shows faint hand-ruled lines.
- Below the grid: "**// 24 finds · the cartographer's atlas**"

When the player taps a tile, the pull-up sheet uses Cartographer's framing: a small leaf showing the pin, the find's name in italic Garamond, the entry text below in journal-narrative voice.

**Wall-full state:** label changes to "**// 24 finds · atlas complete**." Counter shifts to copper accent (the Cartographer equivalent of Bibliophile's gilt counter).

### 3.6 Retirement ceremony

Framing changes from "send it onward" to **"return it to the territory"** or **"unmark from the map."**

The four-frame structure is identical. Visual deltas:

- The new tile suspended above the wall is shown as a small pinned card with a copper pin and a faint compass-rose glow underneath (the Cartographer equivalent of Bibliophile's gilt halo).
- "twenty-four spaces. one must yield." → "*twenty-four pins. one must come down.*"
- "hold a tile to give it back" → "*hold to unpin*"
- The dispersal animation: the retiring tile's pin lifts out of the paper (small upward animation, 200ms), then the tile dissolves into ink-points that drift up and fade — same wax-droplet primitive as Bibliophile, but the ink-points are sepia (`#3a2818`) instead of gilt.
- The cello descent (C2 → G1) plays unchanged.

**Wall-full first-time copy.** Bari speaks once, only here, in Cartographer-italic margin text:

> *an atlas is what we have charted. press a pin to return its place to the world.*

Same structural framing as Bibliophile's line. Lowercase italic.

### 3.7 Vault → Expedition Log

The vault is renamed the **Expedition Log**. Visually:

- Vertical scrolling list of small entries.
- Each entry shows: chapter Roman numeral, run number ("expedition 2"), retire date, and a faint "unpinned" marker (a small empty circle where the pin was, no fill).
- No image, no name, no narrative — same information loss as Bibliophile's vault.
- Tap an entry → "*unpinned · expedition [N] · leaf [roman] · [date].*"
- Header: "**// the expedition log**"

Same data stored, same retrieval rule (none); different framing.

### 3.8 Run end

After the eleventh bind ceremony's clasp completes, hold ~600ms, then a **wax seal** stamps onto the strip's center. This is the closest of the three theme run-end seals to Bibliophile's — Cartographer also uses red wax, because wax seals were used on charts and journals as well as on official documents.

But the seal is different in its details:

- Slightly more irregular shape (wax was poured by hand, on paper, often misshapen).
- Engraved gilt motif is a **compass rose**, not a letter "A."
- Three small wax droplets fan out and fade.
- The wax has a faint paper-fiber texture, suggesting it sealed a real paper edge.

Audio: **distant ship's bell** instead of cathedral bell. Same ~110Hz fundamental, same 4s tail. The ship's bell suggests the journal has been brought back from a voyage — the survey is complete.

The "Age of Plenty" overlay rises with text in italic Garamond:

> *— Run complete —*
>
> ## *The Age of Plenty*
>
> *a territory no one else has charted*
>
> *// 643 surveys · 11 leaves · 4h 12m*

---

## 4. Motion deltas

Five primitives change. The other nine are shared with Bibliophile.

| Primitive | Bibliophile | Cartographer |
|---|---|---|
| Brass clasp | Two horizontal rects slide ±20px from sides | A single copper push-pin descends from above 20px and presses into the tile |
| Page turn | 2D peel from right edge (700ms) | 3D fold left over right (800ms — old paper has more give) |
| Brush wipe | Clip-path inset 100% → 0%, +4px drift | Ink wash: radial gradient expands from a corner, suggesting wet sepia ink spreading on dry paper |
| Cube bloom | Fill `#3a2818` → tile face | Pin descent: small pinned card lands on the cube from above with a 200ms fall + 100ms settle |
| Ink-bloom | Scale 0 → 1, fill expands | Outline-then-fill: thin sepia outline draws first (300ms), then emoji and label fade in (300ms). Reads as the tile being sketched. |

Shared timings preserved where stated; page turn extended to 800ms reflects paper weight.

**Three Cartographer-specific motion notes:**

1. The post-commit ink ripple replaces plate breathing. A faint sepia ring expands once per 3s cycle from the bound pin, fades, and repeats. Suggests drying ink.
2. Compass roses occasionally **rotate slowly** when the player is idle for >30s. A small flourish, like a real compass needle settling. Once per minute, 4-second slow rotation.
3. Bari's hammer-rotation in the patient pose becomes a **map-rolling** gesture: he rolls up a small parchment in his lap, then unrolls it, then rolls it again. Same 800ms total timing, different prop interaction.

---

## 5. Audio deltas

Music layer shared. Eight texture cues swap.

| Cue | Bibliophile | Cartographer |
|---|---|---|
| Combine resolve | Woody knock (~120ms, −18 LUFS) | Quill nib on paper (~120ms, −18 LUFS, slightly higher pitched than the knock) |
| Combine impossible | Soft inkwell tap (~80ms, −24 LUFS) | Pen-cap-on-paper (~80ms, −24 LUFS) |
| Era goal met | Singing bowl (~196Hz, 1.4s, −16 LUFS) | Brass sextant click + a single low tone (~180Hz, 1.4s combined, −16 LUFS) |
| Tile bound (clasp snap) | Leather press + brass click + cello tonic (340ms, −14 LUFS) | Push-pin into cork + a faint paper-creak + cello tonic (340ms, −14 LUFS) |
| Page turn | Old paper rustle (700ms, −20 LUFS) | Parchment fold (800ms, −20 LUFS — heavier paper sound) |
| Tapestry painting | Brush-on-canvas loop (1.4s, −26 LUFS) | Quill-scratch loop + ink-drying (1.4s, −26 LUFS) |
| Run sealed (cathedral bell) | Cathedral bell, low (~110Hz, 4s, −12 LUFS) | Ship's bell, low (~110Hz, 4s, −12 LUFS, with slight rocking decay) |
| Workshop room tone | Fire crackle + distant wind (loop, −25 LUFS) | Wind through canvas + distant gulls + faint creak of wooden equipment (loop, −25 LUFS) |

Loudness budget identical. Cello cues identical.

**Two Cartographer-specific audio notes:**

1. The combine-resolve quill scratch is the most obviously theme-distinct sound of the three. Where Bibliophile sounds like wood and Curator sounds like brass, Cartographer sounds like paper-and-ink. This is a signature.
2. The ship's bell at run-end has a slight tremolo — a 0.3 Hz pitch wobble of ±2 cents — suggesting the bell hangs on a moving ship. Subtle, not seasick. Adds maritime atmosphere without becoming a gimmick.

---

## 6. Bari · the apprentice surveyor

Same character, same four poses (idle, approval nod, wonder/leaning in, patient), same silence rule, same painted style.

**Costume changes:**

- A worn waistcoat over a simple linen shirt (replacing leather smock).
- Tall boots, slightly muddy.
- A small brass spyglass at his hip, or a compass on a chain.
- His hammer is replaced with a **brass surveyor's compass** or a **small spyglass**.
- A wide-brimmed hat sometimes — though more often he holds it in his lap.

**Pose differences:**

- Idle: he sits cross-legged with the spyglass in his lap, occasionally turns his head to follow the player's drag. Same 8° tracking, same 2.4s breath cycle.
- Approval nod: head dip -6°, holds 240ms. Identical to Bibliophile.
- Wonder/leaning in: he raises the spyglass to his eye briefly, as if studying something the player just did. Same ~1.5s hold; the spyglass is the prop change.
- Patient: rolls and unrolls a small parchment map, slowly. Same 800ms cycle.

**Bari's location:** lower-left margin, sitting on what looks like the edge of a wooden crate or a folded canvas — outdoors, not in a workshop, not in a gallery. The implication is "we're at a field camp."

**Bari's one line of speech** (first wall-full retirement only):

> *an atlas is what we have charted. press a pin to return its place to the world.*

Lowercase italic. Never repeats.

---

## 7. Cartographer-specific copy

Word substitutions reflecting the surveyor voice.

| Bibliophile | Cartographer |
|---|---|
| Codex | Atlas |
| Bind a piece into your codex | Pin a find to your atlas |
| Bound to your codex | Pinned to your atlas |
| Your library | Your atlas |
| Your shelf is full | Your atlas is complete |
| Send it onward | Return it to the territory / unpin |
| Vault | Expedition Log |
| Card Catalog (inventory) | Discoveries (sidebar) |
| The writing desk | The journal |
| Chapter | Leaf |
| Begin Chapter IV → | turn to leaf IV → |
| Run | Expedition |
| Age of Plenty | Age of Plenty (unchanged) |

The chapter → leaf substitution is the most pervasive change. Roman numerals stay (I–XI), but the noun shifts. "Leaf III · Bronze Age" reads as a journal page, not a book chapter.

---

## 8. Run-end seal

A red wax seal with an engraved gilt **compass rose** in the center.

- Red wax circle, 28×28px on the strip's center, slightly irregular shape (wax variation).
- Engraved gilt compass rose: four cardinal points with one slightly elongated (suggesting "north" — a real cartographic convention).
- Three small wax droplets fan out and fade, same as Bibliophile's wax stamp.
- The wax has a faint paper-fiber texture in its border.

Stamps onto the strip with the same 320ms overshoot as Bibliophile's wax stamp. Audio is the ship's bell described in Section 5.

The seal sits on top of the strip's eleven cubes, partially covering chapters V and VI. The cubes are unchanged underneath; the seal is the run's signature, the strip its content.

---

## 9. The atlas

A Cartographer-only library variant for v1.1+. Defer for now; capture the design here.

**The standard library** (described in Section 3.5 above) shows 24 finds in a 6×4 grid on a single vellum page. This is what ships in v1.

**The atlas variant** would show the library as a multi-page atlas:

- Each leaf of the atlas is a single vellum page showing one expedition's worth of finds (up to 11 pins per leaf, the eleven chapters).
- The atlas accumulates leaves as the player completes runs. After 4 runs, the atlas has 4 leaves.
- The 24-tile retirement limit still applies — but instead of showing as a full grid, retirement happens to the oldest leaves first (the player chooses *which* old leaf-pin to retire, but only old leaves are eligible).
- Pages in the atlas can be flipped through, like turning the leaves of a real journal.

This is more cohesive with the Cartographer metaphor and more spatially distinct from Bibliophile's shelf or Curator's wall. But it changes the retirement mechanic in subtle ways — old expeditions become more eligible for retirement than recent ones — which is meaningful and would need playtesting.

**Recommendation:** ship the standard 6×4 grid in v1. Revisit the atlas variant for v1.1 if Cartographer is popular and benefits from theme-specific differentiation. Note this in v1 spec as deferred scope.

---

## 10. Open questions

### Should the master map persist across runs?

Currently: each run's bind ceremonies pin tiles onto a fresh "master map" for that run, and the run's master map is shown in the era summary or at run-end as a kind of journal page.

Alternative: a single persistent **master map** accumulates pins across all the player's runs forever. Every kept tile gets a permanent location on this shared map. Over time, the map fills up — a record of everything the player has ever charted.

Pros: deeply cohesive with the Cartographer metaphor. The player ends up with a real, growing map. Visual progression beyond the library.
Cons: requires a coordinate system (where does each pin go on the map?), which is a meaningful design problem. Possibly procedurally generated, possibly hand-curated for chapter eras.

Recommendation: defer, but note for v1.1+. The persistent master map is a strong differentiator if it can be designed well.

### Should compass roses appear on the strip?

The strip's eleven cubes could each show a small compass-rose stamp instead of (or in addition to) a Roman numeral. This pushes the cartographic identity hard but might over-decorate.

Recommendation: try in playtest. If the strip already reads as cartographic with the pinned-tile cubes, skip the compass roses. If it feels too generic, add them.

### Should sea monsters / margin flourishes ever appear during normal play?

Real cartographers drew sea monsters and embellishments in the margins of maps. Cartographer could occasionally show a tiny sketched flourish in the margin of a journal leaf during quiet moments — a sea serpent for a maritime chapter, a small dragon for a mythical era, a bird for a forest era.

This is the kind of detail that lands on long-time players without being intrusive. Once per run, in a relevant era, in a margin where it doesn't compete with content.

Recommendation: yes, in v1, but very rare. Once per run maximum. The art is small (~30×30px each), the variety can start small and grow with content.

### Should the date range be real?

The era summary currently shows real historical date ranges ("3300–1200 BCE" for Bronze Age). Cartographer's surveyor voice could use this naturally — surveyors record dates. Bibliophile and Curator both keep this convention.

But the AI's generated chapters may not always map cleanly to real dates. The date range may need to be more impressionistic ("late bronze," "the iron century") or omitted in some cases.

Recommendation: start with real historical dates where they fit, fall back to era names when they don't. The mono-formatted date range is a strong Cartographer signature; preserve the convention.


## Visual reference

*Mobile-first mockups from early design exploration. These show the Cartographer direction at four key surfaces: mid-combine play screen (the journal), the leaf-complete bind moment, the era-summary plate reveal, and the atlas view across expeditions. The mockups predate some refinements (e.g. the strip-as-inventory mechanic, the four-beat chapter end) but capture the Cartographer visual language.*

<p><strong>Mid-combine · the journal</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 220 440" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;border-radius:22px;">
          <defs>
            <pattern id="c-grid" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#f0e6cf"/><line x1="0" y1="14" x2="14" y2="14" stroke="#3a2818" stroke-width="0.15" opacity="0.3"/><line x1="14" y1="0" x2="14" y2="14" stroke="#3a2818" stroke-width="0.15" opacity="0.3"/></pattern>
          </defs>
          <rect width="220" height="440" fill="url(#c-grid)"/>
          <text x="20" y="32" font-family="EB Garamond, Georgia, serif" font-size="13" font-style="italic" fill="#3a2818">Leaf III · Bronze</text>
          <text x="200" y="32" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="8" fill="#7a3e2a" letter-spacing="1">3300–1200 BCE</text>
          <line x1="20" y1="38" x2="200" y2="38" stroke="#3a2818" stroke-width="0.4"/>
          <text x="20" y="56" font-family="IBM Plex Mono, monospace" font-size="8" fill="#7a3e2a" letter-spacing="1">// surveys to complete</text>
          <text x="20" y="72" font-family="EB Garamond, serif" font-size="11" fill="#3a2818">✓ smelt copper      ✓ build a city</text>
          <text x="20" y="86" font-family="EB Garamond, serif" font-size="11" fill="#7a3e2a">○ forge alloy        ○ write laws</text>
          <line x1="20" y1="98" x2="200" y2="98" stroke="#3a2818" stroke-width="0.2" stroke-dasharray="2 2"/>
          <text x="20" y="116" font-family="IBM Plex Mono, monospace" font-size="8" fill="#7a3e2a" letter-spacing="1">// the journal</text>
          <g transform="translate(40, 130)">
            <rect width="50" height="62" fill="#f0e6cf" stroke="#3a2818" stroke-width="0.6"/>
            <text x="25" y="34" text-anchor="middle" font-size="22">🔥</text>
            <text x="25" y="50" text-anchor="middle" font-family="EB Garamond, serif" font-size="9" font-style="italic" fill="#3a2818">fire</text>
            <text x="25" y="58" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="6" fill="#7a3e2a">★★ · t.2</text>
            <circle cx="46" cy="6" r="2" fill="#7a3e2a"/>
          </g>
          <g transform="translate(120, 154)" opacity="0.85">
            <rect width="50" height="62" fill="#f0e6cf" stroke="#1d5e6e" stroke-width="1.5"/>
            <text x="25" y="34" text-anchor="middle" font-size="22">🪨</text>
            <text x="25" y="50" text-anchor="middle" font-family="EB Garamond, serif" font-size="9" font-style="italic" fill="#3a2818">copper</text>
            <text x="25" y="58" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="6" fill="#7a3e2a">★★★ · t.3</text>
            <circle cx="46" cy="6" r="2" fill="#1d5e6e"/>
          </g>
          <path d="M 90 160 Q 110 180 120 184" stroke="#1d5e6e" stroke-width="0.8" fill="none" stroke-dasharray="2 2"/>
          <line x1="20" y1="226" x2="200" y2="226" stroke="#3a2818" stroke-width="0.2" stroke-dasharray="2 2"/>
          <text x="20" y="244" font-family="IBM Plex Mono, monospace" font-size="8" fill="#7a3e2a" letter-spacing="1">// pinned discoveries</text>
          <g transform="translate(20, 254)"><rect width="44" height="34" fill="#f0e6cf" stroke="#3a2818" stroke-width="0.4"/><text x="22" y="20" text-anchor="middle" font-size="14">🌊</text><text x="22" y="30" text-anchor="middle" font-family="EB Garamond, serif" font-size="7" font-style="italic" fill="#3a2818">water</text><circle cx="40" cy="4" r="1.5" fill="#7a3e2a"/></g>
          <g transform="translate(68, 254)"><rect width="44" height="34" fill="#f0e6cf" stroke="#3a2818" stroke-width="0.4"/><text x="22" y="20" text-anchor="middle" font-size="14">🌾</text><text x="22" y="30" text-anchor="middle" font-family="EB Garamond, serif" font-size="7" font-style="italic" fill="#3a2818">wheat</text><circle cx="40" cy="4" r="1.5" fill="#7a3e2a"/></g>
          <g transform="translate(116, 254)"><rect width="44" height="34" fill="#f0e6cf" stroke="#3a2818" stroke-width="0.4"/><text x="22" y="20" text-anchor="middle" font-size="14">🏛</text><text x="22" y="30" text-anchor="middle" font-family="EB Garamond, serif" font-size="7" font-style="italic" fill="#3a2818">temple</text><circle cx="40" cy="4" r="1.5" fill="#7a3e2a"/></g>
          <g transform="translate(164, 254)"><rect width="44" height="34" fill="#f0e6cf" stroke="#3a2818" stroke-width="0.4"/><text x="22" y="20" text-anchor="middle" font-size="14">📜</text><text x="22" y="30" text-anchor="middle" font-family="EB Garamond, serif" font-size="7" font-style="italic" fill="#3a2818">edict</text><circle cx="40" cy="4" r="1.5" fill="#7a3e2a"/></g>
          <g transform="translate(20, 294)"><rect width="44" height="34" fill="#f0e6cf" stroke="#3a2818" stroke-width="0.4"/><text x="22" y="20" text-anchor="middle" font-size="14">⚱</text><text x="22" y="30" text-anchor="middle" font-family="EB Garamond, serif" font-size="7" font-style="italic" fill="#3a2818">urn</text><circle cx="40" cy="4" r="1.5" fill="#7a3e2a"/></g>
          <g transform="translate(68, 294)"><rect width="44" height="34" fill="#f0e6cf" stroke="#3a2818" stroke-width="0.4"/><text x="22" y="20" text-anchor="middle" font-size="14">🏺</text><text x="22" y="30" text-anchor="middle" font-family="EB Garamond, serif" font-size="7" font-style="italic" fill="#3a2818">amphora</text><circle cx="40" cy="4" r="1.5" fill="#7a3e2a"/></g>
          <g transform="translate(116, 294)"><rect width="44" height="34" fill="#f0e6cf" stroke="#3a2818" stroke-width="0.4"/><text x="22" y="20" text-anchor="middle" font-size="14">🛡</text><text x="22" y="30" text-anchor="middle" font-family="EB Garamond, serif" font-size="7" font-style="italic" fill="#3a2818">shield</text><circle cx="40" cy="4" r="1.5" fill="#7a3e2a"/></g>
          <g transform="translate(164, 294)"><rect width="44" height="34" fill="#f0e6cf" stroke="#3a2818" stroke-width="0.4"/><text x="22" y="20" text-anchor="middle" font-size="14">🐎</text><text x="22" y="30" text-anchor="middle" font-family="EB Garamond, serif" font-size="7" font-style="italic" fill="#3a2818">horse</text><circle cx="40" cy="4" r="1.5" fill="#7a3e2a"/></g>
          <line x1="20" y1="346" x2="200" y2="346" stroke="#3a2818" stroke-width="0.2" stroke-dasharray="2 2"/>
          <text x="20" y="364" font-family="IBM Plex Mono, monospace" font-size="8" fill="#7a3e2a" letter-spacing="1">// the master map</text>
          <g transform="translate(20, 374)">
            <rect width="180" height="40" fill="#f0e6cf" stroke="#3a2818" stroke-width="0.4"/>
            <circle cx="14" cy="20" r="6" fill="#7a3e2a"/><text x="14" y="23" text-anchor="middle" font-size="8">🔥</text>
            <circle cx="30" cy="20" r="6" fill="#5a4528"/><text x="30" y="23" text-anchor="middle" font-size="8">🌾</text>
            <circle cx="46" cy="20" r="7" fill="#b8732a" stroke="#3a2818" stroke-width="0.5"/><text x="46" y="23" text-anchor="middle" font-size="9">⚒</text>
            <circle cx="62" cy="20" r="4" fill="none" stroke="#3a2818" stroke-width="0.5" stroke-dasharray="1 1"/>
            <circle cx="78" cy="20" r="4" fill="none" stroke="#3a2818" stroke-width="0.5" stroke-dasharray="1 1"/>
            <circle cx="94" cy="20" r="4" fill="none" stroke="#3a2818" stroke-width="0.5" stroke-dasharray="1 1"/>
            <circle cx="110" cy="20" r="4" fill="none" stroke="#3a2818" stroke-width="0.5" stroke-dasharray="1 1"/>
            <circle cx="126" cy="20" r="4" fill="none" stroke="#3a2818" stroke-width="0.5" stroke-dasharray="1 1"/>
            <circle cx="142" cy="20" r="4" fill="none" stroke="#3a2818" stroke-width="0.5" stroke-dasharray="1 1"/>
            <circle cx="158" cy="20" r="4" fill="none" stroke="#3a2818" stroke-width="0.5" stroke-dasharray="1 1"/>
            <path d="M 14 20 Q 22 14 30 20" stroke="#3a2818" stroke-width="0.4" fill="none"/>
            <path d="M 30 20 Q 38 14 46 20" stroke="#3a2818" stroke-width="0.4" fill="none"/>
          </g>
          <text x="110" y="430" text-anchor="middle" font-family="EB Garamond, serif" font-size="9" font-style="italic" fill="#7a3e2a">— terra incognita beyond —</text>
        </svg>

</div>

<p><strong>Leaf complete · pin a find</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 220 440" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;border-radius:22px;">
          <defs>
            <pattern id="c-grid2" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#f0e6cf"/><line x1="0" y1="14" x2="14" y2="14" stroke="#3a2818" stroke-width="0.15" opacity="0.3"/><line x1="14" y1="0" x2="14" y2="14" stroke="#3a2818" stroke-width="0.15" opacity="0.3"/></pattern>
          </defs>
          <rect width="220" height="440" fill="url(#c-grid2)"/>
          <text x="20" y="32" font-family="EB Garamond, serif" font-size="13" font-style="italic" fill="#3a2818">Leaf III · surveyed</text>
          <text x="200" y="32" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="8" fill="#7a3e2a">✓ COMPLETE</text>
          <line x1="20" y1="38" x2="200" y2="38" stroke="#3a2818" stroke-width="0.4"/>
          <text x="20" y="56" font-family="IBM Plex Mono, monospace" font-size="8" fill="#7a3e2a" letter-spacing="1">// all surveys filed</text>
          <text x="20" y="72" font-family="EB Garamond, serif" font-size="11" fill="#3a2818">✓ copper  ✓ city  ✓ alloy  ✓ laws</text>
          <line x1="20" y1="86" x2="200" y2="86" stroke="#3a2818" stroke-width="0.2" stroke-dasharray="2 2"/>
          <text x="110" y="108" text-anchor="middle" font-family="EB Garamond, serif" font-size="11" font-style="italic" fill="#3a2818">— pin one find to the master map —</text>
          <path d="M 110 118 L 110 142" stroke="#b8732a" stroke-width="1" stroke-dasharray="2 2"/>
          <path d="M 104 136 L 110 144 L 116 136" stroke="#b8732a" stroke-width="1" fill="none"/>
          <rect x="60" y="148" width="100" height="74" fill="#f0e6cf" stroke="#b8732a" stroke-width="2"/>
          <circle cx="110" cy="160" r="3" fill="#b8732a"/>
          <text x="110" y="190" text-anchor="middle" font-family="EB Garamond, serif" font-size="10" font-style="italic" fill="#7a3e2a">drop a discovery</text>
          <text x="110" y="206" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="7" fill="#7a3e2a">// to keep forever</text>
          <line x1="20" y1="240" x2="200" y2="240" stroke="#3a2818" stroke-width="0.2" stroke-dasharray="2 2"/>
          <text x="20" y="258" font-family="IBM Plex Mono, monospace" font-size="8" fill="#7a3e2a">// from this leaf</text>
          <g transform="translate(20, 268)"><rect width="40" height="34" fill="#f0e6cf" stroke="#3a2818" stroke-width="0.4"/><text x="20" y="20" text-anchor="middle" font-size="14">🌾</text><text x="20" y="30" text-anchor="middle" font-family="EB Garamond, serif" font-size="6" font-style="italic" fill="#3a2818">wheat</text></g>
          <g transform="translate(64, 268)"><rect width="40" height="34" fill="#f0e6cf" stroke="#3a2818" stroke-width="0.4"/><text x="20" y="20" text-anchor="middle" font-size="14">🏛</text><text x="20" y="30" text-anchor="middle" font-family="EB Garamond, serif" font-size="6" font-style="italic" fill="#3a2818">temple</text></g>
          <g transform="translate(108, 268)"><rect width="40" height="34" fill="#f0e6cf" stroke="#b8732a" stroke-width="1.5"/><text x="20" y="20" text-anchor="middle" font-size="14">⚒</text><text x="20" y="30" text-anchor="middle" font-family="EB Garamond, serif" font-size="6" font-style="italic" fill="#3a2818">forge</text></g>
          <g transform="translate(152, 268)"><rect width="40" height="34" fill="#f0e6cf" stroke="#3a2818" stroke-width="0.4"/><text x="20" y="20" text-anchor="middle" font-size="14">📜</text><text x="20" y="30" text-anchor="middle" font-family="EB Garamond, serif" font-size="6" font-style="italic" fill="#3a2818">edict</text></g>
          <g transform="translate(20, 308)"><rect width="40" height="34" fill="#f0e6cf" stroke="#3a2818" stroke-width="0.4"/><text x="20" y="20" text-anchor="middle" font-size="14">⚱</text><text x="20" y="30" text-anchor="middle" font-family="EB Garamond, serif" font-size="6" font-style="italic" fill="#3a2818">urn</text></g>
          <g transform="translate(64, 308)"><rect width="40" height="34" fill="#f0e6cf" stroke="#3a2818" stroke-width="0.4"/><text x="20" y="20" text-anchor="middle" font-size="14">🏺</text><text x="20" y="30" text-anchor="middle" font-family="EB Garamond, serif" font-size="6" font-style="italic" fill="#3a2818">amphora</text></g>
          <g transform="translate(108, 308)"><rect width="40" height="34" fill="#f0e6cf" stroke="#3a2818" stroke-width="0.4"/><text x="20" y="20" text-anchor="middle" font-size="14">🛡</text><text x="20" y="30" text-anchor="middle" font-family="EB Garamond, serif" font-size="6" font-style="italic" fill="#3a2818">shield</text></g>
          <g transform="translate(152, 308)"><rect width="40" height="34" fill="#f0e6cf" stroke="#3a2818" stroke-width="0.4"/><text x="20" y="20" text-anchor="middle" font-size="14">🐎</text><text x="20" y="30" text-anchor="middle" font-family="EB Garamond, serif" font-size="6" font-style="italic" fill="#3a2818">horse</text></g>
          <rect x="40" y="376" width="140" height="32" fill="#f0e6cf" stroke="#7a3e2a" stroke-width="0.6" stroke-dasharray="3 2" opacity="0.6"/>
          <text x="110" y="396" text-anchor="middle" font-family="EB Garamond, serif" font-size="11" font-style="italic" fill="#7a3e2a">turn the page  →</text>
        </svg>

</div>

<p><strong>Era summary · the plate</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 220 440" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;border-radius:22px;">
          <defs>
            <pattern id="c-grid3" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#f0e6cf"/><line x1="0" y1="14" x2="14" y2="14" stroke="#3a2818" stroke-width="0.15" opacity="0.3"/><line x1="14" y1="0" x2="14" y2="14" stroke="#3a2818" stroke-width="0.15" opacity="0.3"/></pattern>
          </defs>
          <rect width="220" height="440" fill="url(#c-grid3)"/>
          <g transform="translate(176, 36)">
            <circle r="14" fill="none" stroke="#3a2818" stroke-width="0.5"/>
            <path d="M 0 -14 L 0 14 M -14 0 L 14 0" stroke="#3a2818" stroke-width="0.5"/>
            <path d="M 0 -14 L 3 0 L 0 14 L -3 0 Z" fill="#b8732a" opacity="0.6"/>
            <text y="-20" text-anchor="middle" font-family="EB Garamond, serif" font-size="7" font-style="italic" fill="#3a2818">N</text>
          </g>
          <text x="20" y="42" font-family="EB Garamond, serif" font-size="9" font-style="italic" fill="#7a3e2a">— Leaf III —</text>
          <text x="20" y="62" font-family="EB Garamond, serif" font-size="16" fill="#3a2818">The Bronze Age</text>
          <line x1="20" y1="70" x2="160" y2="70" stroke="#3a2818" stroke-width="0.4"/>
          <rect x="20" y="84" width="180" height="120" fill="#5a4528" stroke="#3a2818" stroke-width="1"/>
          <rect x="24" y="88" width="172" height="112" fill="#7a3e2a" opacity="0.7"/>
          <text x="110" y="148" text-anchor="middle" font-family="EB Garamond, serif" font-size="9" font-style="italic" fill="#f0e6cf">[ AI-painted plate ]</text>
          <circle cx="32" cy="96" r="3" fill="#b8732a"/>
          <circle cx="188" cy="96" r="3" fill="#b8732a"/>
          <circle cx="32" cy="192" r="3" fill="#b8732a"/>
          <circle cx="188" cy="192" r="3" fill="#b8732a"/>
          <text x="110" y="226" text-anchor="middle" font-family="EB Garamond, serif" font-size="11" font-style="italic" fill="#3a2818">"Smoke from a hundred furnaces.</text>
          <text x="110" y="240" text-anchor="middle" font-family="EB Garamond, serif" font-size="11" font-style="italic" fill="#3a2818">A king learns the weight of laws."</text>
          <line x1="20" y1="254" x2="200" y2="254" stroke="#3a2818" stroke-width="0.2" stroke-dasharray="2 2"/>
          <text x="32" y="272" font-family="IBM Plex Mono, monospace" font-size="8" fill="#7a3e2a">73 surveys</text>
          <text x="32" y="286" font-family="IBM Plex Mono, monospace" font-size="8" fill="#7a3e2a">14 finds</text>
          <text x="120" y="272" font-family="IBM Plex Mono, monospace" font-size="8" fill="#7a3e2a">★★★★★ forge</text>
          <text x="120" y="286" font-family="IBM Plex Mono, monospace" font-size="8" fill="#7a3e2a">★★★★ city-state</text>
          <line x1="20" y1="298" x2="200" y2="298" stroke="#3a2818" stroke-width="0.2" stroke-dasharray="2 2"/>
          <text x="110" y="316" text-anchor="middle" font-family="EB Garamond, serif" font-size="10" font-style="italic" fill="#7a3e2a">pinned to the master map</text>
          <g transform="translate(86, 326)">
            <rect width="48" height="44" fill="#f0e6cf" stroke="#b8732a" stroke-width="1.5"/>
            <text x="24" y="28" text-anchor="middle" font-size="20">⚒</text>
            <text x="24" y="40" text-anchor="middle" font-family="EB Garamond, serif" font-size="7" font-style="italic" fill="#3a2818">forge</text>
            <circle cx="44" cy="4" r="2" fill="#b8732a"/>
          </g>
          <rect x="40" y="386" width="140" height="32" fill="#3a2818"/>
          <text x="110" y="406" text-anchor="middle" font-family="EB Garamond, serif" font-size="11" font-style="italic" fill="#f0e6cf">turn to leaf IV  →</text>
        </svg>

</div>

<p><strong>The atlas across expeditions</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 220 440" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;border-radius:22px;">
          <defs>
            <pattern id="c-grid4" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#f0e6cf"/><line x1="0" y1="14" x2="14" y2="14" stroke="#3a2818" stroke-width="0.15" opacity="0.3"/><line x1="14" y1="0" x2="14" y2="14" stroke="#3a2818" stroke-width="0.15" opacity="0.3"/></pattern>
          </defs>
          <rect width="220" height="440" fill="url(#c-grid4)"/>
          <text x="110" y="32" text-anchor="middle" font-family="EB Garamond, serif" font-size="14" font-style="italic" fill="#3a2818">The Atlas</text>
          <text x="110" y="46" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="8" fill="#7a3e2a" letter-spacing="1">4 EXPEDITIONS · 44 PINS · 12 PLATES</text>
          <line x1="20" y1="56" x2="200" y2="56" stroke="#3a2818" stroke-width="0.4"/>
          <text x="20" y="74" font-family="IBM Plex Mono, monospace" font-size="8" fill="#7a3e2a">// expedition 1</text>
          <rect x="20" y="80" width="180" height="60" fill="#f0e6cf" stroke="#3a2818" stroke-width="0.4"/>
          <line x1="30" y1="110" x2="190" y2="110" stroke="#1d5e6e" stroke-width="0.6" stroke-dasharray="3 2" opacity="0.5"/>
          <circle cx="34" cy="110" r="6" fill="#7a3e2a"/><text x="34" y="113" text-anchor="middle" font-size="8">🔥</text>
          <circle cx="48" cy="110" r="6" fill="#5a4528"/><text x="48" y="113" text-anchor="middle" font-size="8">🌾</text>
          <circle cx="62" cy="110" r="7" fill="#b8732a" stroke="#3a2818" stroke-width="0.5"/><text x="62" y="113" text-anchor="middle" font-size="9">⚒</text>
          <circle cx="76" cy="110" r="6" fill="#3a2818"/><text x="76" y="113" text-anchor="middle" font-size="8">📜</text>
          <circle cx="90" cy="110" r="6" fill="#1d5e6e"/><text x="90" y="113" text-anchor="middle" font-size="8">⛵</text>
          <circle cx="104" cy="110" r="6" fill="#5a4528"/><text x="104" y="113" text-anchor="middle" font-size="8">📖</text>
          <circle cx="118" cy="110" r="6" fill="#7a3e2a"/><text x="118" y="113" text-anchor="middle" font-size="8">⚙</text>
          <circle cx="132" cy="110" r="6" fill="#5a4528"/><text x="132" y="113" text-anchor="middle" font-size="8">💡</text>
          <circle cx="146" cy="110" r="7" fill="#b8732a" stroke="#3a2818" stroke-width="0.5"/><text x="146" y="113" text-anchor="middle" font-size="9">⚛</text>
          <circle cx="160" cy="110" r="6" fill="#3a2818"/><text x="160" y="113" text-anchor="middle" font-size="8">🛰</text>
          <circle cx="174" cy="110" r="6" fill="#7a3e2a"/><text x="174" y="113" text-anchor="middle" font-size="8">🪐</text>
          <text x="110" y="132" text-anchor="middle" font-family="EB Garamond, serif" font-size="8" font-style="italic" fill="#7a3e2a">stone → space · 11 leaves</text>
          <text x="20" y="158" font-family="IBM Plex Mono, monospace" font-size="8" fill="#7a3e2a">// expedition 2</text>
          <rect x="20" y="164" width="180" height="60" fill="#f0e6cf" stroke="#3a2818" stroke-width="0.4"/>
          <line x1="30" y1="194" x2="170" y2="194" stroke="#1d5e6e" stroke-width="0.6" stroke-dasharray="3 2" opacity="0.5"/>
          <circle cx="34" cy="194" r="6" fill="#1d5e6e"/><text x="34" y="197" text-anchor="middle" font-size="8">🌊</text>
          <circle cx="48" cy="194" r="6" fill="#7a3e2a"/><text x="48" y="197" text-anchor="middle" font-size="8">🏹</text>
          <circle cx="62" cy="194" r="6" fill="#3a2818"/><text x="62" y="197" text-anchor="middle" font-size="8">🐎</text>
          <circle cx="76" cy="194" r="7" fill="#b8732a" stroke="#3a2818" stroke-width="0.5"/><text x="76" y="197" text-anchor="middle" font-size="9">🗡</text>
          <circle cx="90" cy="194" r="6" fill="#5a4528"/><text x="90" y="197" text-anchor="middle" font-size="8">⚖</text>
          <circle cx="104" cy="194" r="6" fill="#7a3e2a"/><text x="104" y="197" text-anchor="middle" font-size="8">🕯</text>
          <circle cx="118" cy="194" r="6" fill="#3a2818"/><text x="118" y="197" text-anchor="middle" font-size="8">⚙</text>
          <circle cx="132" cy="194" r="6" fill="#5a4528"/><text x="132" y="197" text-anchor="middle" font-size="8">🚂</text>
          <circle cx="146" cy="194" r="6" fill="#7a3e2a"/><text x="146" y="197" text-anchor="middle" font-size="8">📺</text>
          <text x="110" y="216" text-anchor="middle" font-family="EB Garamond, serif" font-size="8" font-style="italic" fill="#7a3e2a">jōmon → reiwa · 9 leaves</text>
          <line x1="20" y1="240" x2="200" y2="240" stroke="#3a2818" stroke-width="0.2" stroke-dasharray="2 2"/>
          <text x="20" y="258" font-family="IBM Plex Mono, monospace" font-size="8" fill="#7a3e2a">// plates</text>
          <g transform="translate(20, 266)"><rect width="56" height="42" fill="#a8794a" stroke="#3a2818" stroke-width="0.5"/><text x="28" y="26" text-anchor="middle" font-family="EB Garamond, serif" font-size="6" font-style="italic" fill="#3a2818">stone age</text></g>
          <g transform="translate(82, 266)"><rect width="56" height="42" fill="#7a3e2a" stroke="#3a2818" stroke-width="0.5"/><text x="28" y="26" text-anchor="middle" font-family="EB Garamond, serif" font-size="6" font-style="italic" fill="#f0e6cf">bronze</text></g>
          <g transform="translate(144, 266)"><rect width="56" height="42" fill="#5a4528" stroke="#3a2818" stroke-width="0.5"/><text x="28" y="26" text-anchor="middle" font-family="EB Garamond, serif" font-size="6" font-style="italic" fill="#f0e6cf">classical</text></g>
          <g transform="translate(20, 314)"><rect width="56" height="42" fill="#3a2818" stroke="#3a2818" stroke-width="0.5"/><text x="28" y="26" text-anchor="middle" font-family="EB Garamond, serif" font-size="6" font-style="italic" fill="#f0e6cf">medieval</text></g>
          <g transform="translate(82, 314)"><rect width="56" height="42" fill="#1d5e6e" stroke="#3a2818" stroke-width="0.5"/><text x="28" y="26" text-anchor="middle" font-family="EB Garamond, serif" font-size="6" font-style="italic" fill="#f0e6cf">age of sail</text></g>
          <g transform="translate(144, 314)"><rect width="56" height="42" fill="#5a4528" stroke="#3a2818" stroke-width="0.5"/><text x="28" y="26" text-anchor="middle" font-family="EB Garamond, serif" font-size="6" font-style="italic" fill="#f0e6cf">industrial</text></g>
          <line x1="20" y1="368" x2="200" y2="368" stroke="#3a2818" stroke-width="0.2" stroke-dasharray="2 2"/>
          <text x="110" y="388" text-anchor="middle" font-family="EB Garamond, serif" font-size="9" font-style="italic" fill="#7a3e2a">tap any pin to read its survey</text>
          <rect x="40" y="400" width="140" height="26" fill="#3a2818"/>
          <text x="110" y="418" text-anchor="middle" font-family="EB Garamond, serif" font-size="10" font-style="italic" fill="#f0e6cf">share atlas  →</text>
        </svg>

</div>


---

*End of Cartographer delta spec. Implement against `bibliophile-spec.md` as the base, with substitutions specified here.*
