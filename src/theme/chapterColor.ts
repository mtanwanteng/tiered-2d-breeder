// Deterministic chapter color hash. See docs/design/bibliophile-spec.md §1
// "Per-chapter chromatic binding stripes are generated from a hash of
//  (era_id, kept_tile_id, run_id) and pulled from a curated palette of ~15
//  muted leather colors. Same player + same chapter + different run →
//  different color."
//
// FNV-1a hash — simple, deterministic, fast, no crypto. Output is a stable
// index into the active theme's bindingStripePalette.
//
// Phase C exposes a seed-only function (`chapterColorSeed`) that surfaces
// like `app/vault/page.tsx` can call server-side without surfacing tileName
// to the client. The renderer reads `chapterStripeColorFromSeed(seed)` to
// pick a palette entry from the active theme.

import { getTheme } from "./index";

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash >>> 0;
}

/** Compute the chapter-color seed from the (chapter × bound tile × run)
 *  tuple. Pure: depends on no theme state. Safe to run server-side and
 *  surface the integer in API responses where surfacing the raw inputs
 *  would violate spec invariants (e.g. the vault's spine-only contract). */
export function chapterColorSeed(eraName: string, tileId: string, runId: string): number {
  return fnv1a(`${eraName}|${tileId}|${runId}`);
}

/** Render-time resolution: pick a binding-stripe color for a precomputed
 *  seed by indexing into the active theme's palette. Live theme switches
 *  re-evaluate against the new theme's palette without a refetch. */
export function chapterStripeColorFromSeed(seed: number): string {
  const palette = getTheme().bindingStripePalette;
  if (palette.length === 0) return "#5a4528"; // theme without a palette → leather-deep
  return palette[seed % palette.length];
}

/** Convenience wrapper for callers that have the raw hash inputs (the bind
 *  ceremony, library page, Bookplate). Vault uses the seed-only path. */
export function chapterStripeColor(eraName: string, tileId: string, runId: string): string {
  return chapterStripeColorFromSeed(chapterColorSeed(eraName, tileId, runId));
}
