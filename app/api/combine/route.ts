import { NextResponse } from "next/server";
import {
  callClaude,
  callGemini,
  COMBINE_SCHEMA,
  getAccessToken,
  MODELS,
} from "../../../lib/server/vertex";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { model, prompt } = (await request.json()) as {
    model?: string;
    prompt?: string;
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

    return NextResponse.json(result);
  } catch (error) {
    console.error("Combine error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
