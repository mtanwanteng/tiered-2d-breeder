import { NextResponse } from "next/server";
import { auth } from "../../auth";
import { callGeminiImage, getAccessToken } from "../../../lib/server/vertex";
import { createTapestryRecord } from "../../../src/db/tapestries";
import { getPostHogClient } from "../../../src/lib/posthog-server";
import type { TapestryGameData } from "../../../src/types";
import {
  buildTapestryObjectKey,
  isTapestryStorageConfigured,
  uploadTapestryImage,
} from "../../../lib/server/tapestry-storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { narrative, eraName, nextEraName, anonId, runId, gameData } = (await request.json()) as {
    narrative: string;
    eraName: string;
    nextEraName: string;
    anonId?: string;
    runId?: string;
    gameData?: TapestryGameData;
  };

  if (!narrative) return NextResponse.json({ error: "Missing narrative" }, { status: 400 });

  const prompt = `Create a richly detailed medieval tapestry illustration depicting the following moment in a civilization's history. Style: woven textile art, muted earthy tones with gold thread highlights, intricate border patterns, flat perspective typical of medieval tapestries, no text or labels.

Era completed: ${eraName}
Advancing to: ${nextEraName}
Story: ${narrative}`;

  console.log(`[TAP] era=${eraName} → ${nextEraName}`);

  try {
    const session = await auth.api.getSession({ headers: request.headers });
    const distinctId = session?.user?.id ?? anonId ?? "anonymous";
    const token = await getAccessToken();
    const { base64, mimeType } = await callGeminiImage(token, prompt);
    let tapestryId: string | null = null;
    let sharePath: string | null = null;
    let storedByteSize: number | null = null;

    let ssoExpired = false;

    if (isTapestryStorageConfigured()) {
      const ownerScope = session?.user?.id ? "user" : "anon";
      const ownerId = session?.user?.id ?? anonId;

      if (ownerId) {
        try {
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
          storedByteSize = stored.byteSize;
          console.log(`[TAP] ok → image ${mimeType} tapestryId=${tapestryId} s3://${stored.bucket}/${stored.key} (${stored.byteSize} bytes)`);

          await createTapestryRecord({
            id: tapestryId,
            userId: session?.user?.id ?? null,
            anonId: anonId ?? null,
            runId: runId ?? null,
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
        } catch (uploadError) {
          const msg = uploadError instanceof Error ? uploadError.message : String(uploadError);
          if (msg.includes("Token is expired") || msg.includes("CredentialsProviderError")) {
            console.error("[TAP] AWS SSO token expired. Re-run: aws sso login --sso-session sxxx-sso");
            ssoExpired = true;
          } else {
            console.error(`[TAP] S3 upload failed${process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" ? `: ${msg}` : ""}`);
          }
          tapestryId = null;
        }
      }
    }

    const ph = getPostHogClient();
    if (ph) {
      ph.capture({
        distinctId,
        event: "tapestry_generated",
        properties: {
          app: "architect",
          run_id: runId,
          era_name: eraName,
          next_era_name: nextEraName,
          image_model: "gemini-2.5-flash-image",
          mime_type: mimeType,
          saved_to_storage: Boolean(tapestryId),
          sso_expired: ssoExpired,
          byte_size: storedByteSize,
        },
      });
      await ph.shutdown();
    }

    return NextResponse.json({ base64, mimeType, tapestryId, sharePath, ssoExpired });
  } catch (error) {
    console.error("[TAP] Failed (generation or S3 upload):", error);

    const ph = getPostHogClient();
    if (ph) {
      ph.capture({
        distinctId: anonId ?? "anonymous",
        event: "tapestry_generation_error",
        properties: {
          app: "architect",
          run_id: runId,
          era_name: eraName,
          next_era_name: nextEraName,
          image_model: "gemini-2.5-flash-image",
          error_type: error instanceof Error ? error.message : String(error),
        },
      });
      await ph.shutdown();
    }

    return NextResponse.json(
      { error: `Generation failed${process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" ? `: ${error instanceof Error ? error.message : String(error)}` : ""}` },
      { status: 500 },
    );
  }
}
