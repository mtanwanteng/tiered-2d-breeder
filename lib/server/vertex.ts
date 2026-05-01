import { GoogleAuth } from "google-auth-library";

const PROJECT_ID = process.env.GCP_PROJECT_ID || "sc-ai-innovation-lab-2-dev";
const REGION = process.env.GCP_REGION || "us-central1";
const VERTEX_BASE = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/publishers`;
const SA_KEY_ENV = "GOOGLE_APPLICATION_CREDENTIALS_JSON";

export const COMBINE_SCHEMA = {
  type: "object" as const,
  properties: {
    name: {
      type: "string" as const,
      description: "A single word or short phrase for the combined concept",
    },
    color: {
      type: "string" as const,
      description: "A hex color code (e.g. #ff5733) that visually represents the result",
    },
    emoji: {
      type: "string" as const,
      description: "A single emoji character that represents the concept",
    },
    description: {
      type: "string" as const,
      description: "One sentence of flavor text describing the result",
    },
    narrative: {
      type: "string" as const,
      description: "2-3 sentences of lore connecting this to its parent elements",
    },
  },
  required: ["name", "color", "emoji", "description", "narrative"],
};

export const ERA_CHECK_SCHEMA = {
  type: "object" as const,
  properties: {
    results: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          goal: {
            type: "string" as const,
            description: "The exact goal description being evaluated",
          },
          met: {
            type: "boolean" as const,
            description: "Whether this goal has been achieved",
          },
          narrative: {
            type: "string" as const,
            description: "If met, 1-2 sentences explaining how. If not met, empty string.",
          },
        },
        required: ["goal", "met", "narrative"],
      },
      description: "Evaluation results for each goal",
    },
  },
  required: ["results"],
};

export const CHOOSE_ERA_SCHEMA = {
  type: "object" as const,
  properties: {
    chosenEra: {
      type: "string" as const,
      description: "The exact name of the chosen era from the eligible list",
    },
    narrative: {
      type: "string" as const,
      description:
        "2-3 sentences explaining why the civilization is entering this era, based on what the player created",
    },
  },
  required: ["chosenEra", "narrative"],
};

interface ModelConfig {
  publisher: "google" | "anthropic";
  vertexModel: string;
}

export const MODELS: Record<string, ModelConfig> = {
  "gemini-2.5-flash": { publisher: "google", vertexModel: "gemini-2.5-flash" },
  "gemini-3.1": { publisher: "google", vertexModel: "gemini-3.1" },
  "claude-haiku-4.5": { publisher: "anthropic", vertexModel: "claude-haiku-4-5-20251001" },
};

export async function getAccessToken(): Promise<string> {
  try {
    const auth = process.env[SA_KEY_ENV]
      ? new GoogleAuth({
          credentials: JSON.parse(process.env[SA_KEY_ENV]),
          scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        })
      : new GoogleAuth({
          scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        });

    const client = await auth.getClient();
    const token = await client.getAccessToken();

    if (!token.token) {
      throw new Error("Failed to get access token");
    }

    return token.token;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("invalid_rapt") || message.includes("invalid_grant")) {
      throw new Error(
        "GCP auth expired (RAPT policy). Re-run: gcloud auth application-default login",
      );
    }

    throw error;
  }
}

export async function callGeminiImage(
  token: string,
  prompt: string,
): Promise<{ base64: string; mimeType: string }> {
  const url = `${VERTEX_BASE}/google/models/gemini-2.5-flash-image:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generation_config: {
        response_modalities: ["TEXT", "IMAGE"],
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini image API error ${response.status}: ${text}`);
  }

  const json = await response.json();
  const parts: { inlineData?: { mimeType: string; data: string } }[] = json.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find((p) => p.inlineData?.mimeType?.startsWith("image/"));
  if (!imgPart?.inlineData) throw new Error("No image in Gemini response");
  return { base64: imgPart.inlineData.data, mimeType: imgPart.inlineData.mimeType };
}

export interface CallGeminiOptions {
  /** Gemini 2.5 Flash thinking-budget control. Defaults to dynamic (model
   *  decides). Pass `0` to disable thinking entirely (fastest, cheapest —
   *  appropriate for short structured outputs that don't benefit from
   *  reasoning). Pass a positive integer (1–24576) to cap thinking tokens.
   *  Pass -1 to force dynamic. See:
   *  https://cloud.google.com/vertex-ai/generative-ai/docs/thinking */
  thinkingBudget?: number;
}

export async function callGemini(
  token: string,
  model: string,
  prompt: string,
  schema: Record<string, unknown>,
  options: CallGeminiOptions = {},
): Promise<{ data: unknown; inputTokens: number; outputTokens: number }> {
  const url = `${VERTEX_BASE}/google/models/${model}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        ...(options.thinkingBudget !== undefined && {
          thinkingConfig: {
            thinkingBudget: options.thinkingBudget,
            includeThoughts: false,
          },
        }),
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini Vertex API error ${response.status}: ${text}`);
  }

  const json = await response.json();
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!raw) {
    throw new Error("Empty response from Gemini");
  }

  return {
    data: JSON.parse(raw),
    inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

export async function callClaude(
  token: string,
  model: string,
  prompt: string,
  fieldNames: string[],
): Promise<{ data: unknown; inputTokens: number; outputTokens: number }> {
  const url = `${VERTEX_BASE}/anthropic/models/${model}:rawPredict`;
  const fieldList = fieldNames.map((field) => `"${field}"`).join(", ");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      anthropic_version: "vertex-2023-10-16",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `${prompt}\n\nRespond with ONLY a JSON object with these fields: ${fieldList}.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Claude Vertex API error ${response.status}: ${text}`);
  }

  const json = await response.json();
  const raw = json.content?.[0]?.text?.trim();
  if (!raw) {
    throw new Error("Empty response from Claude");
  }

  return {
    data: JSON.parse(raw),
    inputTokens: json.usage?.input_tokens ?? 0,
    outputTokens: json.usage?.output_tokens ?? 0,
  };
}
