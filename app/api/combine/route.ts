import { NextResponse } from "next/server";
import {
  callClaude,
  callGemini,
  COMBINE_SCHEMA,
  getAccessToken,
  MODELS,
} from "../../../lib/server/vertex";
import { getPostHogClient } from "../../../src/lib/posthog-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { model, prompt, tier, eraName } = (await request.json()) as {
    model?: string;
    prompt?: string;
    tier?: number;
    eraName?: string;
  };

  const config = model ? MODELS[model] : undefined;
  if (!config || !prompt) {
    return NextResponse.json(
      { error: !config ? `Unknown model: ${model}` : "Missing prompt" },
      { status: 400 },
    );
  }

  try {
    const token = await getAccessToken();
    const result =
      config.publisher === "google"
        ? await callGemini(token, config.vertexModel, prompt, COMBINE_SCHEMA)
        : await callClaude(token, config.vertexModel, prompt, [
            "name",
            "color",
            "emoji",
            "description",
            "narrative",
          ]);

    const ph = getPostHogClient();
    ph.capture({ distinctId: 'anonymous', event: 'ai_combination_requested', properties: { model, tier, era_name: eraName } });
    await ph.shutdown();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Combine error:", error);

    const ph = getPostHogClient();
    ph.capture({ distinctId: 'anonymous', event: 'ai_combination_error', properties: { model, error_type: String(error) } });
    await ph.shutdown();

    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
