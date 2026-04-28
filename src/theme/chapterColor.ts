// Deterministic chapter color hash. See docs/design/bibliophile-spec.md §1
// "Per-chapter chromatic binding stripes are generated from a hash of
//  (era_id, kept_tile_id, run_id) and pulled from a curated palette of ~15
//  muted leather colors. Same player + same chapter + different run →
//  different color."
//
// FNV-1a hash — simple, deterministic, fast, no crypto. Output is a stable
// index into the active theme's bindingStripePalette.

import { getTheme } from "./index";

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash >>> 0;
}

/** Pick a binding-stripe color for a (chapter × bound tile × run) tuple.
 *  Same inputs → same color (deterministic). Used to color the strip cube of
 *  a bound tile and any rendering of that tile in the library or vault. */
export function chapterStripeColor(eraName: string, tileId: string, runId: string): string {
  const palette = getTheme().bindingStripePalette;
  if (palette.length === 0) return "#5a4528"; // theme without a palette → leather-deep
  const hash = fnv1a(`${eraName}|${tileId}|${runId}`);
  return palette[hash % palette.length];
}
