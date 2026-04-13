import { NextResponse } from "next/server";
import { callGeminiImage, getAccessToken } from "../../../lib/server/vertex";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { narrative, eraName, nextEraName } = (await request.json()) as {
    narrative: string;
    eraName: string;
    nextEraName: string;
  };

  if (!narrative) return NextResponse.json({ error: "Missing narrative" }, { status: 400 });

  const prompt = `Create a richly detailed medieval tapestry illustration depicting the following moment in a civilization's history. Style: woven textile art, muted earthy tones with gold thread highlights, intricate border patterns, flat perspective typical of medieval tapestries, no text or labels.

Era completed: ${eraName}
Advancing to: ${nextEraName}
Story: ${narrative}`;

  try {
    const token = await getAccessToken();
    const { base64, mimeType } = await callGeminiImage(token, prompt);
    return NextResponse.json({ base64, mimeType });
  } catch (error) {
    console.error("[TAP] Tapestry generation failed:", error);
    return NextResponse.json(
      { error: `Generation failed${process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" ? `: ${error instanceof Error ? error.message : String(error)}` : ""}` },
      { status: 500 },
    );
  }
}
