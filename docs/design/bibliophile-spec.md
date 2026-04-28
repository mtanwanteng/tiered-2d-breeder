# Idea Collector — Bibliophile Design Specification

> A solo, AI-co-authored civilization-arc tile combiner. Mobile-first, single-player, contemplative. This document is the canonical design spec for the Bibliophile visual and interaction direction.

**Status:** Design locked, ready for implementation
**Audience:** Engineering and design
**Related code:** This repository (the existing implementation covers most of this spec)

---

## Table of contents

1. [Identity](#1-identity)
2. [Core mechanics](#2-core-mechanics)
3. [Surfaces](#3-surfaces)
   - 3.1 [Onboarding (first 90 seconds)](#31-onboarding-first-90-seconds)
   - 3.2 [Play screen (mid-run)](#32-play-screen-mid-run)
   - 3.3 [Bind ceremony](#33-bind-ceremony)
   - 3.4 [Era summary](#34-era-summary)
   - 3.5 [Library](#35-library)
   - 3.6 [Retirement ceremony](#36-retirement-ceremony)
   - 3.7 [Vault](#37-vault)
   - 3.8 [Run end](#38-run-end)
4. [Strip behavior](#4-strip-behavior)
5. [Bari (the apprentice character)](#5-bari)
6. [Motion language](#6-motion-language)
7. [Audio cues](#7-audio-cues)
8. [Accessibility](#8-accessibility)
9. [Open questions and future scope](#9-open-questions-and-future-scope)
10. [Appendix: design rationale](#10-appendix-design-rationale)
11. [Data model and persistence](#11-data-model-and-persistence)

---

## 1. Identity

### Design intent

A pocket book of hours. Reverent without being solemn. Crafted without being slick. Each run is a small history that no one else has — the player's library is the proof.

The player's kept tiles **are** the books. The leather binding is just the chrome that holds them.

### Palette

| Token | Hex | Usage |
|---|---|---|
| `--ink-black` | `#2a1f15` | Primary body text, deep backgrounds |
| `--oxblood` | `#7a3e2a` | Primary accent, default binding stripe |
| `--gilt` | `#c9a85f` | All highlights, halos, active states |
| `--vellum` | `#f4ead5` | Tile face, page background |
| `--leather-deep` | `#5a4528` | Secondary binding, darker leather |
| `--paper-dark` | `#1a1208` | Workshop background, deep modal backdrops |
| `--marble-warm` | `#a8794a` | Marbled vein color (light) |
| `--marble-cool` | `#3a2818` | Marbled vein color (dark) |

**Per-chapter chromatic binding stripes** are generated from a hash of `(era_id, kept_tile_id, run_id)` and pulled from a curated palette of ~15 muted leather colors. Same player + same chapter + different run → different color. This guarantees every player's library wall looks distinct.

### Typography

- **Cardo** (humanist serif) — chapter titles, narrative, italic body, all decorative text. Two weights: 400 regular, 400 italic.
- **Inter** (clean grotesque) — UI labels, metadata, all-caps section markers, button labels. Two weights: 400 regular, 500 medium.
- No third typeface anywhere.

### Texture and motif

- **Marbled endpapers** as tile face fill. SVG pattern of curved horizontal veins, ~30% opacity, two-tone (warm + cool).
- **Embossed leather** as binding stripe and book covers. Solid color with subtle 1px noise.
- **Gilded edges** as accents, never all-over. Used for halos, active borders, the wax seal at run end.
- The **bookplate frame** is the universal tile motif: marbled fill, sepia border, italic name, optional tier stars.

### Anti-references

The game should never feel like: any auto-merge dopamine farm, blockchain civilization games, Cookie Clicker, default Discord UI, anything with a leaderboard as the experience, anything that uses neon, anything that pulses-when-idle to attract attention.

### Theme architecture (swappable visual identity)

Bibliophile is **the first theme**, not the only one. Future iterations may swap to richer painted artwork, a sci-fi codex, a cartographer-explorer mode, or seasonal/event reskins. The system is built so a theme swap is a manifest change, not a code rewrite.

**A theme owns:**

| Slot | Type | Examples in Bibliophile theme |
|---|---|---|
| **Color tokens** | CSS custom properties (one set per theme) | `--ink-black`, `--oxblood`, `--gilt`, `--vellum`, etc. (see Palette table above) |
| **Typography** | Font family + weight pairs | `--font-serif: Cardo`, `--font-sans: Inter` |
| **Pattern textures** | SVG defs or background images | Marbled endpaper, embossed leather, parchment |
| **Decorative chrome** | SVG ornaments (corners, dividers, frames) | Floral manuscript scrollwork, sepia rule lines |
| **Character art** | Image set keyed by pose | Bari poses: idle, approval, wonder, patient |
| **Title-screen art** | Single hero image | Watercolor library aisle (`idea-collector-front.png`) |
| **Per-chapter framing** | A `chapterTheme` tag per era + frontispiece prompt prefix | "Craft · Survival" (Bronze Age); painting-style hint for Imagen |
| **Audio cues** | Asset paths keyed by cue name | `cello-bind.flac`, `cello-retire.flac`, `cathedral-bell.flac`, etc. |
| **Copy register** | Voice + tone descriptors | "italic-serif", "reverent" — applies to AI-thinking copy and Bari's one line |
| **Motion timing exceptions** | Optional override for spec timings | (none in Bibliophile — uses spec defaults) |

**Implementation contract:**

A theme is loaded by **two artifacts**:
1. **`themes/<name>/tokens.css`** — defines all CSS custom properties under a `[data-theme="<name>"]` selector. Switching themes flips `document.documentElement.dataset.theme`.
2. **`themes/<name>/manifest.ts`** — exports a typed `Theme` object containing asset paths, font URLs, character poses, audio cue paths, copy strings, and the `chapterThemes` map. Code never hard-codes asset paths or copy — always reads from the active theme's manifest.

Layout, interactions, motion primitives, data model, accessibility — **all theme-agnostic**. Themes are skin + assets + copy. Swapping themes never changes which tiles you have, when chapters end, what the hold-to-commit duration is, what database rows exist, or which API routes are called.

**Bibliophile is the v1 theme.** It's defined by everything in this spec (palette, fonts, motifs, motion language, audio cues, copy register). When a second theme is built, this spec becomes the **bibliophile-specific overlay** and a separate, smaller "theme spec" template will document just the slot contents per theme.

**Provisional second-theme candidates** (not in scope for v1, listed only to validate the abstraction):
- *Painted Manuscript* — same metaphor, fully illustrated tile art (replaces emoji), Imagen-generated chapter frontispieces, no procedural textures. Largest art-asset budget.
- *Cartographer's Codex* — map-room metaphor, hand-drawn cartography ornaments, sextant + compass UI elements, inks-and-vellum palette but cooler.
- *Modernist Edition* — reduced-decoration mode, Inter-only typography, no parchment, accessibility-first defaults baked in. Useful as a high-contrast reference theme.

If any future theme can't be expressed by changing only the slots above, the abstraction is wrong and the spec needs revision before implementing.

---

## 2. Core mechanics

### Combining tiles

The fundamental verb. Player drags one tile onto another. The system attempts to combine them (AI-driven for novel combinations, cached for known ones).

- **Successful combine:** Both source tiles ink-bloom into a single point, then the new tile ink-blooms outward over 600ms. Adds the new tile to the current chapter's catalog.
- **Failed combine:** 240ms shake (±3px, 3 oscillations), tile dims briefly, soft inkwell-tap sound. No buzzer.
- **Source tiles persist by default.** Combining doesn't consume them — the player's catalog grows with each new combination.

### Binding (chapter end)

At the end of each chapter, the player picks **one** tile from that chapter's discoveries to bind into their codex. The bound tile becomes a permanent kept book in the player's library.

This is a hold-to-commit interaction (see [section 3.3](#33-bind-ceremony)).

### Retirement (library full)

Once the library has 24 tiles, every new bind triggers a retirement choice. The player must press-and-hold one existing library tile to send it back to the world, making room for the new one.

Same hold-to-commit gesture as binding (see [section 3.6](#36-retirement-ceremony)).

### Hold-to-commit (the master interaction)

Both binding and retirement use the same physical gesture:

| Phase | Duration | Behavior |
|---|---|---|
| Pre-commit drop | — | Player drops/long-presses target. Tile snaps; halo brightens; hold-arc appears. |
| Hold | 2.5s linear | Hold-arc fills clockwise. Cello G2 (bind) or C2 (retire) sustains. |
| Commit | instant | Brass clasp / dispersal. Strip cube blooms / library slot empties. |
| Post-commit breathing | 0–∞s | Plate breathes (1.0 ↔ 1.02 scale, 3s sine). Optional. |
| Release prompt | appears at +1.5s post-commit | Italic line: "release to continue" |
| Held silence | 1.2s | Stillness after release. |
| Auto page-turn | 700ms | Peel from right edge, lands on next surface. |

**Cancellation before commit:** Lifting before 2.5s is graceful. Tile rises 60px out of plate (280ms ease-out), hold-arc fades (160ms), cello exhales softly (G2 → F2, 600ms decay). No fail sound, no confirm modal. The system trusts the player.

---

## 3. Surfaces

### 3.1 Onboarding (first 90 seconds)

Plays on the player's first-ever run. Subsequent runs use a 5-second cold open instead.

| Frame | Time | Content |
|---|---|---|
| 01 | 0–8s | Black screen. Leather-bound book fades in. Title "Idea Collector" types in gilt. Below: "Chapter I". |
| 02 | 8–18s | Page opens. Bari fades in, lower-left margin. Fire and Wood tiles ink-bloom on the page. Italic line: "Try." |
| 03 | 18–28s | If player idle 4s, gilt arc draws between Fire and Wood, holds 600ms, fades. Loops every 4s. |
| 04 | 28–40s | Player drags Fire onto Wood. Tiles merge. Page desaturates to held-breath state. Cello G2 plays once (700ms). |
| 05 | 40–60s | Torch ink-blooms. Italic narrative types: "Light pushed back at the dark." Bari nods. |
| Handoff | 60–90s | Inventory ink-blooms in. Objectives card appears. Run begins normally. |

#### Visual reference

<p><strong>Frame 01 · 0–8s · A book on a desk</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 220 380" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;border-radius:18px;">
          <defs>
            <pattern id="o1-leather" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill="#2a1f15"/><circle cx="1.5" cy="1.5" r="0.3" fill="#3a2818"/></pattern>
          </defs>
          <rect width="220" height="380" fill="#0c0805"/>
          <rect x="50" y="80" width="120" height="180" fill="url(#o1-leather)" stroke="#5a4528" stroke-width="1"/>
          <rect x="56" y="86" width="108" height="168" fill="none" stroke="#c9a85f" stroke-width="0.4"/>
          <text x="110" y="160" text-anchor="middle" font-family="Cardo, serif" font-size="14" font-style="italic" fill="#c9a85f">Idea Collector</text>
          <line x1="80" y1="170" x2="140" y2="170" stroke="#c9a85f" stroke-width="0.4"/>
          <text x="110" y="188" text-anchor="middle" font-family="Cardo, serif" font-size="9" font-style="italic" fill="#a8794a">— Chapter I —</text>
          <rect x="44" y="250" width="132" height="6" fill="#1a1208" opacity="0.5"/>
          <text x="110" y="312" text-anchor="middle" font-family="Cardo, serif" font-size="10" font-style="italic" fill="#7a3e2a" opacity="0.6">tap to open</text>
        </svg>

</div>

<p><strong>Frame 02 · 8–18s · Bari sets out two pieces</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 220 380" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;border-radius:18px;">
          <defs>
            <pattern id="o2-marble" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="#f4ead5"/><path d="M0 8 Q8 5 15 8 T30 8" stroke="#a8794a" stroke-width="0.3" fill="none" opacity="0.5"/></pattern>
          </defs>
          <rect width="220" height="380" fill="#0c0805"/>
          <rect x="10" y="14" width="200" height="358" fill="url(#o2-marble)" stroke="#8b6f47" stroke-width="1.5"/>
          <text x="110" y="42" text-anchor="middle" font-family="Cardo, serif" font-size="9" font-style="italic" fill="#7a3e2a">— Chapter I · Stone Age —</text>
          <line x1="60" y1="50" x2="160" y2="50" stroke="#8b6f47" stroke-width="0.3"/>
          <g transform="translate(40, 130)">
            <rect width="56" height="76" fill="url(#o2-marble)" stroke="#8b6f47" stroke-width="1"/>
            <rect x="3" y="3" width="50" height="70" fill="none" stroke="#8b6f47" stroke-width="0.3"/>
            <text x="28" y="42" text-anchor="middle" font-size="22">🔥</text>
            <text x="28" y="60" text-anchor="middle" font-family="Cardo, serif" font-size="9" font-style="italic" fill="#3a2818">Fire</text>
          </g>
          <g transform="translate(124, 130)">
            <rect width="56" height="76" fill="url(#o2-marble)" stroke="#8b6f47" stroke-width="1"/>
            <rect x="3" y="3" width="50" height="70" fill="none" stroke="#8b6f47" stroke-width="0.3"/>
            <text x="28" y="42" text-anchor="middle" font-size="22">🪵</text>
            <text x="28" y="60" text-anchor="middle" font-family="Cardo, serif" font-size="9" font-style="italic" fill="#3a2818">Wood</text>
          </g>
          <text x="110" y="244" text-anchor="middle" font-family="Cardo, serif" font-size="13" font-style="italic" fill="#3a2818">Try.</text>
          <g transform="translate(20, 290)">
            <ellipse cx="14" cy="40" rx="14" ry="6" fill="#1a1208" opacity="0.3"/>
            <circle cx="14" cy="20" r="9" fill="#c9a85f"/>
            <rect x="6" y="26" width="16" height="14" fill="#7a3e2a"/>
            <rect x="2" y="34" width="6" height="3" fill="#5a4528"/>
            <rect x="20" y="34" width="6" height="3" fill="#5a4528"/>
            <rect x="22" y="14" width="8" height="2" fill="#3a2818"/>
            <text x="14" y="60" text-anchor="middle" font-family="Cardo, serif" font-size="8" font-style="italic" fill="#7a3e2a">Bari</text>
          </g>
        </svg>

</div>

<p><strong>Frame 03 · 18–28s · A finger drawn in gilt</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 220 380" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;border-radius:18px;">
          <defs>
            <pattern id="o3-marble" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="#f4ead5"/><path d="M0 8 Q8 5 15 8 T30 8" stroke="#a8794a" stroke-width="0.3" fill="none" opacity="0.5"/></pattern>
          </defs>
          <rect width="220" height="380" fill="#0c0805"/>
          <rect x="10" y="14" width="200" height="358" fill="url(#o3-marble)" stroke="#8b6f47" stroke-width="1.5"/>
          <text x="110" y="42" text-anchor="middle" font-family="Cardo, serif" font-size="9" font-style="italic" fill="#7a3e2a">— Chapter I · Stone Age —</text>
          <line x1="60" y1="50" x2="160" y2="50" stroke="#8b6f47" stroke-width="0.3"/>
          <g transform="translate(40, 130)">
            <rect width="56" height="76" fill="url(#o3-marble)" stroke="#c9a85f" stroke-width="1.5"/>
            <text x="28" y="42" text-anchor="middle" font-size="22">🔥</text>
            <text x="28" y="60" text-anchor="middle" font-family="Cardo, serif" font-size="9" font-style="italic" fill="#3a2818">Fire</text>
          </g>
          <g transform="translate(124, 130)">
            <rect width="56" height="76" fill="url(#o3-marble)" stroke="#c9a85f" stroke-width="1.5"/>
            <text x="28" y="42" text-anchor="middle" font-size="22">🪵</text>
            <text x="28" y="60" text-anchor="middle" font-family="Cardo, serif" font-size="9" font-style="italic" fill="#3a2818">Wood</text>
          </g>
          <path d="M 96 168 Q 110 150 124 168" stroke="#c9a85f" stroke-width="1.2" fill="none" opacity="0.85"/>
          <circle cx="124" cy="168" r="3" fill="#c9a85f"/>
          <circle cx="124" cy="168" r="6" fill="#c9a85f" opacity="0.3"/>
          <text x="110" y="244" text-anchor="middle" font-family="Cardo, serif" font-size="13" font-style="italic" fill="#3a2818">Try.</text>
          <g transform="translate(20, 290)">
            <ellipse cx="14" cy="40" rx="14" ry="6" fill="#1a1208" opacity="0.3"/>
            <circle cx="14" cy="20" r="9" fill="#c9a85f"/>
            <rect x="6" y="26" width="16" height="14" fill="#7a3e2a"/>
            <rect x="2" y="34" width="6" height="3" fill="#5a4528"/>
            <rect x="20" y="34" width="6" height="3" fill="#5a4528"/>
            <rect x="22" y="14" width="8" height="2" fill="#3a2818"/>
          </g>
        </svg>

</div>

<p><strong>Frame 04 · 28–40s · The held breath</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 220 380" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;border-radius:18px;">
          <defs>
            <pattern id="o4-marble" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="#f4ead5"/><path d="M0 8 Q8 5 15 8 T30 8" stroke="#a8794a" stroke-width="0.3" fill="none" opacity="0.5"/></pattern>
          </defs>
          <rect width="220" height="380" fill="#0c0805"/>
          <rect x="10" y="14" width="200" height="358" fill="url(#o4-marble)" stroke="#8b6f47" stroke-width="1.5"/>
          <rect x="10" y="14" width="200" height="358" fill="#1a1208" opacity="0.5"/>
          <text x="110" y="42" text-anchor="middle" font-family="Cardo, serif" font-size="9" font-style="italic" fill="#7a3e2a" opacity="0.4">— Chapter I · Stone Age —</text>
          <circle cx="110" cy="170" r="60" fill="#c9a85f" opacity="0.05"/>
          <circle cx="110" cy="170" r="36" fill="#c9a85f" opacity="0.09"/>
          <circle cx="110" cy="170" r="14" fill="#c9a85f" opacity="0.18"/>
          <circle cx="110" cy="170" r="4" fill="#f4ead5"/>
          <g transform="translate(20, 290)" opacity="0.6">
            <ellipse cx="14" cy="40" rx="14" ry="6" fill="#1a1208" opacity="0.3"/>
            <circle cx="14" cy="20" r="9" fill="#c9a85f"/>
            <rect x="6" y="26" width="16" height="14" fill="#7a3e2a"/>
            <rect x="2" y="34" width="6" height="3" fill="#5a4528"/>
            <rect x="20" y="34" width="6" height="3" fill="#5a4528"/>
            <rect x="22" y="14" width="8" height="2" fill="#3a2818"/>
          </g>
        </svg>

</div>

<p><strong>Frame 05 · 40–60s · "Light pushed back at the dark"</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 220 380" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;border-radius:18px;">
          <defs>
            <pattern id="o5-marble" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="#f4ead5"/><path d="M0 8 Q8 5 15 8 T30 8" stroke="#a8794a" stroke-width="0.3" fill="none" opacity="0.5"/></pattern>
          </defs>
          <rect width="220" height="380" fill="#0c0805"/>
          <rect x="10" y="14" width="200" height="358" fill="url(#o5-marble)" stroke="#8b6f47" stroke-width="1.5"/>
          <text x="110" y="42" text-anchor="middle" font-family="Cardo, serif" font-size="9" font-style="italic" fill="#7a3e2a">— Chapter I · Stone Age —</text>
          <line x1="60" y1="50" x2="160" y2="50" stroke="#8b6f47" stroke-width="0.3"/>
          <g transform="translate(72, 130)">
            <rect width="76" height="100" fill="url(#o5-marble)" stroke="#c9a85f" stroke-width="2"/>
            <rect x="4" y="4" width="68" height="92" fill="none" stroke="#c9a85f" stroke-width="0.4"/>
            <text x="38" y="56" text-anchor="middle" font-size="32">🔦</text>
            <text x="38" y="78" text-anchor="middle" font-family="Cardo, serif" font-size="11" font-style="italic" fill="#3a2818">Torch</text>
            <text x="38" y="90" text-anchor="middle" font-family="Cardo, serif" font-size="7" fill="#a8794a">★ ★</text>
          </g>
          <text x="110" y="262" text-anchor="middle" font-family="Cardo, serif" font-size="11" font-style="italic" fill="#3a2818">"Light pushed back</text>
          <text x="110" y="276" text-anchor="middle" font-family="Cardo, serif" font-size="11" font-style="italic" fill="#3a2818">at the dark."</text>
          <g transform="translate(20, 290)">
            <ellipse cx="14" cy="40" rx="14" ry="6" fill="#1a1208" opacity="0.3"/>
            <circle cx="14" cy="20" r="9" fill="#c9a85f"/>
            <rect x="6" y="26" width="16" height="14" fill="#7a3e2a"/>
            <rect x="2" y="34" width="6" height="3" fill="#5a4528"/>
            <rect x="20" y="34" width="6" height="3" fill="#5a4528"/>
            <rect x="22" y="14" width="8" height="2" fill="#3a2818"/>
            <path d="M 4 16 Q 14 12 24 16" stroke="#3a2818" stroke-width="0.6" fill="none"/>
          </g>
          <text x="110" y="350" text-anchor="middle" font-family="Cardo, serif" font-size="9" font-style="italic" fill="#a8794a" opacity="0.7">tap to continue · Bari approves</text>
        </svg>

</div>


### 3.2 Play screen (mid-run)

The standard interaction surface for ~80% of the run. Mobile-first; scales to desktop with workspace centered, inventory and Bari to the right.

**Layout (top to bottom on mobile):**

1. **Chapter title bar** (`#1a1208` bg, gilt italic Cardo) — chapter Roman numeral + era name (e.g. "Chapter III · Bronze Age"), with a **chapter-theme tag** as a smaller-italic subtitle directly beneath ("Craft · Survival") and a **tier-floor badge** to the right when the chapter has a deterministic tier requirement (see "Goal model" below). The chapter-theme tag is a two-or-three-word evocation of what the chapter is about — provided per era in the theme manifest (see §1 "Theme architecture" and the table at the end of this section).
2. **Objectives card** (vellum bg, leather border, single-column list of ✓ / ○ items on mobile, two-column on desktop) — narrative milestones only.
3. **Workspace / "writing desk"** (`#1a1208` bg with leather border, captioned "— the writing desk —"). Empty-state hint in italic Cardo: *"Place two ideas here to combine."*
4. **Idea tray** (the inventory) — every discovered tile remains accessible (**no cap**). Single layout across breakpoints: horizontal-scrolling tray at the bottom, captioned "Your Ideas" in small-caps Inter, with a small "Card Catalog →" button to the right of the caption. Each tile is a bookplate card showing emoji + italic Cardo name + tier stars. Snap-scroll, momentum-scroll, no pagination dots. Tray height ~120px; ~4 cards visible at 360px width, ~8–10 at 1440px.
   - **Card Catalog modal** — opens a full-screen vellum overlay with the full grid (4-up at narrow desktop, 6-up at wide desktop, scrolling vertically), filter/search, and per-tile bookplate detail on tap. Same component used for the strip-tile peek and bind ceremony peek. The modal is the answer to "I have 60 tiles and I want to find one" — the tray is the answer to "I want to grab a recent or pinned tile right now." Closes on outside-tap, ESC, or the close button.
5. **Strip** (kept-tiles-as-books row at bottom edge — see [section 4](#4-strip-behavior)). Sits directly above the idea tray on every breakpoint.
6. **Bari** (lower-left margin, fixed position).

**Why one layout instead of breakpoint-flipping to a desktop grid:** A 4-up grid in-line with the workspace doesn't fit comfortably on a 1440×900 desktop after the chapter title bar, objectives card, workspace minimum (360px for tile-on-tile drag), strip, and Bari take their share — only ~140-180px remain for inventory, which is one grid row at best. A right-sidebar grid recovers the vertical budget but eats horizontal workspace and reverts to a "previous edition" sidebar feel that the bibliophile direction is moving away from. A single horizontal tray + catalog modal gives the workspace its full width, keeps the layout consistent across breakpoints, and scales gracefully as the player's catalog grows past what any in-line grid could hold.

**Interactions:**

- **Drag from inventory or workspace** → drop onto another tile to combine.
- **Drag from strip** → strip tiles act as inventory. Lift out with brief halo; can be combined; if released without a target, snap back to their cube. **Strip tiles persist when combined** — they are reusable foundations, not single-use components.
- **Long-press any tile** (inventory, workspace, or strip) → narrative card slides in from below. Shows name, era, italic description, parent tiles, tier stars. Tap outside to dismiss.
- **Tap a strip cube** → same narrative card.

**Goal model:**

Each chapter runs **two concurrent goal tracks**, both of which must be satisfied for the chapter to end:

- **Tier-floor goal** (deterministic) — the chapter requires the player to reach a minimum tier (typically `tier ≥ 3`). Surfaced as a small badge in the chapter title bar: e.g. *"requires a ⭐⭐⭐ idea"*. Marks itself complete the moment any tile of the required tier is created. Not a checklist item.
- **Narrative-milestone goals** (AI-judged) — a curated set of 4–6 chapter-themed conditions, of which the player must complete some `requiredCount` (typically 3–4). These are the items shown as ✓ / ○ in the **objectives card**. Conditions are checked in batch by `/api/check-era` after each combine.

This dual-track model keeps the **objectives card visually clean** (it shows narrative milestones only — the conditions a reader cares about: "Build a city", "Forge alloy", "Write laws") while the **mechanical floor** lives unobtrusively in the chapter title bar where it doesn't compete for attention.

The chapter advances only when **both** tracks are satisfied — the bind ceremony triggers on the moment the last of the two goes green.

**Combine feedback (AI-thinking copy):**

When a combine resolves locally (recipe cache hit), feedback is instant — woody knock SFX, ink-bloom, narrative card. When it requires an AI call, the player sees an **evolving message** while the request is in flight. The message reflects the theme's voice register and grows more reflective if the call takes longer:

| Phase | Trigger | Bibliophile copy (italic Cardo) |
|---|---|---|
| Start | API call begins | *"Reading the margins…"* |
| Longer | +2.5s elapsed, still pending | *"Pinning this down takes a history."* |
| Long | +6s elapsed, still pending | *"The ink is slow today."* |
| Resolved | Response arrives | (replaced by combine resolution — toast or narrative card) |
| Failed | API error | *"The ink resisted. Try again."* (matched 240ms shake on the source pair) |

The thresholds are theme-agnostic; only the copy changes per theme. Each phase replaces the previous text in place (no stacking). Bari's posture during AI-thinking shifts to **wonder/leaning-in** at the *Longer* threshold and back to *idle* on resolve.

**Chapter-theme tags:**

Each chapter has a 2–3 word italic tag that sits beneath the era name in the title bar. These are theme-manifest content (per §1 "Theme architecture"); the table below is the **Bibliophile theme's tags**. Other themes will provide their own.

| # | Era (engineering) | Chapter (display) | Theme tag (italic) |
|---|---|---|---|
| I | Stone Age | The Stone Age | *Survive · Discover* |
| II | Bronze Age | The Bronze Age | *Craft · Survival* |
| III | Iron Age | The Iron Age | *Tools · Order* |
| IV | Classical Age | The Classical Age | *Reason · Empire* |
| V | Medieval Age | The Medieval Age | *Faith · Stone* |
| VI | Renaissance | The Renaissance | *Inquiry · Beauty* |
| VII | Age of Exploration | The Age of Exploration | *Horizon · Trade* |
| VIII | Industrial Age | The Industrial Age | *Steam · Iron* |
| IX | Modern Age | The Modern Age | *Power · Nation* |
| X | Information Age | The Information Age | *Signal · Code* |
| XI | Space Age | The Space Age | *Lift · Wonder* |

These are starting points — copy review may shift specific words. The pattern is always **two or three single nouns or short verbs, separated by a centered dot (` · `), in italic Cardo, sized smaller than the era name**.

#### Visual reference

<p><strong>Mid-run play screen</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 220 440" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;border-radius:22px;">
          <defs>
            <pattern id="b-leather" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill="#2a1f15"/><circle cx="1.5" cy="1.5" r="0.3" fill="#3a2818"/></pattern>
            <pattern id="b-marble" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="#f4ead5"/><path d="M0 8 Q8 5 15 8 T30 8" stroke="#a8794a" stroke-width="0.3" fill="none" opacity="0.5"/><path d="M0 22 Q8 18 15 22 T30 22" stroke="#7a3e2a" stroke-width="0.25" fill="none" opacity="0.4"/></pattern>
          </defs>
          <rect width="220" height="440" fill="url(#b-leather)"/>
          <rect x="10" y="14" width="200" height="26" fill="#1a1208"/>
          <text x="110" y="31" text-anchor="middle" font-family="Cardo, Georgia, serif" font-size="11" font-style="italic" fill="#c9a85f">— Chapter III · Bronze Age —</text>
          <rect x="10" y="48" width="200" height="58" fill="#f4ead5" stroke="#8b6f47" stroke-width="0.5"/>
          <text x="20" y="64" font-family="Inter, sans-serif" font-size="8" fill="#7a3e2a" letter-spacing="1">OBJECTIVES</text>
          <text x="20" y="80" font-family="Cardo, Georgia, serif" font-size="10" fill="#3a2818">✓ Smelt copper</text>
          <text x="20" y="94" font-family="Cardo, Georgia, serif" font-size="10" fill="#3a2818">✓ Build a city</text>
          <text x="120" y="80" font-family="Cardo, Georgia, serif" font-size="10" fill="#7a3e2a">○ Forge alloy</text>
          <text x="120" y="94" font-family="Cardo, Georgia, serif" font-size="10" fill="#7a3e2a">○ Write laws</text>
          <rect x="10" y="114" width="200" height="170" fill="#1a1208" stroke="#5a4528" stroke-width="0.5"/>
          <text x="110" y="130" text-anchor="middle" font-family="Cardo, Georgia, serif" font-size="9" font-style="italic" fill="#a8794a">— the writing desk —</text>
          <g transform="translate(28, 144)"><rect width="56" height="76" fill="url(#b-marble)" stroke="#8b6f47" stroke-width="1"/><rect x="3" y="3" width="50" height="70" fill="none" stroke="#8b6f47" stroke-width="0.3"/><text x="28" y="40" text-anchor="middle" font-size="22">🔥</text><text x="28" y="58" text-anchor="middle" font-family="Cardo, Georgia, serif" font-size="8" fill="#3a2818">Fire</text><text x="28" y="68" text-anchor="middle" font-family="Cardo, Georgia, serif" font-size="6" fill="#a8794a">★ ★</text></g>
          <g transform="translate(108, 178)" opacity="0.85"><rect width="56" height="76" fill="url(#b-marble)" stroke="#c9a85f" stroke-width="1.5"/><rect x="3" y="3" width="50" height="70" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="28" y="40" text-anchor="middle" font-size="22">🪨</text><text x="28" y="58" text-anchor="middle" font-family="Cardo, Georgia, serif" font-size="8" fill="#3a2818">Copper</text><text x="28" y="68" text-anchor="middle" font-family="Cardo, Georgia, serif" font-size="6" fill="#a8794a">★ ★ ★</text></g>
          <circle cx="86" cy="220" r="14" fill="#c9a85f" opacity="0.25"/>
          <circle cx="86" cy="220" r="9" fill="#c9a85f" opacity="0.5"/>
          <rect x="10" y="292" width="200" height="118" fill="#3a2818" stroke="#5a4528" stroke-width="0.5"/>
          <text x="20" y="306" font-family="Inter, sans-serif" font-size="8" fill="#a8794a" letter-spacing="1">CARD CATALOG</text>
          <g transform="translate(20, 314)"><rect width="86" height="20" fill="#f4ead5" stroke="#8b6f47" stroke-width="0.4"/><text x="6" y="14" font-family="Cardo, serif" font-size="9" fill="#3a2818">🌊 Water · ★</text></g>
          <g transform="translate(114, 314)"><rect width="86" height="20" fill="#f4ead5" stroke="#8b6f47" stroke-width="0.4"/><text x="6" y="14" font-family="Cardo, serif" font-size="9" fill="#3a2818">🌾 Wheat · ★★</text></g>
          <g transform="translate(20, 338)"><rect width="86" height="20" fill="#f4ead5" stroke="#8b6f47" stroke-width="0.4"/><text x="6" y="14" font-family="Cardo, serif" font-size="9" fill="#3a2818">🏛 Temple · ★★★</text></g>
          <g transform="translate(114, 338)"><rect width="86" height="20" fill="#f4ead5" stroke="#8b6f47" stroke-width="0.4"/><text x="6" y="14" font-family="Cardo, serif" font-size="9" fill="#3a2818">📜 Edict · ★★★</text></g>
          <g transform="translate(20, 362)"><rect width="86" height="20" fill="#f4ead5" stroke="#8b6f47" stroke-width="0.4"/><text x="6" y="14" font-family="Cardo, serif" font-size="9" fill="#3a2818">⚱ Urn · ★★</text></g>
          <g transform="translate(114, 362)"><rect width="86" height="20" fill="#f4ead5" stroke="#8b6f47" stroke-width="0.4"/><text x="6" y="14" font-family="Cardo, serif" font-size="9" fill="#3a2818">🏺 Amphora · ★★</text></g>
          <rect x="10" y="416" width="200" height="14" fill="#1a1208"/>
          <g transform="translate(14, 418)"><rect width="14" height="10" fill="#7a3e2a"/></g>
          <g transform="translate(30, 418)"><rect width="14" height="10" fill="#5a4528"/></g>
          <g transform="translate(46, 418)"><rect width="14" height="10" fill="#c9a85f"/></g>
          <g transform="translate(62, 418)"><rect width="14" height="10" fill="#3a2818" stroke="#5a4528" stroke-width="0.3"/></g>
          <g transform="translate(78, 418)"><rect width="14" height="10" fill="#3a2818" stroke="#5a4528" stroke-width="0.3"/></g>
          <g transform="translate(94, 418)"><rect width="14" height="10" fill="#3a2818" stroke="#5a4528" stroke-width="0.3"/></g>
          <g transform="translate(110, 418)"><rect width="14" height="10" fill="#3a2818" stroke="#5a4528" stroke-width="0.3"/></g>
          <g transform="translate(126, 418)"><rect width="14" height="10" fill="#3a2818" stroke="#5a4528" stroke-width="0.3"/></g>
          <g transform="translate(142, 418)"><rect width="14" height="10" fill="#3a2818" stroke="#5a4528" stroke-width="0.3"/></g>
          <g transform="translate(158, 418)"><rect width="14" height="10" fill="#3a2818" stroke="#5a4528" stroke-width="0.3"/></g>
          <g transform="translate(174, 418)"><rect width="14" height="10" fill="#3a2818" stroke="#5a4528" stroke-width="0.3"/></g>
        </svg>

</div>


### 3.3 Bind ceremony

Triggered when the chapter's last objective is met. Replaces the play screen with a focused ceremonial state.

**Frames:**

| Frame | Trigger | Behavior |
|---|---|---|
| Bind-A | Last objective ticks | Objectives border warms `#8b6f47` → `#c9a85f`. Singing-bowl strike (1.4s tail). |
| Bind-B | +1.4s after Bind-A | Workshop dims to silhouette (page-darken 0% → 65% over 500ms). Empty plate scales 0.92 → 1.0 with halo pulsing. Eight chapter pieces ink-bloom in below (50ms stagger). Cello G2 inhale (700ms). |
| Bind-C | Player drags tile into plate | Tile snaps to plate center (120ms). Halo brightens 0.06 → 0.16. Hold-arc appears beneath (alpha 0.3). Cello G2 begins **sustaining** (no longer finite tail). Soft leather press SFX. |
| Bind-D | During hold | Hold-arc fills clockwise (2.5s linear). Tile shifts hue +6° toward warm gold. Plate border thickens 2.0 → 2.4px. At ~1.0s, second cello note enters underneath — chord builds. |
| Bind-E | Hold reaches 2.5s | **COMMIT.** Brass clasps slide in from ±20px (220ms `cubic-bezier(0.4, 0, 0.2, 1)`). Hold-arc completes circle, dissolves. Strip cube cube-blooms in sync (400ms). Cello G2 resolves up a fifth, decays. Sharp medium haptic + soft second tick. |
| Bind-F | Continued hold (optional) | Plate breathes (scale 1.0 ↔ 1.02, 3s sine). Halo alpha 0.06 ↔ 0.12. Faint sustained low cello (C2), subliminal. At +1.5s, "release to continue" italic line fades in (no period). |
| Release | Player lifts finger | Breathing stops. Plate at scale 1.0. Halo at baseline. 1.2 seconds total stillness. Then page auto-turns into era summary. |

**Cancellation:** Lifting before Bind-E completes — tile rises 60px out of plate (280ms ease-out), hold-arc fades (160ms), cello breath releases (G2 → F2, 600ms decay). Returns to Bind-B state.

#### Visual reference

<p><strong>Frame 01 · 0.0s · Last objective ticks</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 220 380" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;border-radius:18px;">
          <defs>
            <pattern id="b1-leather" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill="#2a1f15"/><circle cx="1.5" cy="1.5" r="0.3" fill="#3a2818"/></pattern>
            <pattern id="b1-marble" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="#f4ead5"/><path d="M0 8 Q8 5 15 8 T30 8" stroke="#a8794a" stroke-width="0.3" fill="none" opacity="0.5"/></pattern>
          </defs>
          <rect width="220" height="380" fill="url(#b1-leather)"/>
          <rect x="10" y="14" width="200" height="22" fill="#1a1208"/>
          <text x="110" y="29" text-anchor="middle" font-family="Cardo, Georgia, serif" font-size="10" font-style="italic" fill="#c9a85f">Chapter III · Bronze Age</text>
          <rect x="10" y="44" width="200" height="58" fill="#f4ead5" stroke="#c9a85f" stroke-width="1"/>
          <text x="20" y="60" font-family="Inter, sans-serif" font-size="7" fill="#7a3e2a" letter-spacing="1">OBJECTIVES</text>
          <text x="20" y="76" font-family="Cardo, serif" font-size="10" fill="#3a2818">✓ Smelt copper</text>
          <text x="20" y="90" font-family="Cardo, serif" font-size="10" fill="#3a2818">✓ Build a city</text>
          <text x="120" y="76" font-family="Cardo, serif" font-size="10" fill="#3a2818">✓ Forge alloy</text>
          <text x="120" y="90" font-family="Cardo, serif" font-size="10" fill="#3a2818">✓ Write laws</text>
          <rect x="10" y="110" width="200" height="160" fill="#1a1208" stroke="#5a4528" stroke-width="0.4"/>
          <text x="110" y="124" text-anchor="middle" font-family="Cardo, serif" font-size="8" font-style="italic" fill="#a8794a">— the writing desk —</text>
          <g transform="translate(82, 160)">
            <rect width="56" height="76" fill="url(#b1-marble)" stroke="#c9a85f" stroke-width="1.5"/>
            <text x="28" y="42" text-anchor="middle" font-size="22">📜</text>
            <text x="28" y="60" text-anchor="middle" font-family="Cardo, serif" font-size="8" fill="#3a2818">Code of Laws</text>
            <text x="28" y="68" text-anchor="middle" font-family="Cardo, serif" font-size="6" fill="#a8794a">★ ★ ★ ★</text>
          </g>
          <text x="110" y="288" text-anchor="middle" font-family="Cardo, serif" font-size="9" font-style="italic" fill="#c9a85f">all surveys complete</text>
          <rect x="10" y="304" width="200" height="64" fill="#3a2818" stroke="#5a4528" stroke-width="0.4"/>
          <g transform="translate(20, 314)"><rect width="40" height="46" fill="url(#b1-marble)"/><text x="20" y="28" text-anchor="middle" font-size="14">🔥</text></g>
          <g transform="translate(64, 314)"><rect width="40" height="46" fill="url(#b1-marble)"/><text x="20" y="28" text-anchor="middle" font-size="14">🌾</text></g>
          <g transform="translate(108, 314)"><rect width="40" height="46" fill="url(#b1-marble)"/><text x="20" y="28" text-anchor="middle" font-size="14">⚒</text></g>
        </svg>

</div>

<p><strong>Frame 02 · 1.4s · The room recedes</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 220 380" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;border-radius:18px;">
          <defs>
            <pattern id="b2-leather" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill="#2a1f15"/><circle cx="1.5" cy="1.5" r="0.3" fill="#3a2818"/></pattern>
            <pattern id="b2-marble" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="#f4ead5"/><path d="M0 8 Q8 5 15 8 T30 8" stroke="#a8794a" stroke-width="0.3" fill="none" opacity="0.5"/></pattern>
          </defs>
          <rect width="220" height="380" fill="url(#b2-leather)"/>
          <rect width="220" height="380" fill="#0c0805" opacity="0.65"/>
          <text x="110" y="60" text-anchor="middle" font-family="Cardo, serif" font-size="11" font-style="italic" fill="#c9a85f">Chapter III ends.</text>
          <text x="110" y="78" text-anchor="middle" font-family="Cardo, serif" font-size="11" font-style="italic" fill="#c9a85f">Bind one piece into your codex.</text>
          <line x1="40" y1="92" x2="180" y2="92" stroke="#c9a85f" stroke-width="0.4" opacity="0.5"/>
          <rect x="60" y="120" width="100" height="86" fill="url(#b2-marble)" stroke="#c9a85f" stroke-width="2"/>
          <rect x="64" y="124" width="92" height="78" fill="none" stroke="#c9a85f" stroke-width="0.4" stroke-dasharray="2 2"/>
          <circle cx="110" cy="163" r="38" fill="#c9a85f" opacity="0.06"/>
          <circle cx="110" cy="163" r="22" fill="#c9a85f" opacity="0.12"/>
          <text x="110" y="165" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#a8794a" font-style="italic">drop one</text>
          <text x="110" y="178" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#a8794a" font-style="italic">to remember</text>
          <text x="110" y="248" text-anchor="middle" font-family="Cardo, serif" font-size="8" font-style="italic" fill="#7a3e2a" opacity="0.7">— eight pieces from this chapter —</text>
        </svg>

</div>

<p><strong>Frame 03 · 2.4s · The chapter's pieces</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 220 380" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;border-radius:18px;">
          <defs>
            <pattern id="b3-leather" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill="#2a1f15"/><circle cx="1.5" cy="1.5" r="0.3" fill="#3a2818"/></pattern>
            <pattern id="b3-marble" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="#f4ead5"/><path d="M0 8 Q8 5 15 8 T30 8" stroke="#a8794a" stroke-width="0.3" fill="none" opacity="0.5"/></pattern>
          </defs>
          <rect width="220" height="380" fill="url(#b3-leather)"/>
          <rect width="220" height="380" fill="#0c0805" opacity="0.65"/>
          <text x="110" y="32" text-anchor="middle" font-family="Cardo, serif" font-size="11" font-style="italic" fill="#c9a85f">Bind one piece into your codex.</text>
          <line x1="40" y1="42" x2="180" y2="42" stroke="#c9a85f" stroke-width="0.4" opacity="0.5"/>
          <rect x="60" y="58" width="100" height="80" fill="url(#b3-marble)" stroke="#c9a85f" stroke-width="2"/>
          <rect x="64" y="62" width="92" height="72" fill="none" stroke="#c9a85f" stroke-width="0.4" stroke-dasharray="2 2"/>
          <circle cx="110" cy="98" r="32" fill="#c9a85f" opacity="0.08"/>
          <circle cx="110" cy="98" r="18" fill="#c9a85f" opacity="0.14"/>
          <text x="110" y="158" text-anchor="middle" font-family="Cardo, serif" font-size="8" font-style="italic" fill="#a8794a">— from this chapter —</text>
          <g transform="translate(20, 168)"><rect width="40" height="50" fill="url(#b3-marble)" stroke="#8b6f47" stroke-width="0.5"/><text x="20" y="30" text-anchor="middle" font-size="16">🌾</text><text x="20" y="44" text-anchor="middle" font-family="Cardo, serif" font-size="6" fill="#3a2818">Wheat</text></g>
          <g transform="translate(66, 168)"><rect width="40" height="50" fill="url(#b3-marble)" stroke="#8b6f47" stroke-width="0.5"/><text x="20" y="30" text-anchor="middle" font-size="16">🏛</text><text x="20" y="44" text-anchor="middle" font-family="Cardo, serif" font-size="6" fill="#3a2818">Temple</text></g>
          <g transform="translate(112, 168)"><rect width="40" height="50" fill="url(#b3-marble)" stroke="#c9a85f" stroke-width="1.5"/><text x="20" y="30" text-anchor="middle" font-size="16">⚒</text><text x="20" y="44" text-anchor="middle" font-family="Cardo, serif" font-size="6" fill="#3a2818">Forge</text></g>
          <g transform="translate(158, 168)"><rect width="40" height="50" fill="url(#b3-marble)" stroke="#8b6f47" stroke-width="0.5"/><text x="20" y="30" text-anchor="middle" font-size="16">📜</text><text x="20" y="44" text-anchor="middle" font-family="Cardo, serif" font-size="6" fill="#3a2818">Edict</text></g>
          <g transform="translate(20, 224)"><rect width="40" height="50" fill="url(#b3-marble)" stroke="#8b6f47" stroke-width="0.5"/><text x="20" y="30" text-anchor="middle" font-size="16">⚱</text><text x="20" y="44" text-anchor="middle" font-family="Cardo, serif" font-size="6" fill="#3a2818">Urn</text></g>
          <g transform="translate(66, 224)"><rect width="40" height="50" fill="url(#b3-marble)" stroke="#8b6f47" stroke-width="0.5"/><text x="20" y="30" text-anchor="middle" font-size="16">🏺</text><text x="20" y="44" text-anchor="middle" font-family="Cardo, serif" font-size="6" fill="#3a2818">Amphora</text></g>
          <g transform="translate(112, 224)"><rect width="40" height="50" fill="url(#b3-marble)" stroke="#8b6f47" stroke-width="0.5"/><text x="20" y="30" text-anchor="middle" font-size="16">🛡</text><text x="20" y="44" text-anchor="middle" font-family="Cardo, serif" font-size="6" fill="#3a2818">Shield</text></g>
          <g transform="translate(158, 224)"><rect width="40" height="50" fill="url(#b3-marble)" stroke="#8b6f47" stroke-width="0.5"/><text x="20" y="30" text-anchor="middle" font-size="16">🐎</text><text x="20" y="44" text-anchor="middle" font-family="Cardo, serif" font-size="6" fill="#3a2818">Horse</text></g>
          <text x="110" y="298" text-anchor="middle" font-family="Cardo, serif" font-size="8" font-style="italic" fill="#a8794a" opacity="0.6">long press to read · drag to bind</text>
          <rect x="10" y="354" width="200" height="14" fill="#1a1208"/>
          <g transform="translate(14, 356)"><rect width="14" height="10" fill="#7a3e2a"/></g>
          <g transform="translate(30, 356)"><rect width="14" height="10" fill="#5a4528"/></g>
          <g transform="translate(46, 356)"><rect width="14" height="10" fill="#3a2818" stroke="#c9a85f" stroke-width="1"/></g>
          <g transform="translate(62, 356)"><rect width="14" height="10" fill="#2a1f15" stroke="#5a4528" stroke-width="0.3"/></g>
          <g transform="translate(78, 356)"><rect width="14" height="10" fill="#2a1f15" stroke="#5a4528" stroke-width="0.3"/></g>
        </svg>

</div>

<p><strong>Frame 04 · ~5s · The clasp snaps</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 220 380" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;border-radius:18px;">
          <defs>
            <pattern id="b4-leather" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill="#2a1f15"/><circle cx="1.5" cy="1.5" r="0.3" fill="#3a2818"/></pattern>
            <pattern id="b4-marble" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="#f4ead5"/><path d="M0 8 Q8 5 15 8 T30 8" stroke="#a8794a" stroke-width="0.3" fill="none" opacity="0.5"/></pattern>
          </defs>
          <rect width="220" height="380" fill="url(#b4-leather)"/>
          <rect width="220" height="380" fill="#0c0805" opacity="0.55"/>
          <text x="110" y="32" text-anchor="middle" font-family="Cardo, serif" font-size="11" font-style="italic" fill="#c9a85f">Bound to your codex</text>
          <line x1="40" y1="42" x2="180" y2="42" stroke="#c9a85f" stroke-width="0.4" opacity="0.5"/>
          <rect x="50" y="80" width="120" height="100" fill="url(#b4-marble)" stroke="#c9a85f" stroke-width="2.5"/>
          <rect x="54" y="84" width="112" height="92" fill="none" stroke="#c9a85f" stroke-width="0.5"/>
          <text x="110" y="134" text-anchor="middle" font-size="40">⚒</text>
          <text x="110" y="160" text-anchor="middle" font-family="Cardo, serif" font-size="11" fill="#3a2818">The Forge</text>
          <text x="110" y="172" text-anchor="middle" font-family="Cardo, serif" font-size="7" fill="#a8794a">★ ★ ★ ★ ★</text>
          <rect x="100" y="76" width="20" height="10" fill="#c9a85f" stroke="#8b6f47" stroke-width="0.4"/>
          <rect x="100" y="174" width="20" height="10" fill="#c9a85f" stroke="#8b6f47" stroke-width="0.4"/>
          <circle cx="110" cy="130" r="56" fill="#c9a85f" opacity="0.08"/>
          <circle cx="110" cy="130" r="32" fill="#c9a85f" opacity="0.12"/>
          <text x="110" y="220" text-anchor="middle" font-family="Cardo, serif" font-size="10" font-style="italic" fill="#3a2818">"The first hammer to strike</text>
          <text x="110" y="234" text-anchor="middle" font-family="Cardo, serif" font-size="10" font-style="italic" fill="#3a2818">a city into being."</text>
          <rect x="10" y="354" width="200" height="14" fill="#1a1208"/>
          <g transform="translate(14, 356)"><rect width="14" height="10" fill="#7a3e2a"/></g>
          <g transform="translate(30, 356)"><rect width="14" height="10" fill="#5a4528"/></g>
          <g transform="translate(46, 356)"><rect width="14" height="10" fill="#3a4a5a" stroke="#c9a85f" stroke-width="1"/><text x="7" y="9" text-anchor="middle" font-size="6">⚒</text></g>
          <g transform="translate(62, 356)"><rect width="14" height="10" fill="#3a2818" stroke="#c9a85f" stroke-width="1"/></g>
          <g transform="translate(78, 356)"><rect width="14" height="10" fill="#2a1f15" stroke="#5a4528" stroke-width="0.3"/></g>
        </svg>

</div>

<p><strong>Frame 05 · ~6s · Continue surfaces</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 220 380" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;border-radius:18px;">
          <defs>
            <pattern id="b5-leather" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill="#2a1f15"/><circle cx="1.5" cy="1.5" r="0.3" fill="#3a2818"/></pattern>
            <pattern id="b5-marble" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="#f4ead5"/><path d="M0 8 Q8 5 15 8 T30 8" stroke="#a8794a" stroke-width="0.3" fill="none" opacity="0.5"/></pattern>
          </defs>
          <rect width="220" height="380" fill="url(#b5-leather)"/>
          <rect width="220" height="380" fill="#0c0805" opacity="0.55"/>
          <text x="110" y="32" text-anchor="middle" font-family="Cardo, serif" font-size="11" font-style="italic" fill="#c9a85f">Bound to your codex</text>
          <line x1="40" y1="42" x2="180" y2="42" stroke="#c9a85f" stroke-width="0.4" opacity="0.5"/>
          <rect x="50" y="80" width="120" height="100" fill="url(#b5-marble)" stroke="#c9a85f" stroke-width="2.5"/>
          <rect x="54" y="84" width="112" height="92" fill="none" stroke="#c9a85f" stroke-width="0.5"/>
          <text x="110" y="134" text-anchor="middle" font-size="40">⚒</text>
          <text x="110" y="160" text-anchor="middle" font-family="Cardo, serif" font-size="11" fill="#3a2818">The Forge</text>
          <text x="110" y="172" text-anchor="middle" font-family="Cardo, serif" font-size="7" fill="#a8794a">★ ★ ★ ★ ★</text>
          <rect x="100" y="76" width="20" height="10" fill="#c9a85f" stroke="#8b6f47" stroke-width="0.4"/>
          <rect x="100" y="174" width="20" height="10" fill="#c9a85f" stroke="#8b6f47" stroke-width="0.4"/>
          <text x="110" y="220" text-anchor="middle" font-family="Cardo, serif" font-size="10" font-style="italic" fill="#3a2818">"The first hammer to strike</text>
          <text x="110" y="234" text-anchor="middle" font-family="Cardo, serif" font-size="10" font-style="italic" fill="#3a2818">a city into being."</text>
          <rect x="40" y="284" width="140" height="32" fill="#7a3e2a" stroke="#c9a85f" stroke-width="0.8"/>
          <text x="110" y="304" text-anchor="middle" font-family="Cardo, serif" font-size="12" fill="#f4ead5" font-style="italic">Continue →</text>
          <rect x="10" y="354" width="200" height="14" fill="#1a1208"/>
          <g transform="translate(14, 356)"><rect width="14" height="10" fill="#7a3e2a"/></g>
          <g transform="translate(30, 356)"><rect width="14" height="10" fill="#5a4528"/></g>
          <g transform="translate(46, 356)"><rect width="14" height="10" fill="#3a4a5a"/><text x="7" y="9" text-anchor="middle" font-size="6">⚒</text></g>
          <g transform="translate(62, 356)"><rect width="14" height="10" fill="#3a2818" stroke="#c9a85f" stroke-width="1"/></g>
          <g transform="translate(78, 356)"><rect width="14" height="10" fill="#2a1f15" stroke="#5a4528" stroke-width="0.3"/></g>
        </svg>

</div>


### 3.4 Era summary

Plays after the bind ceremony's auto page-turn lands. A composed spread, no interactive choice — the player has already chosen.

| Frame | Behavior |
|---|---|
| Summary 01 | Spread translates from y+40 to 0 over 600ms `cubic-bezier(0.2, 0.8, 0.2, 1)`. Frontispiece frame still empty. Brief pause. |
| Summary 02 | Frontispiece paints in via brush wipe (clip-path inset 100% → 0%, 1400ms ease-out, +4px horizontal drift). Brush-on-canvas SFX loops underneath. After wipe, narrative line types in (~30ms/char, faint pen scratch every 6 chars). Stats fade in after typing. |
| Summary 03 | Thin gilt button surfaces: "Begin Chapter [next] →". Manual tap continues — player paces themselves. Tap → page-turn (700ms peel) into next chapter. |

**Note:** Summary 03's tap is manual, not auto-advance. The bind→summary transition was auto because the hold *was* the player's commitment. The summary→next transition is manual because the player may want to sit with the tapestry.

#### Visual reference

<p><strong>Frame 01 · 0.0s · Last objective ticks</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 220 380" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;border-radius:18px;">
          <defs>
            <pattern id="e1-leather" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill="#2a1f15"/><circle cx="1.5" cy="1.5" r="0.3" fill="#3a2818"/></pattern>
            <pattern id="e1-marble" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="#f4ead5"/><path d="M0 8 Q8 5 15 8 T30 8" stroke="#a8794a" stroke-width="0.3" fill="none" opacity="0.5"/></pattern>
          </defs>
          <rect width="220" height="380" fill="url(#e1-leather)"/>
          <rect x="10" y="14" width="200" height="22" fill="#1a1208"/>
          <text x="110" y="29" text-anchor="middle" font-family="Cardo, Georgia, serif" font-size="10" font-style="italic" fill="#c9a85f">Chapter III · Bronze Age</text>
          <rect x="10" y="44" width="200" height="58" fill="#f4ead5" stroke="#c9a85f" stroke-width="1"/>
          <text x="20" y="60" font-family="Inter, sans-serif" font-size="7" fill="#7a3e2a" letter-spacing="1">OBJECTIVES</text>
          <text x="20" y="76" font-family="Cardo, serif" font-size="10" fill="#3a2818">✓ Smelt copper</text>
          <text x="20" y="90" font-family="Cardo, serif" font-size="10" fill="#3a2818">✓ Build a city</text>
          <text x="120" y="76" font-family="Cardo, serif" font-size="10" fill="#3a2818">✓ Forge alloy</text>
          <text x="120" y="90" font-family="Cardo, serif" font-size="10" fill="#3a2818">✓ Write laws</text>
          <rect x="10" y="110" width="200" height="160" fill="#1a1208" stroke="#5a4528" stroke-width="0.4"/>
          <text x="110" y="124" text-anchor="middle" font-family="Cardo, serif" font-size="8" font-style="italic" fill="#a8794a">— the writing desk —</text>
          <g transform="translate(82, 160)">
            <rect width="56" height="76" fill="url(#e1-marble)" stroke="#c9a85f" stroke-width="1.5"/>
            <text x="28" y="42" text-anchor="middle" font-size="22">📜</text>
            <text x="28" y="60" text-anchor="middle" font-family="Cardo, serif" font-size="8" fill="#3a2818">Code of Laws</text>
            <text x="28" y="68" text-anchor="middle" font-family="Cardo, serif" font-size="6" fill="#a8794a">★ ★ ★ ★</text>
          </g>
          <text x="110" y="288" text-anchor="middle" font-family="Cardo, serif" font-size="9" font-style="italic" fill="#a8794a">all surveys complete</text>
          <rect x="10" y="304" width="200" height="64" fill="#3a2818" stroke="#5a4528" stroke-width="0.4"/>
        </svg>

</div>

<p><strong>Frame 02 · 0.3s · The room holds its breath</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 220 380" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;border-radius:18px;">
          <defs>
            <pattern id="e2-leather" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill="#2a1f15"/><circle cx="1.5" cy="1.5" r="0.3" fill="#3a2818"/></pattern>
          </defs>
          <rect width="220" height="380" fill="url(#e2-leather)"/>
          <rect width="220" height="380" fill="#1a1208" opacity="0.55"/>
          <rect x="10" y="14" width="200" height="22" fill="#1a1208" opacity="0.9"/>
          <text x="110" y="29" text-anchor="middle" font-family="Cardo, serif" font-size="10" font-style="italic" fill="#c9a85f" opacity="0.5">Chapter III · Bronze Age</text>
          <rect x="10" y="44" width="200" height="58" fill="#5a4528" opacity="0.4"/>
          <rect x="10" y="110" width="200" height="160" fill="#0c0805" opacity="0.7"/>
          <g transform="translate(82, 160)" opacity="0.35">
            <rect width="56" height="76" fill="#5a4528"/>
            <text x="28" y="42" text-anchor="middle" font-size="22" opacity="0.6">📜</text>
          </g>
          <rect x="10" y="304" width="200" height="64" fill="#0c0805" opacity="0.7"/>
          <circle cx="110" cy="190" r="50" fill="#c9a85f" opacity="0.04"/>
          <circle cx="110" cy="190" r="30" fill="#c9a85f" opacity="0.06"/>
          <circle cx="110" cy="190" r="14" fill="#c9a85f" opacity="0.1"/>
        </svg>

</div>

<p><strong>Frame 03 · 1.0s · The book opens</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 220 380" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;border-radius:18px;">
          <defs>
            <pattern id="e3-marble" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="#f4ead5"/><path d="M0 8 Q8 5 15 8 T30 8" stroke="#a8794a" stroke-width="0.3" fill="none" opacity="0.5"/><path d="M0 22 Q8 18 15 22 T30 22" stroke="#7a3e2a" stroke-width="0.25" fill="none" opacity="0.4"/></pattern>
          </defs>
          <rect width="220" height="380" fill="#0c0805"/>
          <rect x="10" y="14" width="200" height="358" fill="url(#e3-marble)" stroke="#8b6f47" stroke-width="1.5"/>
          <text x="110" y="38" text-anchor="middle" font-family="Cardo, serif" font-size="9" font-style="italic" fill="#7a3e2a">— Chapter III —</text>
          <text x="110" y="58" text-anchor="middle" font-family="Cardo, serif" font-size="14" fill="#3a2818">The Bronze Age</text>
          <line x1="60" y1="66" x2="160" y2="66" stroke="#8b6f47" stroke-width="0.4"/>
          <rect x="30" y="78" width="160" height="120" fill="#5a4528" stroke="#8b6f47" stroke-width="0.8"/>
          <rect x="34" y="82" width="152" height="112" fill="#7a3e2a" opacity="0.4"/>
          <text x="110" y="142" text-anchor="middle" font-family="Cardo, serif" font-size="8" font-style="italic" fill="#a8794a" opacity="0.7">[ painting in progress ]</text>
          <line x1="34" y1="170" x2="100" y2="170" stroke="#a8794a" stroke-width="0.6" opacity="0.5"/>
          <line x1="100" y1="170" x2="186" y2="170" stroke="#a8794a" stroke-width="0.6" opacity="0.2"/>
          <text x="110" y="220" text-anchor="middle" font-family="Cardo, serif" font-size="9" font-style="italic" fill="#7a3e2a" opacity="0.4">. . .</text>
        </svg>

</div>

<p><strong>Frame 04 · 2.0s · Frontispiece reveals</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 220 380" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;border-radius:18px;">
          <defs>
            <pattern id="e4-marble" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="#f4ead5"/><path d="M0 8 Q8 5 15 8 T30 8" stroke="#a8794a" stroke-width="0.3" fill="none" opacity="0.5"/><path d="M0 22 Q8 18 15 22 T30 22" stroke="#7a3e2a" stroke-width="0.25" fill="none" opacity="0.4"/></pattern>
          </defs>
          <rect width="220" height="380" fill="#0c0805"/>
          <rect x="10" y="14" width="200" height="358" fill="url(#e4-marble)" stroke="#8b6f47" stroke-width="1.5"/>
          <text x="110" y="38" text-anchor="middle" font-family="Cardo, serif" font-size="9" font-style="italic" fill="#7a3e2a">— Chapter III —</text>
          <text x="110" y="58" text-anchor="middle" font-family="Cardo, serif" font-size="14" fill="#3a2818">The Bronze Age</text>
          <line x1="60" y1="66" x2="160" y2="66" stroke="#8b6f47" stroke-width="0.4"/>
          <rect x="30" y="78" width="160" height="120" fill="#5a4528" stroke="#8b6f47" stroke-width="0.8"/>
          <rect x="34" y="82" width="152" height="112" fill="#7a3e2a" opacity="0.7"/>
          <text x="110" y="142" text-anchor="middle" font-family="Cardo, serif" font-size="8" font-style="italic" fill="#f4ead5">[ AI-painted frontispiece ]</text>
          <text x="110" y="218" text-anchor="middle" font-family="Cardo, serif" font-size="11" font-style="italic" fill="#3a2818">"Smoke from a hundred furnaces.</text>
          <text x="110" y="232" text-anchor="middle" font-family="Cardo, serif" font-size="11" font-style="italic" fill="#3a2818">A king learns the weight</text>
          <text x="110" y="246" text-anchor="middle" font-family="Cardo, serif" font-size="11" font-style="italic" fill="#3a2818">of laws.<tspan fill="#3a2818" opacity="0.4">|</tspan>"</text>
          <line x1="40" y1="266" x2="180" y2="266" stroke="#8b6f47" stroke-width="0.3"/>
          <text x="32" y="284" font-family="Cardo, serif" font-size="9" fill="#7a3e2a">73 combinations</text>
          <text x="32" y="298" font-family="Cardo, serif" font-size="9" fill="#7a3e2a">14 new ideas</text>
          <text x="120" y="284" font-family="Cardo, serif" font-size="9" fill="#7a3e2a">★★★★★ Forge</text>
          <text x="120" y="298" font-family="Cardo, serif" font-size="9" fill="#7a3e2a">★★★★ City-state</text>
        </svg>

</div>

<p><strong>Frame 06 · ~6s · The tile is bound (legacy combined-view)</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 220 380" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;border-radius:18px;">
          <defs>
            <pattern id="e6-marble" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="#f4ead5"/><path d="M0 8 Q8 5 15 8 T30 8" stroke="#a8794a" stroke-width="0.3" fill="none" opacity="0.5"/></pattern>
          </defs>
          <rect width="220" height="380" fill="#0c0805"/>
          <rect x="10" y="14" width="200" height="358" fill="url(#e6-marble)" stroke="#8b6f47" stroke-width="1.5"/>
          <text x="110" y="36" text-anchor="middle" font-family="Cardo, serif" font-size="11" font-style="italic" fill="#7a3e2a">Bound to your codex</text>
          <line x1="40" y1="46" x2="180" y2="46" stroke="#8b6f47" stroke-width="0.3"/>
          <rect x="50" y="62" width="120" height="100" fill="url(#e6-marble)" stroke="#c9a85f" stroke-width="2.5"/>
          <rect x="54" y="66" width="112" height="92" fill="none" stroke="#c9a85f" stroke-width="0.5"/>
          <text x="110" y="116" text-anchor="middle" font-size="40">⚒</text>
          <text x="110" y="142" text-anchor="middle" font-family="Cardo, serif" font-size="11" fill="#3a2818">The Forge</text>
          <text x="110" y="154" text-anchor="middle" font-family="Cardo, serif" font-size="7" fill="#a8794a">★ ★ ★ ★ ★</text>
          <rect x="100" y="58" width="20" height="10" fill="#c9a85f" stroke="#8b6f47" stroke-width="0.4"/>
          <rect x="100" y="156" width="20" height="10" fill="#c9a85f" stroke="#8b6f47" stroke-width="0.4"/>
          <text x="110" y="186" text-anchor="middle" font-family="Cardo, serif" font-size="9" font-style="italic" fill="#7a3e2a">— bound, chapter III —</text>
          <text x="110" y="220" text-anchor="middle" font-family="Cardo, serif" font-size="10" font-style="italic" fill="#3a2818">"The first hammer to strike</text>
          <text x="110" y="234" text-anchor="middle" font-family="Cardo, serif" font-size="10" font-style="italic" fill="#3a2818">a city into being."</text>
          <line x1="40" y1="252" x2="180" y2="252" stroke="#8b6f47" stroke-width="0.3"/>
          <rect x="20" y="270" width="180" height="14" fill="#1a1208"/>
          <g transform="translate(24, 272)"><rect width="14" height="10" fill="#7a3e2a"/></g>
          <g transform="translate(40, 272)"><rect width="14" height="10" fill="#5a4528"/></g>
          <g transform="translate(56, 272)"><rect width="14" height="10" fill="#c9a85f"/><text x="7" y="9" text-anchor="middle" font-size="6">⚒</text></g>
          <g transform="translate(72, 272)"><rect width="14" height="10" fill="#3a2818" stroke="#5a4528" stroke-width="0.3"/></g>
          <g transform="translate(88, 272)"><rect width="14" height="10" fill="#3a2818" stroke="#5a4528" stroke-width="0.3"/></g>
          <g transform="translate(104, 272)"><rect width="14" height="10" fill="#3a2818" stroke="#5a4528" stroke-width="0.3"/></g>
          <g transform="translate(120, 272)"><rect width="14" height="10" fill="#3a2818" stroke="#5a4528" stroke-width="0.3"/></g>
          <g transform="translate(136, 272)"><rect width="14" height="10" fill="#3a2818" stroke="#5a4528" stroke-width="0.3"/></g>
          <g transform="translate(152, 272)"><rect width="14" height="10" fill="#3a2818" stroke="#5a4528" stroke-width="0.3"/></g>
          <g transform="translate(168, 272)"><rect width="14" height="10" fill="#3a2818" stroke="#5a4528" stroke-width="0.3"/></g>
          <g transform="translate(184, 272)"><rect width="14" height="10" fill="#3a2818" stroke="#5a4528" stroke-width="0.3"/></g>
          <rect x="30" y="316" width="160" height="32" fill="#7a3e2a" stroke="#c9a85f" stroke-width="0.8"/>
          <text x="110" y="336" text-anchor="middle" font-family="Cardo, serif" font-size="12" fill="#f4ead5" font-style="italic">Begin Chapter IV →</text>
        </svg>

</div>


### 3.5 Library

Persistent, account-bound, accessible from main menu and run-end overlay. 24 tiles maximum.

**Layout:** 6 rows × 4 columns. Tiles fill chronologically (left-to-right, top-to-bottom in retire order). Each tile is 32×44 with a 2.5px binding stripe on left + top edges.

**States:**

| State | Visual |
|---|---|
| Empty slot | `#2a1f15` fill, 0.3px leather border |
| Filled tile | Marbled vellum fill, chapter-color binding stripe, emoji, italic name |
| Counter (footer) | "X of 24 kept" — muted ochre when not full, gilt when full |

**Interactions:**

- **Tap a tile** → pull-up sheet shows full bookplate (large), italic narrative, tier stars, "From your Nth run · Chapter [roman] · [Era name]", era's tapestry thumb. Same component as strip tile peek and bind ceremony peek.
- **Share button** at bottom → generates Open Graph card, copies stable URL.

**Wall-full state (24/24):**

- Counter changes to gilt.
- Footer text appears: "your shelf is full · the next chapter you bind will ask you to choose."
- No automatic action triggered — only the next bind triggers retirement.

#### Visual reference

<p><strong>Library across runs (Bibliophile direction)</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 220 440" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;border-radius:22px;">
          <defs>
            <pattern id="b-wood" width="40" height="6" patternUnits="userSpaceOnUse"><rect width="40" height="6" fill="#2a1f15"/><line x1="0" y1="3" x2="40" y2="3" stroke="#3a2818" stroke-width="0.3"/></pattern>
          </defs>
          <rect width="220" height="440" fill="url(#b-wood)"/>
          <text x="110" y="32" text-anchor="middle" font-family="Cardo, serif" font-size="14" font-style="italic" fill="#c9a85f">Your Library</text>
          <text x="110" y="46" text-anchor="middle" font-family="Inter, sans-serif" font-size="8" fill="#a8794a" letter-spacing="1">4 RUNS · 44 VOLUMES · 12 PLATES</text>
          <rect x="10" y="60" width="200" height="76" fill="#1a1208" stroke="#8b6f47" stroke-width="0.5"/>
          <rect x="10" y="130" width="200" height="6" fill="#5a4528"/>
          <text x="20" y="74" font-family="Inter, sans-serif" font-size="8" fill="#a8794a" letter-spacing="1">RUN 1 · STONE→SPACE</text>
          <g transform="translate(16, 80)"><rect width="14" height="46" fill="#7a3e2a" stroke="#c9a85f" stroke-width="0.4"/><text x="7" y="28" text-anchor="middle" font-size="10">🔥</text></g>
          <g transform="translate(32, 80)"><rect width="14" height="46" fill="#5a4528" stroke="#c9a85f" stroke-width="0.4"/><text x="7" y="28" text-anchor="middle" font-size="10">🌾</text></g>
          <g transform="translate(48, 80)"><rect width="14" height="46" fill="#c9a85f"/><text x="7" y="28" text-anchor="middle" font-size="10">⚒</text></g>
          <g transform="translate(64, 80)"><rect width="14" height="46" fill="#3a2818" stroke="#c9a85f" stroke-width="0.4"/><text x="7" y="28" text-anchor="middle" font-size="10">📜</text></g>
          <g transform="translate(80, 80)"><rect width="14" height="46" fill="#7a3e2a" stroke="#c9a85f" stroke-width="0.4"/><text x="7" y="28" text-anchor="middle" font-size="10">⛵</text></g>
          <g transform="translate(96, 80)"><rect width="14" height="46" fill="#5a4528" stroke="#c9a85f" stroke-width="0.4"/><text x="7" y="28" text-anchor="middle" font-size="10">📖</text></g>
          <g transform="translate(112, 80)"><rect width="14" height="46" fill="#7a3e2a" stroke="#c9a85f" stroke-width="0.4"/><text x="7" y="28" text-anchor="middle" font-size="10">⚙</text></g>
          <g transform="translate(128, 80)"><rect width="14" height="46" fill="#5a4528" stroke="#c9a85f" stroke-width="0.4"/><text x="7" y="28" text-anchor="middle" font-size="10">💡</text></g>
          <g transform="translate(144, 80)"><rect width="14" height="46" fill="#c9a85f"/><text x="7" y="28" text-anchor="middle" font-size="10">⚛</text></g>
          <g transform="translate(160, 80)"><rect width="14" height="46" fill="#3a2818" stroke="#c9a85f" stroke-width="0.4"/><text x="7" y="28" text-anchor="middle" font-size="10">🛰</text></g>
          <g transform="translate(176, 80)"><rect width="14" height="46" fill="#7a3e2a" stroke="#c9a85f" stroke-width="0.4"/><text x="7" y="28" text-anchor="middle" font-size="10">🪐</text></g>
          <rect x="10" y="146" width="200" height="76" fill="#1a1208" stroke="#8b6f47" stroke-width="0.5"/>
          <rect x="10" y="216" width="200" height="6" fill="#5a4528"/>
          <text x="20" y="160" font-family="Inter, sans-serif" font-size="8" fill="#a8794a" letter-spacing="1">RUN 2 · JOMON→REIWA</text>
          <g transform="translate(16, 166)"><rect width="14" height="46" fill="#5a4528" stroke="#c9a85f" stroke-width="0.4"/><text x="7" y="28" text-anchor="middle" font-size="10">🌊</text></g>
          <g transform="translate(32, 166)"><rect width="14" height="46" fill="#7a3e2a" stroke="#c9a85f" stroke-width="0.4"/><text x="7" y="28" text-anchor="middle" font-size="10">🏹</text></g>
          <g transform="translate(48, 166)"><rect width="14" height="46" fill="#3a2818" stroke="#c9a85f" stroke-width="0.4"/><text x="7" y="28" text-anchor="middle" font-size="10">🐎</text></g>
          <g transform="translate(64, 166)"><rect width="14" height="46" fill="#c9a85f"/><text x="7" y="28" text-anchor="middle" font-size="10">🗡</text></g>
          <g transform="translate(80, 166)"><rect width="14" height="46" fill="#5a4528" stroke="#c9a85f" stroke-width="0.4"/><text x="7" y="28" text-anchor="middle" font-size="10">⚖</text></g>
          <g transform="translate(96, 166)"><rect width="14" height="46" fill="#7a3e2a" stroke="#c9a85f" stroke-width="0.4"/><text x="7" y="28" text-anchor="middle" font-size="10">🕯</text></g>
          <g transform="translate(112, 166)"><rect width="14" height="46" fill="#3a2818" stroke="#c9a85f" stroke-width="0.4"/><text x="7" y="28" text-anchor="middle" font-size="10">⚙</text></g>
          <g transform="translate(128, 166)"><rect width="14" height="46" fill="#5a4528" stroke="#c9a85f" stroke-width="0.4"/><text x="7" y="28" text-anchor="middle" font-size="10">🚂</text></g>
          <g transform="translate(144, 166)"><rect width="14" height="46" fill="#7a3e2a" stroke="#c9a85f" stroke-width="0.4"/><text x="7" y="28" text-anchor="middle" font-size="10">📺</text></g>
          <text x="20" y="244" font-family="Inter, sans-serif" font-size="8" fill="#a8794a" letter-spacing="1">FRONTISPIECES</text>
          <g transform="translate(16, 250)"><rect width="58" height="44" fill="#a8794a" stroke="#8b6f47" stroke-width="1"/><text x="29" y="28" text-anchor="middle" font-family="Cardo, serif" font-size="6" font-style="italic" fill="#3a2818">Stone Age</text></g>
          <g transform="translate(80, 250)"><rect width="58" height="44" fill="#7a3e2a" stroke="#8b6f47" stroke-width="1"/><text x="29" y="28" text-anchor="middle" font-family="Cardo, serif" font-size="6" font-style="italic" fill="#f4ead5">Bronze</text></g>
          <g transform="translate(144, 250)"><rect width="58" height="44" fill="#5a4528" stroke="#8b6f47" stroke-width="1"/><text x="29" y="28" text-anchor="middle" font-family="Cardo, serif" font-size="6" font-style="italic" fill="#f4ead5">Classical</text></g>
          <g transform="translate(16, 300)"><rect width="58" height="44" fill="#3a2818" stroke="#8b6f47" stroke-width="1"/><text x="29" y="28" text-anchor="middle" font-family="Cardo, serif" font-size="6" font-style="italic" fill="#f4ead5">Medieval</text></g>
          <g transform="translate(80, 300)"><rect width="58" height="44" fill="#7a3e2a" stroke="#8b6f47" stroke-width="1"/><text x="29" y="28" text-anchor="middle" font-family="Cardo, serif" font-size="6" font-style="italic" fill="#f4ead5">Industrial</text></g>
          <g transform="translate(144, 300)"><rect width="58" height="44" fill="#5a4528" stroke="#8b6f47" stroke-width="1"/><text x="29" y="28" text-anchor="middle" font-family="Cardo, serif" font-size="6" font-style="italic" fill="#f4ead5">Atomic</text></g>
          <text x="110" y="370" text-anchor="middle" font-family="Cardo, serif" font-size="10" font-style="italic" fill="#a8794a">tap a spine to read</text>
          <rect x="40" y="386" width="140" height="28" fill="#3a2818" stroke="#c9a85f" stroke-width="0.5"/>
          <text x="110" y="404" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" fill="#c9a85f" letter-spacing="2">SHARE LIBRARY  →</text>
        </svg>

</div>


### 3.6 Retirement ceremony

Triggered automatically when the player binds a new tile while the library is at 24/24. Inserts itself between the bind ceremony's commit and the era summary.

| Frame | Behavior |
|---|---|
| Retire 01 | Page-turn from bind ceremony lands on library wall view, with new tile suspended above (oversized, gilt halo). Wall darkened to 78%. Italic header: "twenty-four spaces. one must yield." Below new tile: "hold a tile to give it back". Bottom hint: "— or release [new tile] to the world too —". Cello C2 begins sustaining. |
| Retire 02 | Player long-presses an existing library tile. Pressed tile rises 4px, scales 1.0 → 1.06 (200ms), halo appears around it. Hold-arc draws under tile. Other library tiles dim to 40%. New tile dims to 70%. |
| Retire 03 | Hold reaches 2.5s. **COMMIT.** Selected tile scales 1.0 → 1.2 (200ms), then dissolves into ~9 small ink-points (using existing wax-droplet primitive) that drift upward and fade over 1.4s. Empty slot stays dashed-border for 600ms. Wax stamp click SFX (~80ms). Cello descends C2 → G1 (1.6s tail). Soft thud haptic. |
| Retire 04 | After 600ms silence, new tile descends from above into the empty slot. Brass-clasp animation (220ms). Cello tonic resolves ascending. Page auto-turns into era summary. Counter remains "24 of 24" — shelf is whole again. |

**Wall-full first-time experience** (one-time only, on first 24/24 retirement):

- Retire 01 copy is more explicit: "your shelf is full · to keep [new tile name], give one back to the world."
- After ~3s of stillness, **Bari speaks** (in margin text, not aloud) — the only time in the entire game: "*— a shelf is what we choose to keep here. press one to send it onward.*"
- All subsequent retirements use the standard ceremony copy. Bari is silent forever after.

**"Don't keep this chapter" affordance:**

- Throughout the wall-full ceremony, a small option is visible: release the new tile instead of retiring an existing one.
- If chosen, the new tile dissolves the same way a retired tile does. The library is unchanged. The current chapter is not bound.
- This honors the existing shelf — declining to add is also an authorial act.

### 3.7 Vault

A separate persistent page from the library. Contains all retired tiles ever, in chronological retire-order.

**Layout:** Vertical scrolling list. Each entry shows only the tile's binding spine — the chapter color, the chapter Roman numeral, but **not** the tile face, name, or narrative. The information loss is the meaning.

**Interactions:**

- **Tap a spine** → minimal info card: "Given to the world · Run [N] · Chapter [roman]". No tile face, no name, no narrative. Just acknowledgment that it existed.
- **No retrieval.** Retired tiles cannot be recovered. The vault is a memorial, not an archive.

**Engineering note:** Store the full tile data on retire (for future multiplayer / community pool features) but **do not surface it** in the vault UI. The data exists; the player just can't access it.

### 3.8 Run end

Triggered after the eleventh chapter's bind ceremony (or after the final chapter, if chapter count varies). The strip is now full of eleven kept books.

| Frame | Behavior |
|---|---|
| End 01 | After the eleventh clasp completes, hold for ~600ms. Then a red wax seal scales 1.4 → 1.0 (320ms with overshoot) onto the strip's center. Three small wax-droplet dots fan out and fade. Gilt "A" embossed inward on the seal. Low cathedral bell tolls (~110Hz, 4s tail) — **the only place this sound exists**. Heavy low thud haptic — **the only "thud" haptic in the run**. |
| End 02 | "Age of Plenty" overlay rises. Title types in (1.6s after bell starts). Stats fade in (800ms after title). "Open the library →" button appears last (1.5s after stats). Workshop bed restored very quietly. Bell still ringing through. |

---

## 4. Strip behavior

The strip is the most load-bearing element in the build. It's onscreen for ~95% of the run, evolving in real time with the player's commitments.

#### Visual reference

<p><strong>State A · Locked</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 200 36" xmlns="http://www.w3.org/2000/svg" style="width:100px;display:block;">
      <rect width="200" height="36" fill="#1a1208"/>
      <g transform="translate(72, 4)">
        <rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/>
        <text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">III</text>
      </g>
    </svg>

</div>

<p><strong>State B · Active</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 200 36" xmlns="http://www.w3.org/2000/svg" style="width:100px;display:block;">
      <rect width="200" height="36" fill="#1a1208"/>
      <g transform="translate(72, 4)">
        <rect width="56" height="28" fill="#3a2818" stroke="#c9a85f" stroke-width="1"/>
        <text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="11" font-style="italic" fill="#c9a85f">III</text>
      </g>
    </svg>

</div>

<p><strong>State C · Awaiting binding</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 200 36" xmlns="http://www.w3.org/2000/svg" style="width:100px;display:block;">
      <rect width="200" height="36" fill="#1a1208"/>
      <g transform="translate(72, 4)">
        <rect width="56" height="28" fill="#3a2818" stroke="#c9a85f" stroke-width="1.5"/>
        <rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.5" stroke-dasharray="2 2"/>
        <text x="14" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="11" fill="#c9a85f" opacity="0.6">⌑</text>
        <text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">III</text>
      </g>
    </svg>

</div>

<p><strong>State D · Bound</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 200 36" xmlns="http://www.w3.org/2000/svg" style="width:100px;display:block;">
      <rect width="200" height="36" fill="#1a1208"/>
      <g transform="translate(72, 4)">
        <rect width="56" height="28" fill="#3a4a5a" stroke="#c9a85f" stroke-width="0.6"/>
        <rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/>
        <text x="14" y="20" text-anchor="middle" font-size="14">⚒</text>
        <text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">III</text>
      </g>
    </svg>

</div>

<p><strong>Run start · all eleven plates locked</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 680 36" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
      <rect width="680" height="36" fill="#1a1208"/>
      <g transform="translate(20, 4)"><rect width="56" height="28" fill="#3a2818" stroke="#c9a85f" stroke-width="1"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="11" font-style="italic" fill="#c9a85f">I</text></g>
      <g transform="translate(80, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">II</text></g>
      <g transform="translate(140, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">III</text></g>
      <g transform="translate(200, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">IV</text></g>
      <g transform="translate(260, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">V</text></g>
      <g transform="translate(320, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VI</text></g>
      <g transform="translate(380, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VII</text></g>
      <g transform="translate(440, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VIII</text></g>
      <g transform="translate(500, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">IX</text></g>
      <g transform="translate(560, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">X</text></g>
      <g transform="translate(620, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">XI</text></g>
    </svg>

</div>

<p><strong>Chapter I · awaiting binding (first bind)</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 680 36" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
      <rect width="680" height="36" fill="#1a1208"/>
      <g transform="translate(20, 4)"><rect width="56" height="28" fill="#3a2818" stroke="#c9a85f" stroke-width="1.5"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.5" stroke-dasharray="2 2"/><text x="14" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="11" fill="#c9a85f" opacity="0.6">⌑</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">I</text></g>
      <g transform="translate(80, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">II</text></g>
      <g transform="translate(140, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">III</text></g>
      <g transform="translate(200, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">IV</text></g>
      <g transform="translate(260, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">V</text></g>
      <g transform="translate(320, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VI</text></g>
      <g transform="translate(380, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VII</text></g>
      <g transform="translate(440, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VIII</text></g>
      <g transform="translate(500, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">IX</text></g>
      <g transform="translate(560, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">X</text></g>
      <g transform="translate(620, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">XI</text></g>
    </svg>

</div>

<p><strong>After chapter III bound · 3 spines kept</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 680 36" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
      <rect width="680" height="36" fill="#1a1208"/>
      <g transform="translate(20, 4)"><rect width="56" height="28" fill="#7a3e2a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">🔦</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">I</text></g>
      <g transform="translate(80, 4)"><rect width="56" height="28" fill="#5a4528" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚒</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">II</text></g>
      <g transform="translate(140, 4)"><rect width="56" height="28" fill="#3a4a5a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">📜</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">III</text></g>
      <g transform="translate(200, 4)"><rect width="56" height="28" fill="#3a2818" stroke="#c9a85f" stroke-width="1"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="11" font-style="italic" fill="#c9a85f">IV</text></g>
      <g transform="translate(260, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">V</text></g>
      <g transform="translate(320, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VI</text></g>
      <g transform="translate(380, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VII</text></g>
      <g transform="translate(440, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VIII</text></g>
      <g transform="translate(500, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">IX</text></g>
      <g transform="translate(560, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">X</text></g>
      <g transform="translate(620, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">XI</text></g>
    </svg>

</div>

<p><strong>Chapter VI · awaiting binding (mid-run)</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 680 36" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
      <rect width="680" height="36" fill="#1a1208"/>
      <g transform="translate(20, 4)"><rect width="56" height="28" fill="#7a3e2a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">🔦</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">I</text></g>
      <g transform="translate(80, 4)"><rect width="56" height="28" fill="#5a4528" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚒</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">II</text></g>
      <g transform="translate(140, 4)"><rect width="56" height="28" fill="#3a4a5a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">📜</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">III</text></g>
      <g transform="translate(200, 4)"><rect width="56" height="28" fill="#4a2828" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚔</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">IV</text></g>
      <g transform="translate(260, 4)"><rect width="56" height="28" fill="#1d4a5e" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⛵</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">V</text></g>
      <g transform="translate(320, 4)"><rect width="56" height="28" fill="#3a2818" stroke="#c9a85f" stroke-width="1.5"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.5" stroke-dasharray="2 2"/><text x="14" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="11" fill="#c9a85f" opacity="0.6">⌑</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">VI</text></g>
      <g transform="translate(380, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VII</text></g>
      <g transform="translate(440, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VIII</text></g>
      <g transform="translate(500, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">IX</text></g>
      <g transform="translate(560, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">X</text></g>
      <g transform="translate(620, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">XI</text></g>
    </svg>

</div>

<p><strong>Chapter XI · the final binding</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 680 36" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
      <rect width="680" height="36" fill="#1a1208"/>
      <g transform="translate(20, 4)"><rect width="56" height="28" fill="#7a3e2a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">🔦</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">I</text></g>
      <g transform="translate(80, 4)"><rect width="56" height="28" fill="#5a4528" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚒</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">II</text></g>
      <g transform="translate(140, 4)"><rect width="56" height="28" fill="#3a4a5a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">📜</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">III</text></g>
      <g transform="translate(200, 4)"><rect width="56" height="28" fill="#4a2828" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚔</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">IV</text></g>
      <g transform="translate(260, 4)"><rect width="56" height="28" fill="#1d4a5e" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⛵</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">V</text></g>
      <g transform="translate(320, 4)"><rect width="56" height="28" fill="#5a3a4a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">🎭</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">VI</text></g>
      <g transform="translate(380, 4)"><rect width="56" height="28" fill="#2a3a3a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚙</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">VII</text></g>
      <g transform="translate(440, 4)"><rect width="56" height="28" fill="#4a4628" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">💡</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">VIII</text></g>
      <g transform="translate(500, 4)"><rect width="56" height="28" fill="#1a3030" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚛</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">IX</text></g>
      <g transform="translate(560, 4)"><rect width="56" height="28" fill="#444441" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">🛰</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">X</text></g>
      <g transform="translate(620, 4)"><rect width="56" height="28" fill="#3a2818" stroke="#c9a85f" stroke-width="2"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.6" stroke-dasharray="2 2"/><text x="14" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="11" fill="#c9a85f" opacity="0.7">⌑</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">XI</text></g>
    </svg>

</div>


#### Strip evolution across a run

*Earlier design exploration showing the eleven-cube strip filling chapter by chapter. Note: this exploration used larger 56×28 cubes and showed only run-progress; the current spec uses the smaller 16×20 mid-run cubes that double as inventory (see Section 4 above). The chromatic progression and strip-as-spine concept is preserved.*

<p><strong>Stage 0 · Run begins</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 680 36" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
      <rect width="680" height="36" fill="#1a1208"/>
      <g transform="translate(20, 4)"><rect width="56" height="28" fill="#3a2818" stroke="#c9a85f" stroke-width="1"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="11" font-style="italic" fill="#c9a85f">I</text></g>
      <g transform="translate(80, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">II</text></g>
      <g transform="translate(140, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">III</text></g>
      <g transform="translate(200, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">IV</text></g>
      <g transform="translate(260, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">V</text></g>
      <g transform="translate(320, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VI</text></g>
      <g transform="translate(380, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VII</text></g>
      <g transform="translate(440, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VIII</text></g>
      <g transform="translate(500, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">IX</text></g>
      <g transform="translate(560, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">X</text></g>
      <g transform="translate(620, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">XI</text></g>
    </svg>

</div>

<p><strong>Stage 1 · Stone Age bound</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 680 36" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
      <rect width="680" height="36" fill="#1a1208"/>
      <g transform="translate(20, 4)"><rect width="56" height="28" fill="#7a3e2a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">🔦</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">I</text></g>
      <g transform="translate(80, 4)"><rect width="56" height="28" fill="#3a2818" stroke="#c9a85f" stroke-width="1"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="11" font-style="italic" fill="#c9a85f">II</text></g>
      <g transform="translate(140, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">III</text></g>
      <g transform="translate(200, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">IV</text></g>
      <g transform="translate(260, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">V</text></g>
      <g transform="translate(320, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VI</text></g>
      <g transform="translate(380, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VII</text></g>
      <g transform="translate(440, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VIII</text></g>
      <g transform="translate(500, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">IX</text></g>
      <g transform="translate(560, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">X</text></g>
      <g transform="translate(620, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">XI</text></g>
    </svg>

</div>

<p><strong>Stage 2 · Bronze Age bound</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 680 36" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
      <rect width="680" height="36" fill="#1a1208"/>
      <g transform="translate(20, 4)"><rect width="56" height="28" fill="#7a3e2a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">🔦</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">I</text></g>
      <g transform="translate(80, 4)"><rect width="56" height="28" fill="#5a4528" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚒</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">II</text></g>
      <g transform="translate(140, 4)"><rect width="56" height="28" fill="#3a2818" stroke="#c9a85f" stroke-width="1"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="11" font-style="italic" fill="#c9a85f">III</text></g>
      <g transform="translate(200, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">IV</text></g>
      <g transform="translate(260, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">V</text></g>
      <g transform="translate(320, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VI</text></g>
      <g transform="translate(380, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VII</text></g>
      <g transform="translate(440, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VIII</text></g>
      <g transform="translate(500, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">IX</text></g>
      <g transform="translate(560, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">X</text></g>
      <g transform="translate(620, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">XI</text></g>
    </svg>

</div>

<p><strong>Stage 3 · Classical Age bound</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 680 36" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
      <rect width="680" height="36" fill="#1a1208"/>
      <g transform="translate(20, 4)"><rect width="56" height="28" fill="#7a3e2a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">🔦</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">I</text></g>
      <g transform="translate(80, 4)"><rect width="56" height="28" fill="#5a4528" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚒</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">II</text></g>
      <g transform="translate(140, 4)"><rect width="56" height="28" fill="#3a4a5a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">📜</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">III</text></g>
      <g transform="translate(200, 4)"><rect width="56" height="28" fill="#3a2818" stroke="#c9a85f" stroke-width="1"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="11" font-style="italic" fill="#c9a85f">IV</text></g>
      <g transform="translate(260, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">V</text></g>
      <g transform="translate(320, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VI</text></g>
      <g transform="translate(380, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VII</text></g>
      <g transform="translate(440, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VIII</text></g>
      <g transform="translate(500, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">IX</text></g>
      <g transform="translate(560, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">X</text></g>
      <g transform="translate(620, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">X</text></g>
    </svg>

</div>

<p><strong>Stage 4 · Medieval bound</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 680 36" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
      <rect width="680" height="36" fill="#1a1208"/>
      <g transform="translate(20, 4)"><rect width="56" height="28" fill="#7a3e2a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">🔦</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">I</text></g>
      <g transform="translate(80, 4)"><rect width="56" height="28" fill="#5a4528" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚒</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">II</text></g>
      <g transform="translate(140, 4)"><rect width="56" height="28" fill="#3a4a5a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">📜</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">III</text></g>
      <g transform="translate(200, 4)"><rect width="56" height="28" fill="#4a2828" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚔</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">IV</text></g>
      <g transform="translate(260, 4)"><rect width="56" height="28" fill="#3a2818" stroke="#c9a85f" stroke-width="1"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="11" font-style="italic" fill="#c9a85f">V</text></g>
      <g transform="translate(320, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VI</text></g>
      <g transform="translate(380, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VII</text></g>
      <g transform="translate(440, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VIII</text></g>
      <g transform="translate(500, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">IX</text></g>
      <g transform="translate(560, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">X</text></g>
      <g transform="translate(620, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">XI</text></g>
    </svg>

</div>

<p><strong>Stage 5 · Age of Sail bound</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 680 36" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
      <rect width="680" height="36" fill="#1a1208"/>
      <g transform="translate(20, 4)"><rect width="56" height="28" fill="#7a3e2a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">🔦</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">I</text></g>
      <g transform="translate(80, 4)"><rect width="56" height="28" fill="#5a4528" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚒</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">II</text></g>
      <g transform="translate(140, 4)"><rect width="56" height="28" fill="#3a4a5a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">📜</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">III</text></g>
      <g transform="translate(200, 4)"><rect width="56" height="28" fill="#4a2828" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚔</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">IV</text></g>
      <g transform="translate(260, 4)"><rect width="56" height="28" fill="#1d4a5e" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⛵</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">V</text></g>
      <g transform="translate(320, 4)"><rect width="56" height="28" fill="#3a2818" stroke="#c9a85f" stroke-width="1"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="11" font-style="italic" fill="#c9a85f">VI</text></g>
      <g transform="translate(380, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VII</text></g>
      <g transform="translate(440, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VIII</text></g>
      <g transform="translate(500, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">IX</text></g>
      <g transform="translate(560, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">X</text></g>
      <g transform="translate(620, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">XI</text></g>
    </svg>

</div>

<p><strong>Stage 6 · Renaissance bound</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 680 36" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
      <rect width="680" height="36" fill="#1a1208"/>
      <g transform="translate(20, 4)"><rect width="56" height="28" fill="#7a3e2a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">🔦</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">I</text></g>
      <g transform="translate(80, 4)"><rect width="56" height="28" fill="#5a4528" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚒</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">II</text></g>
      <g transform="translate(140, 4)"><rect width="56" height="28" fill="#3a4a5a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">📜</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">III</text></g>
      <g transform="translate(200, 4)"><rect width="56" height="28" fill="#4a2828" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚔</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">IV</text></g>
      <g transform="translate(260, 4)"><rect width="56" height="28" fill="#1d4a5e" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⛵</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">V</text></g>
      <g transform="translate(320, 4)"><rect width="56" height="28" fill="#5a3a4a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">🎭</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">VI</text></g>
      <g transform="translate(380, 4)"><rect width="56" height="28" fill="#3a2818" stroke="#c9a85f" stroke-width="1"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="11" font-style="italic" fill="#c9a85f">VII</text></g>
      <g transform="translate(440, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">VIII</text></g>
      <g transform="translate(500, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">IX</text></g>
      <g transform="translate(560, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">X</text></g>
      <g transform="translate(620, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">XI</text></g>
    </svg>

</div>

<p><strong>Stage 7 · Industrial bound</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 680 36" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
      <rect width="680" height="36" fill="#1a1208"/>
      <g transform="translate(20, 4)"><rect width="56" height="28" fill="#7a3e2a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">🔦</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">I</text></g>
      <g transform="translate(80, 4)"><rect width="56" height="28" fill="#5a4528" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚒</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">II</text></g>
      <g transform="translate(140, 4)"><rect width="56" height="28" fill="#3a4a5a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">📜</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">III</text></g>
      <g transform="translate(200, 4)"><rect width="56" height="28" fill="#4a2828" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚔</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">IV</text></g>
      <g transform="translate(260, 4)"><rect width="56" height="28" fill="#1d4a5e" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⛵</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">V</text></g>
      <g transform="translate(320, 4)"><rect width="56" height="28" fill="#5a3a4a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">🎭</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">VI</text></g>
      <g transform="translate(380, 4)"><rect width="56" height="28" fill="#2a3a3a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚙</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">VII</text></g>
      <g transform="translate(440, 4)"><rect width="56" height="28" fill="#3a2818" stroke="#c9a85f" stroke-width="1"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="11" font-style="italic" fill="#c9a85f">VIII</text></g>
      <g transform="translate(500, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">IX</text></g>
      <g transform="translate(560, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">X</text></g>
      <g transform="translate(620, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">XI</text></g>
    </svg>

</div>

<p><strong>Stage 8 · Modern bound</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 680 36" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
      <rect width="680" height="36" fill="#1a1208"/>
      <g transform="translate(20, 4)"><rect width="56" height="28" fill="#7a3e2a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">🔦</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">I</text></g>
      <g transform="translate(80, 4)"><rect width="56" height="28" fill="#5a4528" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚒</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">II</text></g>
      <g transform="translate(140, 4)"><rect width="56" height="28" fill="#3a4a5a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">📜</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">III</text></g>
      <g transform="translate(200, 4)"><rect width="56" height="28" fill="#4a2828" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚔</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">IV</text></g>
      <g transform="translate(260, 4)"><rect width="56" height="28" fill="#1d4a5e" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⛵</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">V</text></g>
      <g transform="translate(320, 4)"><rect width="56" height="28" fill="#5a3a4a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">🎭</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">VI</text></g>
      <g transform="translate(380, 4)"><rect width="56" height="28" fill="#2a3a3a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚙</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">VII</text></g>
      <g transform="translate(440, 4)"><rect width="56" height="28" fill="#4a4628" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">💡</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">VIII</text></g>
      <g transform="translate(500, 4)"><rect width="56" height="28" fill="#3a2818" stroke="#c9a85f" stroke-width="1"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="11" font-style="italic" fill="#c9a85f">IX</text></g>
      <g transform="translate(560, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">X</text></g>
      <g transform="translate(620, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">XI</text></g>
    </svg>

</div>

<p><strong>Stage 9 · Atomic bound</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 680 36" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
      <rect width="680" height="36" fill="#1a1208"/>
      <g transform="translate(20, 4)"><rect width="56" height="28" fill="#7a3e2a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">🔦</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">I</text></g>
      <g transform="translate(80, 4)"><rect width="56" height="28" fill="#5a4528" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚒</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">II</text></g>
      <g transform="translate(140, 4)"><rect width="56" height="28" fill="#3a4a5a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">📜</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">III</text></g>
      <g transform="translate(200, 4)"><rect width="56" height="28" fill="#4a2828" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚔</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">IV</text></g>
      <g transform="translate(260, 4)"><rect width="56" height="28" fill="#1d4a5e" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⛵</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">V</text></g>
      <g transform="translate(320, 4)"><rect width="56" height="28" fill="#5a3a4a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">🎭</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">VI</text></g>
      <g transform="translate(380, 4)"><rect width="56" height="28" fill="#2a3a3a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚙</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">VII</text></g>
      <g transform="translate(440, 4)"><rect width="56" height="28" fill="#4a4628" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">💡</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">VIII</text></g>
      <g transform="translate(500, 4)"><rect width="56" height="28" fill="#1a3030" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚛</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">IX</text></g>
      <g transform="translate(560, 4)"><rect width="56" height="28" fill="#3a2818" stroke="#c9a85f" stroke-width="1"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="11" font-style="italic" fill="#c9a85f">X</text></g>
      <g transform="translate(620, 4)"><rect width="56" height="28" fill="#2a1f15" stroke="#5a4528" stroke-width="0.4"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="10" fill="#5a4528">XI</text></g>
    </svg>

</div>

<p><strong>Stage 10 · Information bound</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 680 36" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
      <rect width="680" height="36" fill="#1a1208"/>
      <g transform="translate(20, 4)"><rect width="56" height="28" fill="#7a3e2a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">🔦</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">I</text></g>
      <g transform="translate(80, 4)"><rect width="56" height="28" fill="#5a4528" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚒</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">II</text></g>
      <g transform="translate(140, 4)"><rect width="56" height="28" fill="#3a4a5a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">📜</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">III</text></g>
      <g transform="translate(200, 4)"><rect width="56" height="28" fill="#4a2828" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚔</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">IV</text></g>
      <g transform="translate(260, 4)"><rect width="56" height="28" fill="#1d4a5e" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⛵</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">V</text></g>
      <g transform="translate(320, 4)"><rect width="56" height="28" fill="#5a3a4a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">🎭</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">VI</text></g>
      <g transform="translate(380, 4)"><rect width="56" height="28" fill="#2a3a3a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚙</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">VII</text></g>
      <g transform="translate(440, 4)"><rect width="56" height="28" fill="#4a4628" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">💡</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">VIII</text></g>
      <g transform="translate(500, 4)"><rect width="56" height="28" fill="#1a3030" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚛</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">IX</text></g>
      <g transform="translate(560, 4)"><rect width="56" height="28" fill="#444441" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">🛰</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">X</text></g>
      <g transform="translate(620, 4)"><rect width="56" height="28" fill="#3a2818" stroke="#c9a85f" stroke-width="1"/><text x="28" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="11" font-style="italic" fill="#c9a85f">XI</text></g>
    </svg>

</div>

<p><strong>Stage 11 · Age of Plenty bound</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 680 48" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
      <defs>
        <pattern id="seal-leather" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill="#1a1208"/><circle cx="1.5" cy="1.5" r="0.3" fill="#2a1f15"/></pattern>
      </defs>
      <rect width="680" height="48" fill="url(#seal-leather)"/>
      <g transform="translate(20, 10)"><rect width="56" height="28" fill="#7a3e2a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">🔦</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">I</text></g>
      <g transform="translate(80, 10)"><rect width="56" height="28" fill="#5a4528" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚒</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">II</text></g>
      <g transform="translate(140, 10)"><rect width="56" height="28" fill="#3a4a5a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">📜</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">III</text></g>
      <g transform="translate(200, 10)"><rect width="56" height="28" fill="#4a2828" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚔</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">IV</text></g>
      <g transform="translate(260, 10)"><rect width="56" height="28" fill="#1d4a5e" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⛵</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">V</text></g>
      <g transform="translate(320, 10)"><rect width="56" height="28" fill="#5a3a4a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">🎭</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">VI</text></g>
      <g transform="translate(380, 10)"><rect width="56" height="28" fill="#2a3a3a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚙</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">VII</text></g>
      <g transform="translate(440, 10)"><rect width="56" height="28" fill="#4a4628" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">💡</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">VIII</text></g>
      <g transform="translate(500, 10)"><rect width="56" height="28" fill="#1a3030" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">⚛</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">IX</text></g>
      <g transform="translate(560, 10)"><rect width="56" height="28" fill="#444441" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">🛰</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">X</text></g>
      <g transform="translate(620, 10)"><rect width="56" height="28" fill="#3a2c5a" stroke="#c9a85f" stroke-width="0.6"/><rect x="2" y="2" width="52" height="24" fill="none" stroke="#c9a85f" stroke-width="0.3"/><text x="14" y="20" text-anchor="middle" font-size="14">🪐</text><text x="44" y="20" text-anchor="middle" font-family="Cardo, serif" font-size="9" fill="#c9a85f">XI</text></g>
      <circle cx="340" cy="24" r="14" fill="#c9a85f" stroke="#7a3e2a" stroke-width="1" opacity="0.92"/>
      <text x="340" y="29" text-anchor="middle" font-family="Cardo, serif" font-size="14" font-style="italic" fill="#3a2818">A</text>
    </svg>

</div>


### Visual specs by context

| Context | Cube size | Tile face | Binding stripe |
|---|---|---|---|
| Mid-run play screen | 16×20 | Emoji visible (9px), no name | 1.5px L + T |
| Bind ceremony (active cube) | 24×30 | Visible | 2px L + T |
| Era summary (modal footer) | 36×24 | Visible with name | 2.5px L + T |
| Library wall | 32×44 | Visible with small name | 2.5px L + T |
| Run end (Age of Plenty) | 60×36 | Full visibility, name + tier | 3px L + T |

### State diagram per cube

```
locked ──first chapter open──> active
active ──last objective met──> awaiting binding (dashed border)
awaiting binding ──tile bound──> bound (tile-face visible)
bound (terminal state during run; persists in library)
```

### Bound cube interaction

- **Tap** → tile narrative card (same component as inventory long-press).
- **Drag** → tile lifts out with brief halo. Treated as inventory tile for combining purposes. Releases without target → snaps back to cube. Released onto another tile → combines normally. **Source cube stays bound and visible** — the kept tile is reusable.

### Active cube during binding

When a chapter's bind ceremony begins, that cube enlarges from 16×20 to ~24×30 to show the player real-time feedback during their bind hold. After commit, it bloom-fills to its bound state in sync with the brass clasp animation (400ms).

---

## 5. Bari

A small painted apprentice mason in the lower-left margin. Watches, never moves from his spot, **never speaks** (with one exception, see [section 3.6](#36-retirement-ceremony)).

#### Visual reference

<p><strong>Idle · watching</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 100 110" xmlns="http://www.w3.org/2000/svg" style="width: 80px; height: 110px;">
          <ellipse cx="50" cy="106" rx="24" ry="3" fill="#1a1208" opacity="0.25"/>
          <ellipse cx="50" cy="35" rx="13" ry="14" fill="#c9a85f"/>
          <path d="M 38 32 Q 50 22 62 32 L 60 38 Q 50 30 40 38 Z" fill="#3a2818"/>
          <ellipse cx="44" cy="36" rx="1.2" ry="1.2" fill="#1a1208"/>
          <ellipse cx="56" cy="36" rx="1.2" ry="1.2" fill="#1a1208"/>
          <path d="M 44 42 Q 50 44 56 42" stroke="#7a3e2a" stroke-width="0.8" fill="none"/>
          <rect x="38" y="48" width="24" height="30" fill="#7a3e2a"/>
          <rect x="38" y="48" width="24" height="6" fill="#5a4528"/>
          <rect x="34" y="52" width="6" height="22" fill="#5a4528"/>
          <rect x="60" y="52" width="6" height="22" fill="#5a4528"/>
          <rect x="40" y="78" width="8" height="20" fill="#3a2818"/>
          <rect x="52" y="78" width="8" height="20" fill="#3a2818"/>
          <rect x="38" y="98" width="10" height="4" fill="#1a1208"/>
          <rect x="52" y="98" width="10" height="4" fill="#1a1208"/>
          <line x1="68" y1="58" x2="78" y2="76" stroke="#5a4528" stroke-width="2"/>
          <rect x="74" y="70" width="10" height="6" fill="#c9a85f" stroke="#7a3e2a" stroke-width="0.5"/>
        </svg>

</div>

<p><strong>Approval nod</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 100 110" xmlns="http://www.w3.org/2000/svg" style="width: 80px; height: 110px;">
          <ellipse cx="50" cy="106" rx="24" ry="3" fill="#1a1208" opacity="0.25"/>
          <g transform="translate(0, 0) rotate(-6 50 38)">
            <ellipse cx="50" cy="35" rx="13" ry="14" fill="#c9a85f"/>
            <path d="M 38 32 Q 50 22 62 32 L 60 38 Q 50 30 40 38 Z" fill="#3a2818"/>
            <ellipse cx="44" cy="38" rx="2" ry="0.5" fill="#1a1208"/>
            <ellipse cx="56" cy="38" rx="2" ry="0.5" fill="#1a1208"/>
            <path d="M 44 44 Q 50 47 56 44" stroke="#7a3e2a" stroke-width="0.8" fill="none"/>
          </g>
          <rect x="38" y="48" width="24" height="30" fill="#7a3e2a"/>
          <rect x="38" y="48" width="24" height="6" fill="#5a4528"/>
          <rect x="34" y="52" width="6" height="22" fill="#5a4528"/>
          <rect x="60" y="52" width="6" height="22" fill="#5a4528"/>
          <rect x="40" y="78" width="8" height="20" fill="#3a2818"/>
          <rect x="52" y="78" width="8" height="20" fill="#3a2818"/>
          <rect x="38" y="98" width="10" height="4" fill="#1a1208"/>
          <rect x="52" y="98" width="10" height="4" fill="#1a1208"/>
          <line x1="68" y1="58" x2="78" y2="76" stroke="#5a4528" stroke-width="2"/>
          <rect x="74" y="70" width="10" height="6" fill="#c9a85f" stroke="#7a3e2a" stroke-width="0.5"/>
        </svg>

</div>

<p><strong>Wonder · leaning in</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 100 110" xmlns="http://www.w3.org/2000/svg" style="width: 80px; height: 110px;">
          <ellipse cx="50" cy="106" rx="24" ry="3" fill="#1a1208" opacity="0.25"/>
          <ellipse cx="50" cy="35" rx="13" ry="14" fill="#c9a85f"/>
          <path d="M 38 32 Q 50 22 62 32 L 60 38 Q 50 30 40 38 Z" fill="#3a2818"/>
          <ellipse cx="44" cy="35" rx="1.6" ry="1.8" fill="#1a1208"/>
          <ellipse cx="56" cy="35" rx="1.6" ry="1.8" fill="#1a1208"/>
          <circle cx="44.5" cy="34.5" r="0.4" fill="#f4ead5"/>
          <circle cx="56.5" cy="34.5" r="0.4" fill="#f4ead5"/>
          <ellipse cx="50" cy="42" rx="1.5" ry="1.8" fill="#7a3e2a"/>
          <rect x="38" y="48" width="24" height="30" fill="#7a3e2a"/>
          <rect x="38" y="48" width="24" height="6" fill="#5a4528"/>
          <rect x="34" y="50" width="6" height="22" fill="#5a4528"/>
          <rect x="60" y="50" width="6" height="22" fill="#5a4528"/>
          <rect x="40" y="78" width="8" height="20" fill="#3a2818"/>
          <rect x="52" y="78" width="8" height="20" fill="#3a2818"/>
          <rect x="38" y="98" width="10" height="4" fill="#1a1208"/>
          <rect x="52" y="98" width="10" height="4" fill="#1a1208"/>
          <line x1="66" y1="56" x2="80" y2="60" stroke="#5a4528" stroke-width="2"/>
          <rect x="76" y="56" width="10" height="6" fill="#c9a85f" stroke="#7a3e2a" stroke-width="0.5"/>
          <circle cx="74" cy="62" r="2" fill="#c9a85f" opacity="0.4"/>
        </svg>

</div>

<p><strong>Patient · waiting</strong></p>

<div align="center" style="background:#0c0805;padding:8px;border-radius:12px;margin:8px 0;">

<svg viewBox="0 0 100 110" xmlns="http://www.w3.org/2000/svg" style="width: 80px; height: 110px;">
          <ellipse cx="50" cy="106" rx="24" ry="3" fill="#1a1208" opacity="0.25"/>
          <ellipse cx="50" cy="38" rx="13" ry="14" fill="#c9a85f"/>
          <path d="M 38 35 Q 50 25 62 35 L 60 41 Q 50 33 40 41 Z" fill="#3a2818"/>
          <path d="M 41 39 L 46 38" stroke="#1a1208" stroke-width="1.4" fill="none"/>
          <path d="M 54 38 L 59 39" stroke="#1a1208" stroke-width="1.4" fill="none"/>
          <path d="M 44 47 Q 50 44 56 47" stroke="#7a3e2a" stroke-width="0.8" fill="none"/>
          <rect x="38" y="50" width="24" height="30" fill="#7a3e2a"/>
          <rect x="38" y="50" width="24" height="6" fill="#5a4528"/>
          <rect x="32" y="56" width="6" height="22" fill="#5a4528"/>
          <rect x="62" y="56" width="6" height="22" fill="#5a4528"/>
          <rect x="40" y="80" width="8" height="20" fill="#3a2818"/>
          <rect x="52" y="80" width="8" height="20" fill="#3a2818"/>
          <rect x="38" y="100" width="10" height="4" fill="#1a1208"/>
          <rect x="52" y="100" width="10" height="4" fill="#1a1208"/>
          <line x1="32" y1="78" x2="32" y2="60" stroke="#5a4528" stroke-width="2"/>
          <rect x="28" y="56" width="10" height="6" fill="#c9a85f" stroke="#7a3e2a" stroke-width="0.5"/>
        </svg>

</div>


### Poses

| Pose | Trigger | Spec |
|---|---|---|
| Idle / watching | Default (90% of screen time) | Cross-legged, hammer on knee. Eyes track player drag (head turns ±8°). 2.4s breath cycle (shoulders rise + fall 1px). |
| Approval nod | Strong combine (5★), kept tile bound, era end | Head dips -6°, holds 240ms, returns. Eyes close softly. 800ms total. **Maximum twice per chapter.** |
| Wonder / leaning in | Rare 5★, new era, tapestry reveal, **AI-thinking *Longer* phase** (+2.5s) | Eyes widen, mouth opens slightly, hammer drops half an inch. Body leans 4px toward workspace. Holds ~1.5s (or until the AI call resolves). |
| Patient / waiting | Player idle >30s, **AI-thinking *Long* phase** (+6s) | Hammer rotates to opposite hand. Eyes close (two horizontal lines). Reads as "I'll be here whenever you're ready." Never nudges. |

**Art direction:** Final art should be illustrated/painted, not vector. The wireframe SVGs in our prototype are placeholders for a Disney-storybook-painted target.

---

## 6. Motion language

The shared vocabulary of movement. Every animated moment in the game is composed of these primitives.

| Primitive | Spec | Where used |
|---|---|---|
| **Ink-bloom** | scale 0 → 1, 600ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`. Opacity 0 → 1 first 350ms. | Tile arrivals, narrative text, first appearances |
| **Page-darken** | overlay 0% → 65% black, 500ms ease-out. Desaturate filter 0 → 0.7. | Held breath, combine resolves, bind ceremony |
| **Gilt halo** | 3 concentric circles. r: 14 / 30 / 50px. Alpha 0.18 / 0.10 / 0.05. Pulse 1.6s sine. | Drop targets, bind plate, held-breath glow |
| **Brass clasp** | Two rects slide ±20px, 220ms `cubic-bezier(0.4, 0, 0.2, 1)`. Tile scale 1.0 → 1.12 → 1.0. | The bind. **The only "snap" in the game.** |
| **Hold-arc** | ~30px wide curve, fills clockwise, 2.5s **linear**. Alpha 0.3 idle → 1.0 bright. | Hold-to-commit feedback (bind, retire) |
| **Plate breathing** | scale 1.0 ↔ 1.02, 3s sine wave. Halo alpha 0.06 ↔ 0.12. | Post-commit hold (optional) |
| **Brush wipe** | clip-path inset 100% → 0%, 1400ms ease-out. +4px horizontal drift. | Frontispiece reveals in era summary |
| **Page turn** | 2D peel from right edge, 700ms ease-in-out. Thin shadow under lift. | Bind→summary, summary→next chapter, retirement transitions |
| **Cube bloom** | Fill `#3a2818` → tile face, 400ms ease-out. Kept emoji slides in 300ms. | Strip cube becoming bound. Sync'd with brass clasp. |
| **Wax stamp** | Scale 1.4 → 1.0, 320ms with slight overshoot. 3 wax-droplet ring fade-out. | Run end (gilt A). Retirement commit (small click). |
| **Ink-point dispersal** | ~9 small circles, drift up + fade over 1.4s, random offsets. | Retirement: tile dissolving back into the world |
| **Bari nod** | Head -6°, holds 240ms, returns. 800ms total. Painted-frame, no easing. | Approval. Maximum twice per chapter. |
| **Failed-combine shake** | x: ±3px, 3 oscillations, 240ms. Tile dims 100% → 80% → 100%. | Two tiles that won't combine |
| **Scratch-in (typewriter)** | ~30ms/char. Cursor 1Hz. Pen-scratch SFX every 6 chars. | All narrative text. Never instant. |
| **AI-thinking copy swap** | Italic Cardo text replaces in place. Crossfade 280ms (fade out 120ms, fade in 160ms). Phase thresholds at +0s, +2.5s, +6s. | While AI combine is in flight (see §3.2 "Combine feedback"). |

### Three rules for new motion

1. **No bounces above 12% overshoot.** Brass clasp is the ceiling.
2. **Easing is asymmetric.** Things arrive slower than they leave. Most use ease-out. Page-turn and brass clasp use ease-in-out. Only the hold-arc is linear (because it's a clock).
3. **Reduced-motion mode** replaces ink-bloom with 200ms fade, removes brush-wipe (frontispiece just fades in), drops Bari's nod to a tiny opacity flicker. Audio cues are unchanged.

---

## 7. Audio cues

The cello in the held-breath and post-commit breathing is the **master clock**. Hold duration (2.5s) exists because the cello phrase is 2.5s long. If the duration ever changes, the music changes with it.

### Cue list

| Cue | Priority | Spec | Reference |
|---|---|---|---|
| Combine resolve | P1 | ~120ms woody knock. −18 LUFS. ±2st pitch variation. | [Wood Knock Clean Close · CC0](https://freesound.org/people/Geoff-Bremner-Audio/sounds/670316/) |
| Combine impossible | P1 | ~80ms soft inkwell tap. −24 LUFS. No pitch variation. | [rustling paper slice · CC0](https://freesound.org/people/keweldog/sounds/181774/) |
| Held-breath inhale | P1 | Cello G2 sustained. −20 LUFS. Persists during hold; resolves on commit. | [Cello Bass Drone 5 · CC-BY](https://freesound.org/people/juskiddink/sounds/81033/) |
| Era goal met | P2 | ~1.4s singing-bowl. Fundamental ~196Hz. −16 LUFS. | Search: singing bowl low CC0 |
| Tile bound (clasp snap) | P2 | ~340ms 3-layer stack: leather press + brass + cello tonic. −14 LUFS. | [Knocking on Wood · CC0](https://freesound.org/people/ominouswhoosh/sounds/679772/) (base) |
| Post-commit breath | P2 | Low cello C2 sustained. −25 LUFS subliminal. During continued hold. | Cello Bass Drone 5 (low EQ) |
| Retirement exhale | P2 | Cello C2 → G1 descending. 1.6s tail. −18 LUFS. At retirement commit. | Cello Bass Drone 5 (pitched) |
| Page turn | P2 | ~700ms old paper rustle. −20 LUFS. Fade in/out. | rustling paper · CC0 |
| Tapestry painting | P2 | ~1.4s brush-on-canvas, looped low. −26 LUFS. | Search: brush paint canvas CC0 |
| Run sealed (cathedral bell) | P3 | ~4s tail low bell ~110Hz. −12 LUFS. **Once per run.** | Search: cathedral bell distant CC0 |
| Workshop room tone | P3 | Infinite loop. −25 LUFS. Fire crackle + distant wind. User-toggleable. | Search: workshop room tone CC0 |

### Loudness rules

- **Loudest:** Held-breath and clasp-snap at −14 to −16 LUFS.
- **Mid:** Combine resolve at −18 — 60% as loud as the loudest, intentionally.
- **Lowest:** Everything ambient or under-text below −22.

### Music

**No music with melody.** The cello sustained notes are the closest the game gets to a tune. G2 (binding) and C2 (retirement) are a perfect fifth apart. Players who hear both ceremonies in a session unconsciously absorb the most stable consonance in Western music.

### License hygiene

- CC-BY tracks need attribution in credits.
- CC0 doesn't but should anyway.
- **Commission the P1 cues for ship.** They're the most heard sounds in the game.

---

## 8. Accessibility

### Reduced motion

- Ink-bloom → 200ms fade
- Brush wipe → instant (frontispiece just fades in)
- Bari nod → opacity flicker
- Audio cues unchanged
- Hold-arc still visible (it's an interaction affordance, not decoration)

### Hold alternative (motor)

- Settings include "tap-to-commit" mode for users who can't sustain a press.
- Tap a placed tile → tap again within 4s to commit.
- Same audio and visual ceremony plays for the same 2.5s. Player just doesn't have to physically hold.
- The ritual stays intact even when the input changes.

### Audio

- All audio cues are accompanied by visual feedback. Game is fully playable muted.
- Workshop room tone is user-toggleable (some players find ambient sound distracting).

### Visual

- All text uses Cardo (serif) at minimum 14pt for narrative, 11pt for UI labels. Inter for any text below 11pt.
- High-contrast mode swaps `--vellum` and `--ink-black`, increases all border weights by 50%, removes marble texture.

---

## 9. Open questions and future scope

### Confirmed for v1

- Tile-as-cover (kept tile is the book; leather is the binding)
- 24-tile library, permanent retirement
- Hold-to-commit (2.5s) for both binding and retirement
- Strip tiles persist when combined (foundations, not single-use)
- Vault for retired tiles (spines visible only)
- Bari speaks once, only at first wall-full retirement
- "Don't keep this chapter" escape hatch

### Deferred to v1.1

- **Letter-form transformation** for retirement (currently using simpler ink-point dispersal). The original design called for the retiring tile to literally transform into a sealed letter (marbling becomes script, binding becomes envelope flap, chapter color becomes wax). Skipped for v1 to ship faster; revisit when art capacity allows.
- **Library expansion mechanic** (bigger shelf as players progress through some milestone).

### Deferred to multiplayer / community phase

- **"Give it to the world" pipeline.** Retired tiles store their full data; eventually they enter a community pool other players can encounter. The "may another find it" copy already foreshadows this.
- **Receiving end of community pool.** What does it look like when another player's retired tile shows up in your run? Likely a special inventory state (gold border, "from another's library"). Out of scope for v1.

### Open for future discussion

- **Codex view.** When a player taps a tile in their strip mid-run, do they get just the detail card, or a fuller "your codex so far" view? Currently just the detail card.
- **Open Graph share card design.** Library wall makes a strong thumbnail; the eleven-spine row is more iconic. Worth deciding which carries the share story.

---

## 10. Appendix: design rationale

The most important design choices and why they ended up where they are.

### Tile-as-cover (not leather-as-spine-with-tile-inset)

Earlier iterations had the leather binding as the dominant visual element with a small kept-tile emoji inset on each spine. This made the strip read as "the eleven chapters this player completed" rather than "the eleven ideas this player chose." The flip — making the tile face the cover and reducing leather to a binding stripe — turned the strip into a glance-able authorial history. "Torch · Wheat · Forge · Edict · Sailing" tells you what kind of run this was; "five filled cubes" never could.

### 24-tile library (not 44, not 88, not infinite)

Considered larger sizes. 24 was right because at that size, every tile on the wall is **obviously chosen, not collected.** With 88 spaces, the wall starts to feel like a Pokédex — collection becomes the goal. With 24, the player hits the limit around playthrough 3, which is the right pacing: long enough to feel earned, short enough that retirement is part of the ongoing experience rather than a far-off event.

### Hold-to-commit (not tap-to-confirm)

A confirm button would do the same thing in fewer milliseconds. But a hold turns the commitment into a small physical ritual. The player invests 2.5 seconds of attention in this single act — that investment **is** the meaning. The hold is also the only action in the game with a mid-state the player can pull back from. No drag, no tap has this property. That asymmetry makes it feel ceremonial.

### Retirement uses dispersal, not letter-transformation (v1 only)

The original design called for the retiring tile to transform into a sealed letter during the hold — marbling unweaves into script, binding becomes envelope flap, chapter color becomes wax seal. This is roughly 2 seconds of bespoke animation that doesn't reuse existing primitives. For v1, retirement uses ink-point dispersal (reusing the wax-droplet primitive). Letter-form deferred to v1.1 polish.

### Bari speaks once, in writing, only at first wall-full retirement

The retirement mechanic introduces the heaviest concept in the game (permanent loss, giving to the world). The first time, the player needs explicit framing. After that, the gesture and cello carry it. Bari's one line — "*— a shelf is what we choose to keep here. press one to send it onward.*" — does three things in two sentences: teaches the gesture (press one), teaches the lifecycle (send it onward), and frames the meaning (a shelf is choice). Subsequent retirements get standard, shorter copy.

### The cello is the master clock

The 2.5s hold duration exists because the cello phrase is 2.5s long. By the third or fourth bind, players don't watch the hold-arc — they feel "the cello is about to resolve" and ride it home. Animation timings are derived from the music, not the other way around. If duration ever changes, the music changes with it.

### G2 (bind) and C2 (retire) are a perfect fifth apart

The most stable consonance in Western music. Players who hear both ceremonies in a session unconsciously absorb that interval. The audio design uses this single relationship for everything — there is no other harmonic content in the game.

### "Don't keep this chapter" exists because the brief says no pressure

Without an escape hatch, every wall-full chapter is a forced retirement. With it, the player can decline to add a new tile and let it dissolve instead. This means a determined player could lock their shelf at 24 forever — a feature, not a bug. Honoring the existing shelf is also an authorial act.

### The vault shows spines only, not tile data

The vault stores the full data (for future multiplayer) but doesn't surface it in the UI. The information loss is the meaning. Retirement is supposed to feel like release, not deletion. Showing the spines confirms the tiles existed; hiding the specifics confirms they're gone.

---

## 11. Data model and persistence

> Added 2026-04-27 at user request: documents how the existing repository's data model maps onto the bibliophile concepts, what is account-bound vs run-bound, what survives across sessions, and what shape future bibliophile-specific schema additions should take. Engineering-flavored. The aim is to give Claude Code (and future contributors) a shared map so design and implementation don't drift apart.

### Stack overview

| Layer | Technology | Where |
|---|---|---|
| Authentication | Better Auth (Google + Discord OAuth) | `app/auth.ts`, `src/db/schema.ts` (`user`, `session`, `account`, `verification`) |
| Database | Postgres (Neon) via Drizzle ORM 0.45 | `src/db/`, `drizzle/*.sql` migrations |
| Object storage | AWS S3 (per-deployment prefix: `prod/`, `dev/`, optional branch sub-prefix) | `lib/server/tapestry-storage.ts` |
| AI | Vertex AI (Gemini 2.5 Flash, Gemini 3.1, Claude Haiku 4.5) | `lib/server/vertex.ts` + `app/api/{combine,check-era,choose-era,generate-tapestry}` |
| Client save | localStorage (`bari-save`, `bari-select-five-save`, `bari-anon-id`) | `src/save.ts`, `src/identity.ts` |
| Analytics | PostHog (`posthog-js` client, `posthog-node` server) | `app/posthog-provider.tsx`, `src/lib/posthog-server.ts` |

### Identity model

| Concept | Storage | Notes |
|---|---|---|
| Anonymous identity | `bari-anon-id` localStorage UUID + `user.anon_id` once signed in | Anonymous players get a UUID on first visit. On first OAuth sign-in, the anonId is COALESCE-written onto `user.anon_id` (write-once; an existing match means the browser was already seen) and all anon-owned `tapestry` and `era_idea_tile` rows are claimed onto the new user row. |
| Authenticated identity | `user`, `session`, `account` (Better Auth schema) | Standard Better Auth tables. `user.lastActiveAt` is updated on every session creation — feeds DAU/WAU/MAU and D1/D7/D30 retention. |
| Run | `runId: text` UUID minted client-side (`crypto.randomUUID()` in `src/main.ts`); echoed onto `tapestry.run_id`, `era_idea_tile.run_id`, and PostHog event properties | A run begins on first game mount and dies on `clearSave()` (victory, restart, or sign-out reset). Library bookplate copy will need run-relative numbering ("from your 3rd run"); compute as `COUNT(DISTINCT run_id) ≤ this run's earliest createdAt`. |

### What lives where (account-bound vs run-bound vs ephemeral)

| State | Account-bound (DB) | Run-bound (localStorage) | Ephemeral (in-memory) |
|---|---|---|---|
| Player profile (name, email, image, last active) | ✓ `user` | | |
| Anon → user claim metadata | ✓ `user.anon_id` | ✓ `bari-anon-id` | |
| Run identifier | ✓ on `tapestry.run_id`, `era_idea_tile.run_id` | ✓ `SaveData.runId` | |
| Selected AI model | | ✓ `SaveData.selectedModel` | ✓ `selectedModel` in main.ts |
| Combine action log | | ✓ `SaveData.actionLog`, `eraActionLog` | ✓ |
| Recipe cache (combine results) | | ✓ `SaveData.recipeCache` | ✓ `InMemoryRecipeStore` |
| Current chapter index, completed chapter history | | ✓ `SaveData.eraCurrentIndex`, `SaveData.eraHistory` | ✓ `EraManager.history` |
| Current chapter goal states (which conditions met) | | ✓ `SaveData.eraGoalStates` | ✓ on `EraManager.current.goals[i].conditions[j].met` |
| Inventory / palette state | | ✓ `SaveData.paletteItems` | ✓ DOM under `#palette-items` |
| Resolved seed selections per chapter | | ✓ `SaveData.eraResolvedSeeds` | ✓ `EraManager.resolvedSeeds` |
| Bound tile pick (per chapter) | ✓ `era_idea_tile` row | ✓ embedded in `EraHistory.ideaTilePick` | ✓ `pendingEraIdeaTile` until commit |
| Frontispiece (per chapter end) | ✓ `tapestry` row + S3 object | (latest only) ✓ `SaveData.latestTapestryPath` | ✓ `tapestryPromise` while in-flight |
| **Library (24 kept books)** | **TODO** — derived view over `era_idea_tile WHERE retired_at IS NULL` | (none — load on demand) | |
| **Vault (retired tiles)** | **TODO** — derived view over `era_idea_tile WHERE retired_at IS NOT NULL` | (none) | |
| Settings (reduced motion, hold alternative, room tone toggle) | **TODO** — JSONB on `user` or new `user_setting` | localStorage for anon | |
| First-wall-full-retirement seen flag | **TODO** — boolean on `user` | localStorage for anon | |

### Existing tables (with bibliophile mapping)

#### `user`, `session`, `account`, `verification`
Better Auth — no bibliophile changes needed.

#### `tapestry` → bibliophile **frontispiece**
```ts
// src/db/schema.ts
export const tapestry = pgTable("tapestry", {
  id: text("id").primaryKey(),
  userId: text("user_id"),                            // null for anon
  anonId: text("anon_id"),                            // claimed → null on sign-in
  runId: text("run_id"),
  bucket: text("bucket"),                             // S3 bucket
  s3Key: text("s3_key"),                              // S3 key (per-deployment prefix)
  mimeType: text("mime_type"),
  byteSize: integer("byte_size"),
  eraName: text("era_name"),                          // chapter that just ended
  nextEraName: text("next_era_name"),                 // chapter starting next
  narrative: text("narrative"),                       // AI-generated chapter narrative
  visibility: text("visibility").default("unlisted"), // private | unlisted | public
  gameData: jsonb("game_data").$type<TapestryGameData | null>(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});
```
- One row per **chapter end** (the bind ceremony's frontispiece). Frontispiece bytes live in S3; the row is the metadata + share-link key.
- `gameData` JSONB freezes the run state at chapter close so a share page can render the chapter without joining tables.
- `visibility` is set to `unlisted` on create — share URLs work but the asset is not listed publicly.

#### `era_idea_tile` → bibliophile **bound tile**
```ts
export const eraIdeaTile = pgTable("era_idea_tile", {
  id: text("id").primaryKey(),
  userId: text("user_id"),                            // null for anon
  anonId: text("anon_id"),                            // claimed → null on sign-in
  runId: text("run_id"),
  eraName: text("era_name"),                          // chapter the tile was bound from
  tileName: text("tile_name"),
  tileTier: integer("tile_tier"),                     // 1..5
  tileEmoji: text("tile_emoji"),
  tileColor: text("tile_color"),
  tileDescription: text("tile_description"),          // optional
  tileNarrative: text("tile_narrative"),              // optional
  createdAt: timestamp("created_at"),
});
```
- One row per **bound tile** (one per chapter end, per run).
- Holds the full tile data, sufficient to render the bookplate without joining anything.
- Anonymous-to-authenticated claim handled by `claimAnonymousEraIdeaTilesForUser` (`src/db/era-idea-tiles.ts`).

#### `bari_generated_map` (mirrored from sibling project)
Out of scope for bibliophile but lives in the same Postgres DB to keep `drizzle-kit push` non-destructive across both projects. Do not surface in any bibliophile UI.

### Schema additions required for bibliophile

These are the **minimal** additions needed to support library, vault, retirement, settings, and Bari's one-shot speech.

#### Add to `era_idea_tile`
| Column | Type | Default | Purpose |
|---|---|---|---|
| `retired_at` | `timestamp NULL` | `NULL` | Set when player retires the tile. Library = `WHERE retired_at IS NULL`. Vault = `WHERE retired_at IS NOT NULL`. |
| `chapter_index` | `integer NULL` | `NULL` | Optional cache of the chapter's order index, so the library bookplate doesn't depend on era-name string matching. Backfillable from `era_name`. |
| `binding_stripe_color` | `text NULL` | `NULL` | Optional cache of the deterministic chromatic stripe color (computed from hash of `era_id × tile_id × run_id`). Cached at write-time so library rendering doesn't need to recompute the hash. |
| `bound_at` | `timestamp NULL` | (use `created_at`) | Future-proofing if `created_at` semantics drift; for now `created_at` IS the bind timestamp. **Optional — only add if there is a separate "save draft" pattern that delays the bind.** |

#### Add to `user` (or to a new `user_setting` table for clarity)
| Column | Type | Default | Purpose |
|---|---|---|---|
| `seen_first_retirement_speech` | `boolean` | `false` | Spec §3.6: Bari speaks once, only at first wall-full retirement. |
| `prefers_reduced_motion` | `boolean` | `false` | Persisted preference (also respect `prefers-reduced-motion` media query). |
| `prefers_tap_to_commit` | `boolean` | `false` | Spec §8 motor-accessibility alternative. |
| `room_tone_enabled` | `boolean` | `true` | Workshop ambient loop. |

Anonymous players store all four in localStorage (`bari-anon-id`-keyed companion) and migrate them onto the user row on first sign-in.

### Library and Vault as derived views

There is **no separate `library` or `vault` table** in the recommended design. Both are queries over `era_idea_tile` filtered by `retired_at`.

```sql
-- Library (current shelf, max 24)
SELECT * FROM era_idea_tile
WHERE (user_id = $1 OR (user_id IS NULL AND anon_id = $2))
  AND retired_at IS NULL
ORDER BY created_at DESC
LIMIT 24;

-- Vault (retirement memorial, all-time)
SELECT id, era_name, chapter_index, run_id, retired_at, binding_stripe_color
FROM era_idea_tile
WHERE (user_id = $1 OR (user_id IS NULL AND anon_id = $2))
  AND retired_at IS NOT NULL
ORDER BY retired_at DESC;
```

Note the vault SELECT excludes `tile_name`, `tile_emoji`, `tile_description`, `tile_narrative`. **The data still exists** (per the spec's engineering note: store full data for future multiplayer) — the API simply doesn't return it. Surfacing it in the UI would violate the spec's "the information loss is the meaning."

### Save state (`SaveData` v1 → v2)

Current `SaveData` schema (`src/save.ts`):

```ts
interface SaveData {
  version: 1;
  runId?: string;
  latestTapestryPath?: string | null;
  selectedModel: ModelId;
  actionLog: ActionLogEntry[];
  eraActionLog: ActionLogEntry[];
  recipeCache: Record<string, ElementData>;
  eraCurrentIndex: number;
  eraHistory: EraHistory[];
  eraResolvedSeeds: Record<number, ElementData[]>;
  eraGoalStates: Record<number, ...>;
  paletteItems: ElementData[];
  selectedSlots?: ...;       // select-five only
  selectFiveEraIndex?: number;
}
```

For bibliophile, plan a v2 that adds:
- `pendingBindTile?: BoundTilePick` — current draft of "the tile being held to commit." Survives a refresh mid-bind.
- `librarySnapshot?: BoundTilePick[]` — latest cached library for offline-first rendering. Refreshed on session start.
- `bibliophileSettings?: { reducedMotion: boolean; tapToCommit: boolean; roomTone: boolean }` — for anon users.
- `seenFirstRetirementSpeech?: boolean` — for anon users.

Bumping `version: 2` triggers `loadGame` to drop incompatible saves cleanly (existing behavior at `src/save.ts:40`).

### S3 object key conventions

`buildTapestryObjectKey` (`lib/server/tapestry-storage.ts`) generates:

```
{prefix}/tapestries/{ownerScope}/{ownerId}/{eraName}-{YYYY-MM-DD}-{recordId}.png
```

Where `prefix` is `prod` or `dev` (with optional branch sub-prefix), `ownerScope` is `user` or `anon`, and `ownerId` is the userId or anonId (sanitized).

For bibliophile additions (frontispiece is the only S3 asset today; if any other asset becomes per-tile or per-library, mirror the same per-deployment prefix scheme for clean dev/prod separation).

### API surface

| Route | Method | Purpose | Owner-scope | Bibliophile mapping |
|---|---|---|---|---|
| `/api/combine` | POST | AI combine two tiles | session-or-anon | Combine ceremony body |
| `/api/check-era` | POST | AI judge whether chapter conditions met | session-or-anon | Objectives card progress |
| `/api/choose-era` | POST | AI pick next chapter from eligible set | session-or-anon | Era summary "next chapter" pick |
| `/api/generate-tapestry` | POST | AI image + S3 upload + DB row | session-or-anon | Frontispiece reveal |
| `/api/era-idea-tile` | POST | Persist bound tile pick | session-or-anon | Bind ceremony commit |
| `/api/tapestry/latest` | GET | Latest tapestry sharePath for owner | session-or-anon | Resume → restore latest frontispiece link |
| `/api/auth/record-activity` | POST | Bump `lastActiveAt`, claim anon rows | session-required | Sign-in onboarding |
| **TODO `/api/library`** | GET | Return current 24-slot library | session-or-anon | Library page render |
| **TODO `/api/vault`** | GET | Return retired tiles (spines only) | session-or-anon | Vault page render |
| **TODO `/api/era-idea-tile/[id]/retire`** | POST | Set `retired_at`, return new state | session-or-anon | Retirement ceremony commit |
| **TODO `/api/settings`** | PUT | Update user settings (or PATCH) | session-required | Accessibility & audio toggles |

### Owner-scope helper pattern

Most routes resolve owner identity the same way (`session?.user?.id ?? anonId ?? null`). Repeating this is cheap, but if a fourth or fifth route wants the same logic, extract a single helper:

```ts
// lib/server/owner-scope.ts (TODO — only when justified)
export async function resolveOwner(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  return {
    userId: session?.user?.id ?? null,
    anonId: parseAnonId(req) ?? null,        // header or body
    distinctId: session?.user?.id ?? parseAnonId(req) ?? "anonymous",
  };
}
```

Don't extract pre-emptively — current 7 routes inline the same shape and that's fine.

### Migrations (planned for bibliophile)

| Migration | Purpose |
|---|---|
| `0004_bibliophile_retirement.sql` | `ALTER TABLE era_idea_tile ADD COLUMN retired_at timestamp; ADD COLUMN chapter_index integer; ADD COLUMN binding_stripe_color text; CREATE INDEX era_idea_tile_retired_at_idx ON era_idea_tile (retired_at);` |
| `0005_bibliophile_settings.sql` | `ALTER TABLE "user" ADD COLUMN seen_first_retirement_speech boolean DEFAULT false NOT NULL; ADD COLUMN prefers_reduced_motion boolean DEFAULT false NOT NULL; ADD COLUMN prefers_tap_to_commit boolean DEFAULT false NOT NULL; ADD COLUMN room_tone_enabled boolean DEFAULT true NOT NULL;` |

Use `npx drizzle-kit generate` to produce these from schema.ts edits — never hand-write the SQL.

### Privacy and ownership rules

- **Tapestries default to `unlisted`.** Knowing the share URL = access. Never list publicly.
- **Bound tile data is owner-private.** No public listing endpoint. Share-by-URL is owner-controlled (future feature).
- **Vault is owner-private.** Even the limited spine-only data should not be cross-user readable.
- **Anonymous claim is one-way.** Once an anonId is COALESCE'd onto a userId, the row is no longer reachable by anonId. The `unique(user.anon_id)` constraint guarantees a single browser maps to a single user.
- **Cross-deployment isolation** is enforced by S3 key prefix (`prod/` vs `dev/`) and by the same Postgres connection pointing to different databases per deployment.

---

*End of specification. Updated: 2026-04-27. Source: design conversation, three consolidated parts plus strip-as-inventory and vault decisions; section 11 added 2026-04-27 to document data model and persistence.*

---

## Addendum A — Main menu (added 2026-04-28)

### What the user asked for

> Change "Restart Game" to **Menu**, put Restart Game, Sign In, How-To-Play, Debug Menu, and Scoreboard inside that menu. Choose a thematic menu display, order the menu elements with the best UI/UX game dev hat you have.

### Constraints captured

- **Single entry point.** The standalone floating buttons that previously housed each function (`#restart-btn` top-right, `#scoreboard-btn` bottom-right scroll icon, `#debug-toggle` floating bug, `.auth-overlay` chip + `.htp-btn`) are superseded — the play-screen chrome should expose a single Menu affordance.
- **Thematic.** Book-of-hours treatment, not a hamburger or dot-cluster.
- **UI/UX-first ordering.** Order by likely frequency of use during play, with destructive / dev actions guarded.
- **Discoverability vs. atmosphere.** Menu must be findable on a first visit but should not dominate the chapter title row.

### Implementation landed

See `docs/design/bibliophile-decisions.md` **D23** for the resulting menu shape, ordering, and visual treatment.

### Open questions deferred

- **Account UX when signed in.** The Menu collapses signed-in account state to a single "Sign out" item; richer in-menu account preview (avatar, profile, tapestry list) is post-v1.
- **First-session HTP behaviour.** Auth-overlay still renders the HTP popup the first time it mounts; only its trigger buttons are hidden. So first-visit HTP autoplay is preserved.
