// Cartographer theme manifest. Delta of Bibliophile per
// docs/design/cartographer-spec.md.
//
// Phase E scaffolds Cartographer as a parallel theme. The token values are
// spec-canonical (color, fonts, motion, stripe palette). EB Garamond and
// IBM Plex Mono are both free Google Fonts so the type story renders fully
// without the licensing fallbacks Curator needed.
//
// Asset paths reference /public/themes/cartographer/ but the SVG/PNG files
// don't exist yet — Phase E ships the manifest and the swap mechanism;
// the hand-ruled grid background, vellum tile face, copper push-pin sprite,
// compass-rose seal, and Bari surveyor costume are deferred to a Phase E-bis
// asset commission.

import type { Theme } from "../Theme";

export const cartographer: Theme = {
  name: "cartographer",
  displayName: "Idea Collector — Cartographer",

  tokens: {
    // Raw swatch layer — re-uses Bibliophile names for symmetry. Values are
    // Cartographer's: warm vellum / sepia / two accents (copper + teal).
    inkBlack: "#3a2818",
    oxblood: "#7a3e2a",
    gilt: "#b8732a",
    vellum: "#f0e6cf",
    leatherDeep: "#3a2818",
    paperDark: "#1a1208",
    marbleWarm: "#a8794a",
    marbleCool: "#3a2818",

    // Abstract role layer — the warmest of the three palettes. Two accents
    // (compass copper + ocean teal) reflect old maps' multi-ink convention.
    bgPage: "#f0e6cf",       // vellum / aged paper
    bgSurface: "#e8dcc0",    // warmer paper (cards, modals)
    bgDeep: "#1a1208",       // near-black (deep modals, plate backdrops)
    textPrimary: "#3a2818",  // sepia ink
    textSecondary: "#7a3e2a", // oxblood ink (used heavily, not just accents)
    textTertiary: "#a8794a", // faded sepia
    accent: "#b8732a",       // compass-rose copper
    accentSecondary: "#1d5e6e", // ocean teal (water, routes, isobaths)
    borderStrong: "#3a2818", // sepia ink, 0.5px
    borderFaint: "#a8794a",  // faded sepia
  },

  fonts: {
    // EB Garamond display + IBM Plex Mono Light UI. Italic display is a
    // Cartographer signature ("18th-century journal hand"). Mono UI gives
    // the surveyor's-precision feel; the comment-prefix convention is
    // implemented per-element (see uiCaseRule below).
    display: '"EB Garamond", Garamond, Georgia, serif',
    ui: '"IBM Plex Mono", "Courier New", monospace',
    mono: '"IBM Plex Mono", "Courier New", monospace',
    displayStyle: "italic",
    uiCaseRule: "sentence-case-with-mono-comments",
  },

  textures: {
    pageBackground: "/themes/cartographer/patterns/grid.svg",
    tileFaceFill: "/themes/cartographer/patterns/vellum.svg",
    borderTreatment: "/themes/cartographer/patterns/sepia-border.svg",
  },

  motion: {
    pageTransitionType: "fold-3d",
    pageTransitionDurationMs: 800, // longer than Bibliophile — old paper has more give
    bindClaspType: "vertical-pin", // single copper push-pin descending
    inkBloomType: "outline-then-fill",
    frontispieceRevealType: "ink-wash",
  },

  // Phase A→B transitional. Same URLs as `textures.*`. Assets don't exist yet.
  patterns: {
    marble: "/themes/cartographer/patterns/vellum.svg",
    leather: "/themes/cartographer/patterns/grid.svg",
    parchment: "/themes/cartographer/patterns/sepia-border.svg",
  },

  ornaments: {
    cornerTL: "/themes/cartographer/ornaments/compass-tl.svg",
    cornerTR: "/themes/cartographer/ornaments/compass-tr.svg",
    cornerBL: "/themes/cartographer/ornaments/compass-bl.svg",
    cornerBR: "/themes/cartographer/ornaments/compass-br.svg",
    divider: "/themes/cartographer/ornaments/sepia-divider.svg",
  },

  bari: {
    idle: "/themes/cartographer/bari/idle.png",
    nod: "/themes/cartographer/bari/nod.png",
    wonder: "/themes/cartographer/bari/wonder.png",
    patient: "/themes/cartographer/bari/patient.png",
  },

  titleScene: "/themes/cartographer/title-journal.webp",

  chapterThemes: {
    "Stone Age": "Survive · Discover",
    "Bronze Age": "Craft · Survival",
    "Iron Age": "Tools · Order",
    "Classical Age": "Reason · Empire",
    "Medieval Age": "Faith · Stone",
    "Renaissance": "Inquiry · Beauty",
    "Age of Exploration": "Horizon · Trade",
    "Industrial Age": "Steam · Iron",
    "Modern Age": "Power · Nation",
    "Information Age": "Signal · Code",
    "Space Age": "Lift · Wonder",
  },

  audio: {
    shared: {
      celloBind: "/themes/cartographer/audio/cello-g2-bind.flac",
      celloRetire: "/themes/cartographer/audio/cello-c2-retire.flac",
      celloBridge: "/themes/cartographer/audio/cello-bridge.flac",
    },
    themed: {
      combineKnock: "/themes/cartographer/audio/sextant-click.flac",
      combineInkwell: "/themes/cartographer/audio/quill-tap.flac",
      singingBowl: "/themes/cartographer/audio/sextant-tone.flac",
      claspSnap: "/themes/cartographer/audio/pin-cork.flac",
      paperRustle: "/themes/cartographer/audio/parchment-fold.flac",
      cathedralBell: "/themes/cartographer/audio/ships-bell.flac",
      brushCanvas: "/themes/cartographer/audio/ink-on-paper.flac",
      workshopRoomTone: "/themes/cartographer/audio/field-tent-tone.flac",
    },
  },

  copy: {
    aiThinking: {
      start: "Sketching the find…",
      longer: "The survey is taking longer than expected.",
      long: "The ink is slow to set today.",
      veryLong: "The cartographer pauses to compare against existing charts.",
      failed: "The find resisted the chart. Try again.",
    },
    workspaceCaption: "// the journal",
    writingDeskHint: "Place two finds here to combine.",
    inventoryCaption: "// pinned discoveries",
    cardCatalogButton: "// discoveries →",
    viewLibraryMenuItem: "Atlas",
    bariFirstWallFull:
      "— an atlas is what we have charted. press a pin to return its place to the world.",
    slotPrompts: {
      saveTilePrompt: "// pin to your master map",
      dropTileHint: "drop a find here",
      holdToBindPrompt: "press and hold to pin",
      tapToBindPrompt: "tap to pin",
    },
    onboarding: {
      title: "Idea Collector",
      tagline: "Every find is a story.\nEvery story builds a territory.",
      chapterLabel: "— Leaf I —",
      tryPrompt: "sketch.",
      torchNarrative: "Light pushed back at the dark.",
      tapToBegin: "tap to begin",
    },
  },

  // Cartographer's chapter-color palette is the most chromatic — old maps
  // used many inks. Wax-seal and ink colors per spec §2.5.
  bindingStripePalette: [
    "#7a3e2a", // oxblood (most common)
    "#1d5e6e", // ocean teal
    "#b8732a", // compass copper
    "#3a2818", // sepia ink
    "#5a4528", // brown ink
    "#8b3a3a", // red ink
    "#2d4a3e", // mossy green
    "#4a2828", // dark red wax
    "#3d5a2a", // forest ink
    "#5a3a4a", // plum ink
    "#1a3030", // deep teal
    "#7a2a4a", // crimson
    "#4a4628", // olive
    "#2a3a3a", // slate
    "#5a4a28", // umber
  ],
};
