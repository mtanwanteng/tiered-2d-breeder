"use client";

// Bookplate — universal tile-motif sheet. Spec §3.5 / §1 "bookplate frame is
// the universal tile motif: marbled fill, sepia border, italic name, optional
// tier stars."
//
// Used in:
//   - Library detail (tap a library tile, pull-up sheet)
//   - Vault info card (variant: spine-only fields, no tile face — see §3.7)
//   - Strip-tile peek (mid-run)
//   - Bind ceremony peek
//
// The component renders just the inner sheet contents. Callers wrap it in
// whatever overlay / backdrop chrome they need.
//
// Phase C render-path bypass: `bindingStripeColor` and `tileColor` arrive on
// the prop (the API still returns them, the DB still stores them — preserved
// for a future experiment per migration-plan.md §C) but the renderer ignores
// the stored hex and resolves the stripe from the active theme's
// `bindingStripePalette` via `chapterStripeColor()`. This way switching
// themes re-skins every tile in the library / vault live.

import { chapterStripeColor } from "../../src/theme/chapterColor";

const ROMANS = [
  "", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
];

export interface BookplateTile {
  id: string;
  tileName: string;
  tileTier: number;
  tileEmoji: string;
  tileColor: string;
  tileDescription: string | null;
  tileNarrative: string | null;
  eraName: string;
  chapterIndex: number | null;
  runId: string | null;
  bindingStripeColor: string | null;
  createdAt: Date | string;
  retiredAt?: Date | string | null;
}

export interface BookplateProps {
  tile: BookplateTile;
  /** Optional run ordinal — fills "From your Nth run" attribution. */
  runOrdinal?: number;
}

export function Bookplate({ tile, runOrdinal }: BookplateProps) {
  const stars = "★".repeat(Math.max(0, tile.tileTier));
  const chapterRoman = tile.chapterIndex !== null
    ? ROMANS[tile.chapterIndex + 1] ?? String(tile.chapterIndex + 1)
    : "";
  // Render-time resolution: ignore tile.bindingStripeColor (preserved on the
  // prop for future-experiment use) and hash from the (era × tile × run)
  // tuple against the active theme's palette.
  const stripe = chapterStripeColor(tile.eraName, tile.tileName, tile.runId ?? "");
  const attribution = [
    runOrdinal !== undefined ? `From your ${ordinal(runOrdinal)} run` : null,
    chapterRoman ? `Chapter ${chapterRoman}` : null,
    tile.eraName,
  ].filter(Boolean).join(" · ");

  return (
    <article className="bookplate-sheet">
      <div className="bookplate-stripe" style={{ background: stripe }} />
      <div className="bookplate-content">
        {attribution && (
          <div className="bookplate-attribution">{attribution}</div>
        )}
        <div className="bookplate-emoji" aria-hidden="true">{tile.tileEmoji}</div>
        <div className="bookplate-name">{tile.tileName}</div>
        {stars && <div className="bookplate-tier">{stars}</div>}
        {tile.tileNarrative && (
          <p className="bookplate-narrative">&ldquo;{tile.tileNarrative}&rdquo;</p>
        )}
        {tile.tileDescription && (
          <p className="bookplate-description">{tile.tileDescription}</p>
        )}
      </div>
    </article>
  );
}

function ordinal(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}
