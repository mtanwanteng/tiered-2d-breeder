import { NextResponse } from "next/server";
import {
  callClaude,
  callGemini,
  COMBINE_SCHEMA,
  getAccessToken,
  MODELS,
} from "../../../lib/server/vertex";
import { getPostHogClient } from "../../../src/lib/posthog-server";
import { auth } from "../../auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { model, prompt, tier, eraName, anonId, runId } = (await request.json()) as {
    model?: string;
    prompt?: string;
    tier?: number;
    eraName?: string;
    anonId?: string;
    runId?: string;
  };

  const config = model ? MODELS[model] : undefined;
  if (!config || !prompt) {
    return NextResponse.json(
      { error: !config ? `Unknown model: ${model}` : "Missing prompt" },
      { status: 400 },
    );
  }

  console.log(`[CMB] model=${model} tier=${tier} era=${eraName}`);

  try {
    const [token, session] = await Promise.all([
      getAccessToken(),
      auth.api.getSession({ headers: request.headers }),
    ]);

    const { data: result, inputTokens, outputTokens } =
      config.publisher === "google"
        ? await callGemini(token, config.vertexModel, prompt, COMBINE_SCHEMA)
        : await callClaude(token, config.vertexModel, prompt, [
            "name",
            "color",
            "emoji",
            "description",
            "narrative",
          ]);

    const resultData = result as { name?: string; color?: string; emoji?: string; description?: string; narrative?: string };
    console.log(`[CMB] ok → name="${resultData.name}" emoji=${resultData.emoji} tokens=${inputTokens}+${outputTokens}`);

    const distinctId = session?.user?.id ?? anonId ?? 'anonymous';
    const ph = getPostHogClient();
    if (ph) {
      ph.capture({ distinctId, event: 'ai_combination_requested', properties: { model, tier, era_name: eraName, run_id: runId, input_tokens: inputTokens, output_tokens: outputTokens } });
      await ph.shutdown();
    }

    return NextResponse.json(resultData);
  } catch (error) {
    console.error(`[CMB] failed:`, error);

    const ph = getPostHogClient();
    if (ph) {
      ph.capture({ distinctId: 'anonymous', event: 'ai_combination_error', properties: { model, error_type: String(error) } });
      await ph.shutdown();
    }

    return NextResponse.json(
      { error: `Combination failed${process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" ? `: ${String(error)}` : ""}` },
      { status: 500 },
    );
  }
}
