"use client";

// Library page — the 24-slot shelf of bound tiles. Spec §3.5.
//
// Fetches from /api/library (which resolves owner via session cookie + anonId
// query param). Renders a 6 × 4 grid; empty slots stay dim leather squares.
// Tap a tile → bookplate sheet pull-up; tap outside or ESC closes.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookplate, type BookplateTile } from "../components/Bookplate";
import { chapterStripeColor } from "../../src/theme/chapterColor";
import { LIBRARY_CAP, LIBRARY_DEMO_ACTIVE_SLOTS } from "../../src/library-cap";

interface LibraryTile extends BookplateTile {}

export default function LibraryPage() {
  const [tiles, setTiles] = useState<LibraryTile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LibraryTile | null>(null);

  useEffect(() => {
    const anonId = typeof window !== "undefined"
      ? window.localStorage.getItem("bari-anon-id")
      : null;
    const url = anonId
      ? `/api/library?anonId=${encodeURIComponent(anonId)}`
      : `/api/library`;
    fetch(url, { credentials: "same-origin" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Library read returned ${r.status}`);
        return r.json() as Promise<{ tiles: LibraryTile[] }>;
      })
      .then((data) => setTiles(data.tiles ?? []))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  // Close bookplate on ESC.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected]);

  return (
    <main className="library-page">
      <header className="library-header">
        <Link href="/" className="library-back" aria-label="Back to game">‹ Back</Link>
        <h1 className="library-title">Your Library</h1>
        <Link href="/vault" className="library-vault-link">Vault →</Link>
      </header>

      {error && (
        <p className="library-error">{`Could not load your library${
          process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" ? `: ${error}` : ""
        }`}</p>
      )}

      {!tiles && !error && (
        <p className="library-empty">Reading your library&hellip;</p>
      )}

      {tiles && tiles.length === 0 && (
        <p className="library-empty">
          No tiles bound yet. Complete a chapter and press-and-hold to bind one.
        </p>
      )}

      {tiles && tiles.length > 0 && (
        <>
          <p className={`library-counter${tiles.length >= LIBRARY_DEMO_ACTIVE_SLOTS ? " library-counter--full" : ""}`}>
            {Math.min(tiles.length, LIBRARY_DEMO_ACTIVE_SLOTS)} of {LIBRARY_DEMO_ACTIVE_SLOTS} kept
            {tiles.length >= LIBRARY_DEMO_ACTIVE_SLOTS && " · the next chapter you bind will ask you to choose"}
          </p>
          <div className="library-grid">
            {Array.from({ length: LIBRARY_CAP }).map((_, i) => {
              if (i >= LIBRARY_DEMO_ACTIVE_SLOTS) {
                return (
                  <div
                    key={`locked-${i}`}
                    className="library-slot library-slot--locked"
                    aria-label="Locked"
                    title="Locked"
                  >
                    <span className="library-slot-lock" aria-hidden="true">🔒</span>
                  </div>
                );
              }
              const tile = tiles[i];
              if (!tile) {
                return <div key={`empty-${i}`} className="library-slot library-slot--empty" />;
              }
              // Phase C render-path bypass: ignore stored bindingStripeColor;
              // resolve from the active theme's palette so library re-skins live.
              const stripe = chapterStripeColor(tile.eraName, tile.tileName, tile.runId ?? "");
              return (
                <button
                  key={tile.id}
                  className="library-slot library-slot--filled"
                  style={{ "--stripe": stripe } as React.CSSProperties}
                  onClick={() => setSelected(tile)}
                  title={`${tile.tileName} — ${tile.eraName}`}
                >
                  <span className="library-slot-emoji" aria-hidden="true">{tile.tileEmoji}</span>
                  <span className="library-slot-name">{tile.tileName}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {selected && (
        <div
          className="bookplate-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <Bookplate tile={selected} />
          <button
            className="bookplate-close"
            onClick={() => setSelected(null)}
            aria-label="Close"
          >×</button>
        </div>
      )}
    </main>
  );
}
