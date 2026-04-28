import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../auth";
import { createEraIdeaTile } from "../../../src/db/era-idea-tiles";
import { getPostHogClient } from "../../../src/lib/posthog-server";
import { randomUUID } from "node:crypto";

interface EraIdeaTilePayload {
  anonId?: string | null;
  runId?: string | null;
  eraName?: string;
  chapterIndex?: number | null;
  tileName?: string;
  tileTier?: number;
  tileEmoji?: string;
  tileColor?: string;
  tileDescription?: string | null;
  tileNarrative?: string | null;
  bindingStripeColor?: string | null;
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id ?? null;

  const payload = (await req.json().catch(() => ({}))) as EraIdeaTilePayload;
  const { anonId, runId, eraName, tileName, tileTier, tileEmoji, tileColor } = payload;

  if (!eraName || !tileName || tileTier === undefined || !tileEmoji || !tileColor) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const id = randomUUID();
  try {
    await createEraIdeaTile({
      id,
      userId,
      anonId: anonId ?? null,
      runId: runId ?? null,
      eraName,
      chapterIndex: payload.chapterIndex ?? null,
      tileName,
      tileTier,
      tileEmoji,
      tileColor,
      tileDescription: payload.tileDescription ?? null,
      tileNarrative: payload.tileNarrative ?? null,
      bindingStripeColor: payload.bindingStripeColor ?? null,
    });
  } catch (err) {
    const detail = process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" ? `: ${err instanceof Error ? err.message : String(err)}` : "";
    console.error(`[IDEA] save failed${detail}`);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }

  const ph = getPostHogClient();
  if (ph) {
    ph.capture({
      distinctId: userId ?? anonId ?? "anonymous",
      event: "era_idea_tile_picked",
      properties: {
        app: "architect",
        run_id: runId,
        era_name: eraName,
        tile_name: tileName,
        tile_tier: tileTier,
      },
    });
    await ph.shutdown();
  }

  return NextResponse.json({ ok: true, id });
}
