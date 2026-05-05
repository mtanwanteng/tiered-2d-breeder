// Bibliophile theme manifest. The v1 theme of Idea Collector.
// See docs/design/bibliophile-spec.md for the canonical design and
// docs/design/theming-architecture.md §3 for the token-category contract.
//
// Asset URLs reference /public/themes/bibliophile/. Files referenced here may
// not exist yet — Phase 0 declares the paths; later phases (1: patterns +
// ornaments, 3: audio, 8: bari art + title scene) deliver the files.

import type { Theme } from "../Theme";

export const bibliophile: Theme = {
  name: "bibliophile",
  displayName: "Idea Collector — Bibliophile",

  tokens: {
    // Raw spec palette
    inkBlack: "#2a1f15",
    oxblood: "#7a3e2a",
    gilt: "#c9a85f",
    vellum: "#f4ead5",
    leatherDeep: "#5a4528",
    paperDark: "#1a1208",
    marbleWarm: "#a8794a",
    marbleCool: "#3a2818",

    // Abstract role layer — architecture-spec §3.1. Bibliophile maps these
    // onto its raw palette; Curator/Cartographer pick different swatches.
    bgPage: "#1a1208",       // paper-dark
    bgSurface: "#5a4528",    // leather-deep
    bgDeep: "#2a1f15",       // ink-black (workspace, deep modals)
    textPrimary: "#f4ead5",  // vellum
    textSecondary: "#a8794a", // marble-warm
    textTertiary: "#3a2818", // marble-cool
    accent: "#7a3e2a",       // oxblood
    accentSecondary: "#c9a85f", // gilt
    borderStrong: "#5a4528", // leather-deep
    borderFaint: "#3a2818",  // marble-cool
  },

  fonts: {
    display: '"Cardo", Georgia, serif',
    ui: '"Inter", system-ui, -apple-system, sans-serif',
    displayStyle: "regular",
    uiCaseRule: "sentence-case",
  },

  textures: {
    pageBackground: "/themes/bibliophile/patterns/leather.svg",
    tileFaceFill: "/themes/bibliophile/patterns/marble.svg",
    borderTreatment: "/themes/bibliophile/patterns/parchment.svg",
  },

  motion: {
    pageTransitionType: "peel-2d",
    bindClaspType: "horizontal-clasp",
    inkBloomType: "fill-expand",
    frontispieceRevealType: "brush-wipe",
  },

  // Phase A→B transitional. Same URLs as `textures.*` above; consumers in
  // skin.css still reference these by name. Phase B sweeps consumers to the
  // abstract `textures` roles and removes this field.
  patterns: {
    marble: "/themes/bibliophile/patterns/marble.svg",
    leather: "/themes/bibliophile/patterns/leather.svg",
    parchment: "/themes/bibliophile/patterns/parchment.svg",
  },

  ornaments: {
    cornerTL: "/themes/bibliophile/ornaments/corner-tl.svg",
    cornerTR: "/themes/bibliophile/ornaments/corner-tr.svg",
    cornerBL: "/themes/bibliophile/ornaments/corner-bl.svg",
    cornerBR: "/themes/bibliophile/ornaments/corner-br.svg",
    divider: "/themes/bibliophile/ornaments/divider.svg",
  },

  bari: {
    idle: "/themes/bibliophile/bari/idle.png",
    nod: "/themes/bibliophile/bari/nod.png",
    wonder: "/themes/bibliophile/bari/wonder.png",
    patient: "/themes/bibliophile/bari/patient.png",
  },

  titleScene: "/themes/bibliophile/title-library.webp",

  // Keys must match era.name in src/eras.json (engineering identity stays "era";
  // UI surfaces "Chapter [roman]" + this italic tag).
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
      celloBind: "/themes/bibliophile/audio/cello-g2-bind.flac",
      celloRetire: "/themes/bibliophile/audio/cello-c2-retire.flac",
      celloBridge: "/themes/bibliophile/audio/cello-bridge.flac",
    },
    themed: {
      combineKnock: "/themes/bibliophile/audio/combine-knock.flac",
      combineInkwell: "/themes/bibliophile/audio/combine-inkwell.flac",
      singingBowl: "/themes/bibliophile/audio/singing-bowl.flac",
      claspSnap: "/themes/bibliophile/audio/clasp-snap.flac",
      paperRustle: "/themes/bibliophile/audio/paper-rustle.flac",
      cathedralBell: "/themes/bibliophile/audio/cathedral-bell.flac",
      brushCanvas: "/themes/bibliophile/audio/brush-canvas.flac",
      workshopRoomTone: "/themes/bibliophile/audio/workshop-room-tone.flac",
    },
  },

  copy: {
    aiThinking: {
      start: "Reading the margins…",
      longer: "Pinning this down takes a history.",
      long: "The ink is slow today.",
      veryLong: "The quill pauses to reread.",
      failed: "The ink resisted. Try again.",
    },
    workspaceCaption: "— the writing desk —",
    writingDeskHint: "Place two ideas here to combine.",
    inventoryCaption: "Your Ideas",
    // Canonical UI string is "Catalog →"; the longer "Card Catalog →" was the
    // initial copy and drifted out of sync with main.ts's DOM template.
    cardCatalogButton: "Catalog →",
    viewLibraryMenuItem: "Library",
    bariFirstWallFull:
      "— a shelf is what we choose to keep here. press one to send it onward.",
    slotPrompts: {
      saveTilePrompt: "Save an idea tile for this era",
      dropTileHint: "Drop a tile here",
      holdToBindPrompt: "Press and hold to bind",
      tapToBindPrompt: "Tap to bind",
    },
    onboarding: {
      title: "Idea Collector",
      tagline: "Every idea is a story.\nEvery story builds a civilization.",
      chapterLabel: "— Chapter I —",
      tryPrompt: "Try.",
      torchNarrative: "Light pushed back at the dark.",
      tapToBegin: "tap to begin",
    },
  },

  // 15 muted leather colors from which a deterministic hash picks the binding
  // stripe per (era_id × kept_tile_id × run_id). Curated to feel like book
  // bindings on a shelf — no neon, no high saturation.
  bindingStripePalette: [
    "#7a3e2a", // oxblood
    "#5a4528", // leather-deep
    "#3a4a5a", // slate
    "#4a2828", // burgundy
    "#1d4a5e", // teal
    "#5a3a4a", // mauve
    "#2a3a3a", // pine
    "#4a4628", // olive
    "#1a3030", // deep teal
    "#444441", // graphite
    "#a8794a", // marble-warm
    "#6b4a2e", // burnt sienna
    "#3a3a5a", // indigo
    "#5e4438", // walnut
    "#2c3e2c", // moss
  ],
};
