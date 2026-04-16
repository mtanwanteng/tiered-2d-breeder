import { NextResponse } from "next/server";
import {
  callClaude,
  callGemini,
  ERA_CHECK_SCHEMA,
  getAccessToken,
  MODELS,
} from "../../../lib/server/vertex";
import { getPostHogClient } from "../../../src/lib/posthog-server";

export const runtime = "nodejs";

interface EraCheckRequest {
  model: string;
  goals: string[];
  actionLog: { parentA: string; parentB: string; result: string; resultTier: number }[];
  inventory: string[];
}

export async function POST(request: Request) {
  const { model, goals, actionLog, inventory } = (await request.json()) as Partial<EraCheckRequest>;
  const config = model ? MODELS[model] : undefined;

  if (!config || !goals || !actionLog || !inventory) {
    return NextResponse.json(
      { error: !config ? `Unknown model: ${model}` : "Missing request data" },
      { status: 400 },
    );
  }

  const recentActions = actionLog
    .map((action) => `  ${action.parentA} + ${action.parentB} -> ${action.result} (tier ${action.resultTier})`)
    .join("\n");

  const goalList = goals.map((goal, index) => `  ${index + 1}. "${goal}"`).join("\n");

  const prompt = `You are judging whether a civilization-building game player has achieved any of the following goals.

Goals to evaluate:
${goalList}

Recent actions:
${recentActions}

Current inventory: ${inventory.join(", ")}

For EACH goal, determine if the player's items or actions achieve it. Be generous but reasonable - items don't need to literally match, but should clearly relate to the goal. 

For each met goal, write a single terse sentence revealing the consequence or hidden meaning, focusing on narrative. Past tense for history, present for ongoing truths. No hedging, no passive voice, no "this was important because". Structure patterns (pick one per entry):
- Consequence statement: "Iron democratized warfare and farming alike."
- Before/after contrast: "Before coins, trade was barter. After coins, trade was empire."
- Parallel list: "The first handle, the first lever, the first fuel."
- Aphorism or paradox: "A castle is both home and weapon."

Make sure to mention the item.
Return your evaluation for every goal listed.`;

  try {
    const token = await getAccessToken();
    const { data: result, inputTokens, outputTokens } =
      config.publisher === "google"
        ? await callGemini(token, config.vertexModel, prompt, ERA_CHECK_SCHEMA)
        : await callClaude(token, config.vertexModel, prompt, ["results"]);

    const ph = getPostHogClient();
    if (ph) {
      ph.capture({ distinctId: 'anonymous', event: 'ai_era_check_requested', properties: { model, input_tokens: inputTokens, output_tokens: outputTokens } });
      await ph.shutdown();
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Era check error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
