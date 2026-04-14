import { and, eq, isNull } from "drizzle-orm";
import { db } from "./index";
import { tapestry } from "./schema";
import type { TapestryGameData } from "../types";

export type TapestryRecord = typeof tapestry.$inferSelect;

export async function createTapestryRecord(input: {
  id: string;
  userId: string | null;
  anonId: string | null;
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

export async function getTapestryById(id: string) {
  const rows = await db.select().from(tapestry).where(eq(tapestry.id, id)).limit(1);
  return rows[0] ?? null;
}
