// Curator theme manifest. Delta of Bibliophile per docs/design/curator-spec.md.
//
// Phase D scaffolds Curator as a parallel theme to Bibliophile. The token
// values are spec-canonical (color, fonts, motion, stripe palette). Asset
// paths reference /public/themes/curator/ but the SVG/PNG files don't exist
// yet — Phase D ships the manifest and the swap *mechanism*; the linen
// wallpaper, mat-board border, brass placard, Bari costume art, and the
// painted run-end plaque are deferred to Phase D-bis (asset commission).
//
// Because GT Sectra and Söhne are licensed, the font stack uses free
// near-equivalents (Cormorant Garamond, Inter) registered in fontStylesheet.ts.
// Switching to the licensed fonts is a one-line manifest change once
// licensing lands.

import type { Theme } from "../Theme";

export const curator: Theme = {
  name: "curator",
  displayName: "Idea Collector — Curator",

  tokens: {
    // Curator's raw palette. The "raw swatch" names are reused for symmetry
    // with Bibliophile, but the values are Curator's: light archival cream,
    // near-black, mid-gray. Curator has no gilt — `gilt` is repurposed as a
    // muted brass for the run-end seal only.
    inkBlack: "#1a1a1a",
    oxblood: "#7a3e2a",
    gilt: "#9a8a5a",
    vellum: "#fafaf5",
    leatherDeep: "#444444",
    paperDark: "#1a1a1a",
    marbleWarm: "#888780",
    marbleCool: "#c4c0b6",

    // Abstract role layer — the inverse contrast of Bibliophile.
    bgPage: "#fafaf5",       // archival cream
    bgSurface: "#e8e2d4",    // warmer cream (cards, modals)
    bgDeep: "#1a1a1a",       // near-black (deep modals, frontispiece backdrops)
    textPrimary: "#1a1a1a",  // near-black body text
    textSecondary: "#444444", // mid-gray
    textTertiary: "#888780", // ghost gray
    accent: "#1a1a1a",       // near-black is the accent (no gold)
    accentSecondary: "#7a3e2a", // oxblood — only at run-end seal
    borderStrong: "#1a1a1a", // near-black, 0.5px
    borderFaint: "#c4c0b6",  // faint gray
  },

  fonts: {
    // Curator-spec canonical: GT Sectra + Söhne. Both licensed; free near-
    // equivalents loaded by fontStylesheet.ts until licensing lands.
    display: '"Cormorant Garamond", "GT Sectra", Georgia, serif',
    ui: '"Inter", "Söhne", system-ui, -apple-system, sans-serif',
    displayStyle: "regular",
    uiCaseRule: "all-caps-tracked",
  },

  textures: {
    pageBackground: "/themes/curator/patterns/linen.svg",
    tileFaceFill: "/themes/curator/patterns/archival-cream.svg",
    borderTreatment: "/themes/curator/patterns/mat-board.svg",
  },

  motion: {
    pageTransitionType: "pan-horizontal",
    bindClaspType: "vertical-pin",
    inkBloomType: "frame-then-fill",
    frontispieceRevealType: "spotlight-wipe",
  },

  // Phase A→B transitional. Same URLs as `textures.*`. Assets don't exist
  // yet; Phase D-bis ships them.
  patterns: {
    marble: "/themes/curator/patterns/archival-cream.svg",
    leather: "/themes/curator/patterns/linen.svg",
    parchment: "/themes/curator/patterns/mat-board.svg",
  },

  ornaments: {
    cornerTL: "/themes/curator/ornaments/corner-tl.svg",
    cornerTR: "/themes/curator/ornaments/corner-tr.svg",
    cornerBL: "/themes/curator/ornaments/corner-bl.svg",
    cornerBR: "/themes/curator/ornaments/corner-br.svg",
    divider: "/themes/curator/ornaments/divider.svg",
  },

  bari: {
    idle: "/themes/curator/bari/idle.png",
    nod: "/themes/curator/bari/nod.png",
    wonder: "/themes/curator/bari/wonder.png",
    patient: "/themes/curator/bari/patient.png",
  },

  titleScene: "/themes/curator/title-gallery.webp",

  // Same era keys as Bibliophile; spec says "Chapter" surfaces as "Gallery"
  // in the UI. The italic tag stays the same — narrative voice doesn't
  // re-skin per architecture spec §8 ("only style swaps for v1").
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

  // Audio cue paths. The procedural Web Audio bus ignores these (per D14
  // kill-switch); these are forward-looking declarations for sample-based
  // playback in a later phase.
  audio: {
    shared: {
      celloBind: "/themes/curator/audio/cello-g2-bind.flac",
      celloRetire: "/themes/curator/audio/cello-c2-retire.flac",
      celloBridge: "/themes/curator/audio/cello-bridge.flac",
    },
    themed: {
      combineKnock: "/themes/curator/audio/brass-marble-tap.flac",
      combineInkwell: "/themes/curator/audio/brass-felt-tap.flac",
      singingBowl: "/themes/curator/audio/museum-bell-mid.flac",
      claspSnap: "/themes/curator/audio/pin-cork.flac",
      paperRustle: "/themes/curator/audio/footsteps-parquet.flac",
      cathedralBell: "/themes/curator/audio/museum-bell-low.flac",
      brushCanvas: "/themes/curator/audio/brush-spotlight-hum.flac",
      workshopRoomTone: "/themes/curator/audio/gallery-room-tone.flac",
    },
  },

  copy: {
    aiThinking: {
      start: "Considering the piece…",
      longer: "The placard takes a moment to engrave.",
      long: "The catalog entry is being typeset.",
      veryLong: "The conservator pauses to compare references.",
      failed: "The piece resisted classification. Try again.",
    },
    workspaceCaption: "— THE STUDIO —",
    writingDeskHint: "Place two pieces here to combine.",
    inventoryCaption: "Collection",
    cardCatalogButton: "Collection →",
    viewLibraryMenuItem: "Collection",
    bariFirstWallFull:
      "— a collection is what we have chosen to keep. press a piece to send it onward.",
    slotPrompts: {
      saveTilePrompt: "FOR THE PERMANENT COLLECTION",
      dropTileHint: "drop a piece here",
      holdToBindPrompt: "HOLD TO ADD",
      tapToBindPrompt: "TAP TO ADD",
    },
    onboarding: {
      title: "Idea Collector",
      tagline: "Every piece is a story.\nEvery story builds a collection.",
      chapterLabel: "— GALLERY I —",
      tryPrompt: "BEGIN.",
      torchNarrative: "Light pushed back at the dark.",
      tapToBegin: "tap to begin",
    },
  },

  // Curator's chapter-color palette: muted near-blacks and charcoals only.
  // Subtle by design — "every piece is the same kind of important." Spec §2.5.
  bindingStripePalette: [
    "#1a1a1a", // near-black
    "#2a2a2a", // soft black
    "#333333", // charcoal
    "#3d3d3d", // warm charcoal
    "#3a3a3a", // mid charcoal
    "#444444", // mid gray
    "#4d4a44", // warm gray
    "#383838", // mid charcoal (repeat for distribution)
    "#5a5a5a", // light charcoal
    "#383838", // deep charcoal
    "#414141", // mid-warm charcoal
    "#2d2d2d", // soft warm black
    "#3e3e3e", // mid warm
    "#48453f", // deep warm gray
    "#33312d", // espresso
  ],
};
