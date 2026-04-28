"use client";

// Vault page — memorial of retired tiles. Spec §3.7.
//
// Vertical scrolling list of binding spines: chapter color + Roman numeral
// only, NEVER the tile face / name / narrative. The information loss is the
// meaning. Tap a spine → minimal info card "Given to the world · Run [N] ·
// Chapter [roman]". The full tile data is stored server-side (for future
// multiplayer / community pool) but the API never surfaces it here.

import { useEffect, useState } from "react";
import Link from "next/link";

const ROMANS = [
  "", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
];

interface VaultEntry {
  id: string;
  eraName: string;
  chapterIndex: number | null;
  runId: string | null;
  retiredAt: string | null;
  bindingStripeColor: string | null;
  createdAt: string;
}

export default function VaultPage() {
  const [tiles, setTiles] = useState<VaultEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<VaultEntry | null>(null);

  useEffect(() => {
    const anonId = typeof window !== "undefined"
      ? window.localStorage.getItem("bari-anon-id")
      : null;
    const url = anonId
      ? `/api/vault?anonId=${encodeURIComponent(anonId)}`
      : `/api/vault`;
    fetch(url, { credentials: "same-origin" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Vault read returned ${r.status}`);
        return r.json() as Promise<{ tiles: VaultEntry[] }>;
      })
      .then((data) => setTiles(data.tiles ?? []))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected]);

  // Compute run-ordinal for each entry: "From your Nth run" — derive by
  // distinct runId in chronological order.
  const runOrdinals = computeRunOrdinals(tiles);

  return (
    <main className="vault-page">
      <header className="vault-header">
        <Link href="/library" className="vault-back">‹ Library</Link>
        <h1 className="vault-title">The Vault</h1>
        <span /> {/* spacer */}
      </header>

      <p className="vault-prologue">
        Given to the world. The shape remains; the rest is gone.
      </p>

      {error && (
        <p className="vault-error">{`Could not load the vault${
          process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" ? `: ${error}` : ""
        }`}</p>
      )}

      {!tiles && !error && (
        <p className="vault-empty">Reading the vault&hellip;</p>
      )}

      {tiles && tiles.length === 0 && (
        <p className="vault-empty">Nothing has been given to the world yet.</p>
      )}

      {tiles && tiles.length > 0 && (
        <ul className="vault-list">
          {tiles.map((entry) => {
            const stripe = entry.bindingStripeColor ?? "var(--leather-deep, #5a4528)";
            const roman = entry.chapterIndex !== null
              ? ROMANS[entry.chapterIndex + 1] ?? String(entry.chapterIndex + 1)
              : "—";
            return (
              <li key={entry.id}>
                <button
                  className="vault-spine"
                  style={{ "--stripe": stripe } as React.CSSProperties}
                  onClick={() => setSelected(entry)}
                  aria-label={`Retired chapter ${roman}`}
                >
                  <span className="vault-spine-roman">{roman}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <div
          className="bookplate-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <article className="vault-info-card">
            <p className="vault-info-line">Given to the world</p>
            <p className="vault-info-attribution">
              {[
                runOrdinals.get(selected.id) !== undefined
                  ? `Run ${runOrdinals.get(selected.id)}`
                  : null,
                selected.chapterIndex !== null
                  ? `Chapter ${ROMANS[selected.chapterIndex + 1] ?? selected.chapterIndex + 1}`
                  : null,
              ].filter(Boolean).join(" · ")}
            </p>
            <button
              className="vault-info-close"
              onClick={() => setSelected(null)}
            >Close</button>
          </article>
        </div>
      )}
    </main>
  );
}

/** Build a runId → ordinal map (1-indexed by earliest createdAt). */
function computeRunOrdinals(tiles: VaultEntry[] | null): Map<string, number> {
  const map = new Map<string, number>();
  if (!tiles) return map;
  // Earliest createdAt per runId
  const firstSeen = new Map<string, number>();
  for (const t of tiles) {
    if (!t.runId) continue;
    const created = new Date(t.createdAt).getTime();
    const prev = firstSeen.get(t.runId);
    if (prev === undefined || created < prev) firstSeen.set(t.runId, created);
  }
  // Sort runIds by first-seen ASC, assign 1, 2, 3...
  const runIds = [...firstSeen.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => id);
  runIds.forEach((id, idx) => {
    // All tiles with this runId share the same ordinal.
    for (const t of tiles) {
      if (t.runId === id) map.set(t.id, idx + 1);
    }
  });
  return map;
}
