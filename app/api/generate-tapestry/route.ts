import { NextResponse } from "next/server";
import { auth } from "../../auth";
import { callGeminiImage, getAccessToken } from "../../../lib/server/vertex";
import { createTapestryRecord } from "../../../src/db/tapestries";
import type { TapestryGameData } from "../../../src/types";
import {
  buildTapestryObjectKey,
  isTapestryStorageConfigured,
  uploadTapestryImage,
} from "../../../lib/server/tapestry-storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { narrative, eraName, nextEraName, anonId, gameData } = (await request.json()) as {
    narrative: string;
    eraName: string;
    nextEraName: string;
    anonId?: string;
    gameData?: TapestryGameData;
  };

  if (!narrative) return NextResponse.json({ error: "Missing narrative" }, { status: 400 });

  const prompt = `Create a richly detailed medieval tapestry illustration depicting the following moment in a civilization's history. Style: woven textile art, muted earthy tones with gold thread highlights, intricate border patterns, flat perspective typical of medieval tapestries, no text or labels.

Era completed: ${eraName}
Advancing to: ${nextEraName}
Story: ${narrative}`;

  try {
    const session = await auth.api.getSession({ headers: request.headers });
    const token = await getAccessToken();
    const { base64, mimeType } = await callGeminiImage(token, prompt);
    let tapestryId: string | null = null;
    let sharePath: string | null = null;

    if (isTapestryStorageConfigured()) {
      const ownerScope = session?.user?.id ? "user" : "anon";
      const ownerId = session?.user?.id ?? anonId;

      if (ownerId) {
        tapestryId = crypto.randomUUID();
        const bytes = Buffer.from(base64, "base64");
        const key = buildTapestryObjectKey({
          recordId: tapestryId,
          ownerScope,
          ownerId,
          eraName,
        });
        const stored = await uploadTapestryImage({
          bytes,
          key,
          mimeType,
        });
        console.log(`[TAP] S3 upload success: s3://${stored.bucket}/${stored.key} (${stored.byteSize} bytes)`);

        await createTapestryRecord({
          id: tapestryId,
          userId: session?.user?.id ?? null,
          anonId: anonId ?? null,
          bucket: stored.bucket,
          s3Key: stored.key,
          mimeType,
          byteSize: stored.byteSize,
          eraName,
          nextEraName,
          narrative,
          gameData: gameData ?? null,
        });

        sharePath = `/tapestries/${tapestryId}`;
      }
    }

    return NextResponse.json({ base64, mimeType, tapestryId, sharePath });
  } catch (error) {
    console.error("[TAP] Failed (generation or S3 upload):", error);
    return NextResponse.json(
      { error: `Generation failed${process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" ? `: ${error instanceof Error ? error.message : String(error)}` : ""}` },
      { status: 500 },
    );
  }
}
