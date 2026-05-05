// Theme contract — see docs/design/bibliophile-spec.md §1 "Theme architecture"
// and docs/design/theming-architecture.md §3 "Token categories".
//
// A theme is skin + assets + copy. Layout, interactions, motion timings, data
// model, and accessibility are theme-agnostic. The six token categories below
// (color / typography / texture / motion / chapter-color / audio) are the only
// surfaces a theme can override; everything else is shared code.

export interface Theme {
  /** Theme identifier, mirrored on <html data-theme="..."> */
  name: string;

  /** Short, human-friendly label */
  displayName: string;

  /** CSS custom-property values. Mirrored 1:1 in themes/<name>/tokens.css under
   *  [data-theme="<name>"]. JS reads these for inline styles, canvas drawing,
   *  Web Audio gain stages, etc. */
  tokens: ThemeTokens;

  /** Web font stacks. The actual @font-face / Google Fonts <link> lives in CSS;
   *  these strings are the family fallback chains used in inline styles.
   *  Maps to architecture-spec §3.2 typography tokens. */
  fonts: ThemeFonts;

  /** URLs to texture assets keyed by abstract role (see architecture-spec §3.3).
   *  Bibliophile fills `pageBackground` with leather, `tileFaceFill` with
   *  marble, etc.; Curator/Cartographer fill the same roles with their own
   *  asset paths. */
  textures: ThemeTextures;

  /** Motion-variant discriminators (see architecture-spec §3.4). All motion
   *  timings/easings remain shared across themes — only the *kind* of motion
   *  per primitive is selectable. */
  motion: ThemeMotion;

  /** Legacy texture struct retained during the Phase A→B migration. Phase B
   *  rewrites consumers to read from `textures` (the abstract roles) and this
   *  field is removed. New themes should not add fields here.
   *  @deprecated Use `textures` instead. Removed in Phase B. */
  patterns: {
    marble: string;
    leather: string;
    parchment: string;
  };

  /** URLs to decorative chrome (manuscript scrollwork, etc.) */
  ornaments: {
    cornerTL: string;
    cornerTR: string;
    cornerBL: string;
    cornerBR: string;
    divider: string;
  };

  /** Bari pose art. CSS placeholders may be used until painted assets land. */
  bari: {
    idle: string;
    nod: string;
    wonder: string;
    patient: string;
  };

  /** Title-screen hero image (watercolor library aisle in Bibliophile) */
  titleScene: string;

  /** Per-chapter italic theme tag rendered under the era name. Keyed by era name
   *  matching src/eras.json (engineering identity stays "era"; UI shows "Chapter"). */
  chapterThemes: Record<string, string>;

  /** Audio cue paths split into shared (cello — never themed) and themed (per
   *  architecture-spec §3.6). The audio bus is procedural today (kill-switched
   *  per D14); these paths are forward-looking for sourced samples. */
  audio: ThemeAudio;

  /** Copy strings keyed by surface. Text never hardcoded in code paths — read
   *  from manifest so a theme swap restyles the voice. */
  copy: ThemeCopy;

  /** Curated palette of muted leather colors used for per-chapter binding stripes.
   *  Hashed deterministically from (era_id × kept_tile_id × run_id). Spec §1. */
  bindingStripePalette: readonly string[];
}

/** Color tokens. The eight `*` swatches are the *raw* palette (theme's identity);
 *  the abstract roles (`bgPage`, `textPrimary`, etc.) are the *role* layer the
 *  rest of the codebase reads. Phase B sweeps consumers to the role layer.
 *
 *  Tokens.css declares both: raw swatches as `--ink-black` etc., abstract roles
 *  as `--bg-page` etc. (architecture-spec §3.1).
 */
export interface ThemeTokens {
  // Raw palette — Bibliophile's eight spec colors. A theme is free to use
  // a different set of names internally, but the abstract roles below are
  // mandatory.
  inkBlack: string;
  oxblood: string;
  gilt: string;
  vellum: string;
  leatherDeep: string;
  paperDark: string;
  marbleWarm: string;
  marbleCool: string;

  // Abstract role layer — architecture-spec §3.1. These are the names
  // consumers should read.
  bgPage: string;
  bgSurface: string;
  bgDeep: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentSecondary: string;
  borderStrong: string;
  borderFaint: string;
}

