import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "./index";
import { eraIdeaTile } from "./schema";
import { chapterColorSeed } from "../theme/chapterColor";

export async function createEraIdeaTile(input: {
  id: string;
  userId: string | null;
  anonId: string | null;
  runId: string | null;
  eraName: string;
  chapterIndex: number | null;
  tileName: string;
  tileTier: number;
  tileEmoji: string;
  tileColor: string;
  tileDescription: string | null;
  tileNarrative: string | null;
  bindingStripeColor: string | null;
}) {
  await db.insert(eraIdeaTile).values({
    id: input.id,
    userId: input.userId,
    anonId: input.anonId,
    runId: input.runId,
    eraName: input.eraName,
    chapterIndex: input.chapterIndex,
    tileName: input.tileName,
    tileTier: input.tileTier,
    tileEmoji: input.tileEmoji,
    tileColor: input.tileColor,
    tileDescription: input.tileDescription,
    tileNarrative: input.tileNarrative,
    bindingStripeColor: input.bindingStripeColor,
    createdAt: new Date(),
  });
}

export async function claimAnonymousEraIdeaTilesForUser(input: {
  anonId: string;
  userId: string;
}) {
  return db
    .update(eraIdeaTile)
    .set({ userId: input.userId })
    .where(and(eq(eraIdeaTile.anonId, input.anonId), isNull(eraIdeaTile.userId)));
}

/** Resolve the row scope for the active owner. Authenticated users always
 *  match by userId. Anonymous users match anon_id with user_id IS NULL so
 *  rows that have already been claimed by an authenticated player aren't
 *  returned to a different anon session. */
function ownerFilter(input: { userId: string | null; anonId: string | null }) {
  if (input.userId) return eq(eraIdeaTile.userId, input.userId);
  if (input.anonId) {
    return and(isNull(eraIdeaTile.userId), eq(eraIdeaTile.anonId, input.anonId));
  }
  return null;
}

export type LibraryRow = typeof eraIdeaTile.$inferSelect;

/** Library = the 24 most-recent non-retired bound tiles for the owner.
 *  Spec §3.5: 6 rows × 4 cols, fills chronologically, retire on bind-25. */
export async function getLibraryForOwner(input: {
  userId: string | null;
  anonId: string | null;
}): Promise<LibraryRow[]> {
  const filter = ownerFilter(input);
  if (!filter) return [];
  return db
    .select()
    .from(eraIdeaTile)
    .where(and(filter, isNull(eraIdeaTile.retiredAt)))
    .orderBy(desc(eraIdeaTile.createdAt))
    .limit(24);
}

/** Vault entries — spine fields only (id, era_name, chapter_index, run_id,
 *  retired_at, binding_stripe_color, created_at). The full tile data is in
 *  the row but the API doesn't surface tileName/face/narrative (spec §3.7:
 *  "the information loss is the meaning").
 *
 *  Phase C adds a precomputed `chapterColorSeed` so the renderer can index
 *  into the active theme's palette without ever seeing tile_name. The seed
 *  is computed at read time (no schema migration) and is the same fnv1a
 *  result the bind ceremony produced — render parity with library / Bookplate. */
export interface VaultRow {
  id: string;
  eraName: string;
  chapterIndex: number | null;
  runId: string | null;
  retiredAt: Date | null;
  bindingStripeColor: string | null;
  chapterColorSeed: number;
  createdAt: Date;
}

export async function getVaultForOwner(input: {
  userId: string | null;
  anonId: string | null;
}): Promise<VaultRow[]> {
  const filter = ownerFilter(input);
  if (!filter) return [];
  // Selects tile_name *only* to compute the seed; the response interface
  // does not expose it. Spec §3.7 spine-only contract preserved on the wire.
  const rows = await db
    .select({
      id: eraIdeaTile.id,
      eraName: eraIdeaTile.eraName,
      chapterIndex: eraIdeaTile.chapterIndex,
      runId: eraIdeaTile.runId,
      retiredAt: eraIdeaTile.retiredAt,
      bindingStripeColor: eraIdeaTile.bindingStripeColor,
      tileName: eraIdeaTile.tileName,
      createdAt: eraIdeaTile.createdAt,
    })
    .from(eraIdeaTile)
    .where(and(filter, isNotNull(eraIdeaTile.retiredAt)))
    .orderBy(desc(eraIdeaTile.retiredAt));

  return rows.map(({ tileName, ...rest }) => ({
    ...rest,
    chapterColorSeed: chapterColorSeed(rest.eraName, tileName, rest.runId ?? ""),
  }));
}

/** Retire a bound tile. Owner-checked: returns false if the row doesn't exist
 *  or doesn't belong to this owner. Idempotent — retiring an already-retired
 *  tile is a no-op (the WHERE clause requires retired_at IS NULL). */
export async function retireEraIdeaTile(input: {
  id: string;
  userId: string | null;
  anonId: string | null;
}): Promise<boolean> {
  const filter = ownerFilter(input);
  if (!filter) return false;
  const result = await db
    .update(eraIdeaTile)
    .set({ retiredAt: sql`NOW()` })
    .where(and(filter, eq(eraIdeaTile.id, input.id), isNull(eraIdeaTile.retiredAt)))
    .returning({ id: eraIdeaTile.id });
  return result.length > 0;
}

/** True when the player has already accumulated >= 24 non-retired bound tiles —
 *  used by the bind flow to decide whether to route into the retirement
 *  ceremony before persisting the 25th. */
export async function isLibraryFull(input: {
  userId: string | null;
  anonId: string | null;
}): Promise<boolean> {
  const filter = ownerFilter(input);
  if (!filter) return false;
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eraIdeaTile)
    .where(and(filter, isNull(eraIdeaTile.retiredAt)));
  return (rows[0]?.count ?? 0) >= 24;
}

