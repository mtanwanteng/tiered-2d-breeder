import { NextResponse } from "next/server";
import {
  callClaude,
  callGemini,
  ERA_CHECK_SCHEMA,
  getAccessToken,
  MODELS,
} from "../../../lib/server/vertex";

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

For EACH goal, determine if the player's items or actions achieve it. Be generous but reasonable - items don't need to literally match, but should clearly relate to the goal. For each met goal, write 1-2 sentences describing how. Return your evaluation for every goal listed.`;

  try {
    const token = await getAccessToken();
    const result =
      config.publisher === "google"
        ? await callGemini(token, config.vertexModel, prompt, ERA_CHECK_SCHEMA)
        : await callClaude(token, config.vertexModel, prompt, ["results"]);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Era check error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