/** Typography tokens — architecture-spec §3.2. */
export interface ThemeFonts {
  /** Display face — titles, narrative, era names. */
  display: string;
  /** UI face — labels, metadata, button text. */
  ui: string;
  /** Optional monospace face (Cartographer journal-comments). */
  mono?: string;
  /** Whether the display face renders italic by default (Cartographer = italic). */
  displayStyle: "italic" | "regular";
  /** UI casing convention (Curator = all-caps-tracked,
   *  Cartographer = sentence-case-with-mono-comments). The third value
   *  is Cartographer-specific: sentence-case body plus mono "// prefix"
   *  metadata labels. Bibliophile is plain sentence-case. */
  uiCaseRule: "all-caps-tracked" | "sentence-case" | "sentence-case-with-mono-comments";
}

/** Texture asset roles — architecture-spec §3.3. */
export interface ThemeTextures {
  /** Primary background fill (Bibliophile = leather, Curator = linen, Cartographer = vellum). */
  pageBackground: string;
  /** Tile-face fill pattern (Bibliophile = marble, Curator = archival, Cartographer = grid). */
  tileFaceFill: string;
  /** Optional decorative border (gilded, matted, ruled). */
  borderTreatment?: string;
}

/** Motion variant discriminators — architecture-spec §3.4. The *timings* and
 *  easings stay shared; only the kind-of-motion per primitive is themable. */
export interface ThemeMotion {
  /** Page-turn animation type. Default 700ms; Cartographer overrides to 800. */
  pageTransitionType: "peel-2d" | "pan-horizontal" | "fold-3d";
  /** Optional duration override; defaults to the primitive's shared 700ms. */
  pageTransitionDurationMs?: number;
  /** Bind-clasp axis/style (Bibliophile = horizontal-clasp per D26). */
  bindClaspType: "horizontal-clasp" | "vertical-pin";
  /** Ink-bloom variant. Bibliophile uses fill-expand at the spec level even
   *  though tile arrivals were swapped to a scale-pulse per D24. */
  inkBloomType: "fill-expand" | "frame-then-fill" | "outline-then-fill";
  /** Frontispiece reveal variant for the era summary. */
  frontispieceRevealType: "brush-wipe" | "spotlight-wipe" | "ink-wash";
}

/** Audio cue paths — architecture-spec §3.6. The cello (G2 bind, C2 retire,
 *  bridge resolution) is shared across all themes; the other eight cues each
 *  have a per-theme variant. */
export interface ThemeAudio {
  shared: {
    celloBind: string;
    celloRetire: string;
    celloBridge: string;
  };
  themed: {
    combineKnock: string;
    combineInkwell: string;
    singingBowl: string;
    claspSnap: string;
    paperRustle: string;
    cathedralBell: string;
    brushCanvas: string;
    workshopRoomTone: string;
  };
}

export interface ThemeCopy {
  /** Combine-feedback message-evolves pattern (spec §3.2 "Combine feedback") */
  aiThinking: {
    start: string;
    longer: string;
    long: string;
    veryLong: string;
    failed: string;
  };
  /** Italic caption inside the workspace frame */
  workspaceCaption: string;
  /** Empty-state hint inside the workspace */
  writingDeskHint: string;
  /** Small-caps label above the idea tray */
  inventoryCaption: string;
  /** Button label that opens the full Card Catalog modal */
  cardCatalogButton: string;
  /** Menu entry label for the standalone /library route. Per-theme so
   *  Bibliophile reads "Library", Curator "Collection", Cartographer "Atlas". */
  viewLibraryMenuItem: string;
  /** Bari's single line of speech, fired once at first 24/24 retirement (spec §3.6) */
  bariFirstWallFull: string;
  /** Per-chapter idea-tile slot prompts shown above and inside the bind slot. */
  slotPrompts: {
    /** Default prompt above the slot when empty: "Save an idea tile for this era." */
    saveTilePrompt: string;
    /** Empty-slot hint inside the slot itself: "Drop a tile here." */
    dropTileHint: string;
    /** Prompt while a tile is in the slot, default press-and-hold mode. */
    holdToBindPrompt: string;
    /** Prompt while a tile is in the slot, tap-to-commit accessibility mode. */
    tapToBindPrompt: string;
  };
  /** Onboarding sequence copy (spec §3.1) */
  onboarding: {
    title: string;
    /** Two-line front-cover tagline. Newlines are literal in the string. */
    tagline: string;
    chapterLabel: string;
    tryPrompt: string;
    torchNarrative: string;
    tapToBegin: string;
  };
}
