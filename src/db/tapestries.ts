import { and, asc, desc, eq, gt, isNull, lt } from "drizzle-orm";
import { db } from "./index";
import { tapestry, user } from "./schema";
import type { TapestryGameData } from "../types";

export type TapestryRecord = typeof tapestry.$inferSelect;

export async function createTapestryRecord(input: {
  id: string;
  userId: string | null;
  anonId: string | null;
  runId: string | null;
  bucket: string;
  s3Key: string;
  mimeType: string;
  byteSize: number;
  eraName: string;
  nextEraName: string;
  narrative: string;
  gameData: TapestryGameData | null;
  visibility?: "private" | "unlisted" | "public";
}) {
  const now = new Date();

  await db.insert(tapestry).values({
    id: input.id,
    userId: input.userId,
    anonId: input.anonId,
    runId: input.runId,
    bucket: input.bucket,
    s3Key: input.s3Key,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    eraName: input.eraName,
    nextEraName: input.nextEraName,
    narrative: input.narrative,
    gameData: input.gameData,
    visibility: input.visibility ?? "unlisted",
    createdAt: now,
    updatedAt: now,
  });

  return getTapestryById(input.id);
}

export async function claimAnonymousTapestriesForUser(input: {
  anonId: string;
  userId: string;
}) {
  const now = new Date();
  const result = await db
    .update(tapestry)
    .set({
      userId: input.userId,
      updatedAt: now,
    })
    .where(
      and(
        eq(tapestry.anonId, input.anonId),
        isNull(tapestry.userId)
      )
    );

  return result;
}

export async function getLatestTapestryForOwner(input: {
  userId: string | null;
  anonId: string | null;
}): Promise<{ id: string } | null> {
  const filter = input.userId
    ? eq(tapestry.userId, input.userId)
    : input.anonId
    ? and(isNull(tapestry.userId), eq(tapestry.anonId, input.anonId))
    : null;

  if (!filter) return null;

  const rows = await db
    .select({ id: tapestry.id })
    .from(tapestry)
    .where(filter)
    .orderBy(desc(tapestry.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function getTapestryById(id: string) {
  const rows = await db.select().from(tapestry).where(eq(tapestry.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getTapestryAuthorName(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const rows = await db.select({ name: user.name }).from(user).where(eq(user.id, userId)).limit(1);
  return rows[0]?.name ?? null;
}

export async function getAdjacentTapestries(current: TapestryRecord): Promise<{
  prev: { id: string } | null;
  next: { id: string } | null;
}> {
  const ownerFilter = current.userId
    ? eq(tapestry.userId, current.userId)
    : and(isNull(tapestry.userId), eq(tapestry.anonId, current.anonId!));

  const [prevRows, nextRows] = await Promise.all([
    db.select({ id: tapestry.id })
      .from(tapestry)
      .where(and(ownerFilter, lt(tapestry.createdAt, current.createdAt)))
      .orderBy(desc(tapestry.createdAt))
      .limit(1),
    db.select({ id: tapestry.id })
      .from(tapestry)
      .where(and(ownerFilter, gt(tapestry.createdAt, current.createdAt)))
      .orderBy(asc(tapestry.createdAt))
      .limit(1),
  ]);

  return {
    prev: prevRows[0] ?? null,
    next: nextRows[0] ?? null,
  };
}
