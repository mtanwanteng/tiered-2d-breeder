import { NextResponse } from "next/server";
import {
  callClaude,
  callGemini,
  CHOOSE_ERA_SCHEMA,
  getAccessToken,
  MODELS,
} from "../../../lib/server/vertex";
import { getPostHogClient } from "../../../src/lib/posthog-server";
import { auth } from "../../auth";

export const runtime = "nodejs";

interface ChooseEraRequest {
  model: string;
  completedEras: string[];
  currentEra: string;
  actionLog: { parentA: string; parentB: string; result: string; resultTier: number }[];
  inventory: string[];
  eligibleEras: { name: string; order: number }[];
  anonId?: string;
  runId?: string;
}

export async function POST(request: Request) {
  const { model, completedEras, currentEra, actionLog, inventory, eligibleEras, anonId, runId } =
    (await request.json()) as Partial<ChooseEraRequest>;

  const config = model ? MODELS[model] : undefined;
  if (!config || !completedEras || !currentEra || !actionLog || !inventory || !eligibleEras) {
    return NextResponse.json(
      { error: !config ? `Unknown model: ${model}` : "Missing request data" },
      { status: 400 },
    );
  }

  const recentActions = actionLog
    .map((action) => `  ${action.parentA} + ${action.parentB} -> ${action.result} (tier ${action.resultTier})`)
    .join("\n");

  const eraOptions = eligibleEras.map((era) => `  - ${era.name}`).join("\n");

  const prompt = `You are guiding a civilization-building game. The player has just completed the ${currentEra} and needs to advance to a new era.

Previously completed eras: ${completedEras.length > 0 ? completedEras.join(", ") : "none"}

Recent actions in the ${currentEra}:
${recentActions}

Items the player created: ${inventory.join(", ")}

Based on what the player has built and discovered, choose the most thematically fitting next era from these options:
${eraOptions}

Pick the era that best matches the direction of this civilization's development. For example, if they focused on trade and sailing, the Age of Exploration fits well. If they focused on metalworking and warfare, the Iron Age fits. Write a narrative (2-3 sentences) explaining how the civilization's achievements led them into this new era.

You MUST choose one of the listed era names exactly as written.`;

  console.log(`[ERA-CHO] model=${model} era=${currentEra} options=${eligibleEras.length}`);

  try {
    const [token, session] = await Promise.all([
      getAccessToken(),
      auth.api.getSession({ headers: request.headers }),
    ]);

    const { data: result, inputTokens, outputTokens } =
      config.publisher === "google"
        ? await callGemini(token, config.vertexModel, prompt, CHOOSE_ERA_SCHEMA)
        : await callClaude(token, config.vertexModel, prompt, ["chosenEra", "narrative"]);

    const resultData = result as { chosenEra?: string; narrative?: string };
    console.log(`[ERA-CHO] ok → chosenEra="${resultData.chosenEra}" tokens=${inputTokens}+${outputTokens}`);

    const distinctId = session?.user?.id ?? anonId ?? 'anonymous';
    const ph = getPostHogClient();
    if (ph) {
      ph.capture({ distinctId, event: 'ai_era_choose_requested', properties: { model, era_name: currentEra, run_id: runId, input_tokens: inputTokens, output_tokens: outputTokens } });
      await ph.shutdown();
    }

    return NextResponse.json(resultData);
  } catch (error) {
    console.error(`[ERA-CHO] failed:`, error);
    return NextResponse.json(
      { error: `Era choice failed${process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" ? `: ${String(error)}` : ""}` },
      { status: 500 },
    );
  }
}
