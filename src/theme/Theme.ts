// Theme contract — see docs/design/bibliophile-spec.md §1 "Theme architecture".
// A theme is skin + assets + copy. Layout, interactions, motion primitives, data
// model, and accessibility are theme-agnostic.

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
   *  these strings are the family fallback chains used in inline styles. */
  fonts: {
    serif: string;
    sans: string;
  };

  /** URLs to pattern textures (served from /public/themes/<name>/patterns/) */
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

  /** Audio cue paths. P1/P2 cues use Web Audio API for timing precision; P3
   *  ambient (room tone) uses HTMLAudio. Loudness rules in spec §7. */
  audio: ThemeAudio;

  /** Copy strings keyed by surface. Text never hardcoded in code paths — read
   *  from manifest so a theme swap restyles the voice. */
  copy: ThemeCopy;

  /** Curated palette of muted leather colors used for per-chapter binding stripes.
   *  Hashed deterministically from (era_id × kept_tile_id × run_id). Spec §1. */
  bindingStripePalette: readonly string[];
}

export interface ThemeTokens {
  inkBlack: string;
  oxblood: string;
  gilt: string;
  vellum: string;
  leatherDeep: string;
  paperDark: string;
  marbleWarm: string;
  marbleCool: string;
}

export interface ThemeAudio {
  celloBind: string;
  celloRetire: string;
  celloBridge: string;
  combineKnock: string;
  combineInkwell: string;
  singingBowl: string;
  claspSnap: string;
  paperRustle: string;
  cathedralBell: string;
  brushCanvas: string;
  workshopRoomTone: string;
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
  /** Bari's single line of speech, fired once at first 24/24 retirement (spec §3.6) */
  bariFirstWallFull: string;
  /** Onboarding sequence copy (spec §3.1) */
  onboarding: {
    title: string;
    chapterLabel: string;
    tryPrompt: string;
    torchNarrative: string;
    tapToBegin: string;
  };
}
