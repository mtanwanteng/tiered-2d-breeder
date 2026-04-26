import { and, eq, isNull } from "drizzle-orm";
import { db } from "./index";
import { eraIdeaTile } from "./schema";

export async function createEraIdeaTile(input: {
  id: string;
  userId: string | null;
  anonId: string | null;
  runId: string | null;
  eraName: string;
  tileName: string;
  tileTier: number;
  tileEmoji: string;
  tileColor: string;
  tileDescription: string | null;
  tileNarrative: string | null;
}) {
  await db.insert(eraIdeaTile).values({
    id: input.id,
    userId: input.userId,
    anonId: input.anonId,
    runId: input.runId,
    eraName: input.eraName,
    tileName: input.tileName,
    tileTier: input.tileTier,
    tileEmoji: input.tileEmoji,
    tileColor: input.tileColor,
    tileDescription: input.tileDescription,
    tileNarrative: input.tileNarrative,
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
