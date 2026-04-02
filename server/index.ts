import express from "express";
import { GoogleAuth } from "google-auth-library";

const app = express();
app.use(express.json());

const PROJECT_ID = process.env.GCP_PROJECT_ID || "sc-ai-innovation-lab-2-dev";
const REGION = process.env.GCP_REGION || "us-central1";
const PORT = process.env.PORT || 3001;

const VERTEX_BASE = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/publishers`;

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

const COMBINE_SCHEMA = {
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

const ERA_CHECK_SCHEMA = {
  type: "object" as const,
  properties: {
    results: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          goal: { type: "string" as const, description: "The exact goal description being evaluated" },
          met: { type: "boolean" as const, description: "Whether this goal has been achieved" },
          narrative: { type: "string" as const, description: "If met, 1-2 sentences explaining how. If not met, empty string." },
        },
        required: ["goal", "met", "narrative"],
      },
      description: "Evaluation results for each goal",
    },
  },
  required: ["results"],
};

interface ModelConfig {
  publisher: "google" | "anthropic";
  vertexModel: string;
}

const MODELS: Record<string, ModelConfig> = {
  "gemini-2.5-flash": { publisher: "google", vertexModel: "gemini-2.5-flash" },
  "gemini-3.1": { publisher: "google", vertexModel: "gemini-3.1" },
  "claude-haiku-4.5": { publisher: "anthropic", vertexModel: "claude-haiku-4-5-20251001" },
};

async function getAccessToken(): Promise<string> {
  try {
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    if (!token.token) throw new Error("Failed to get access token");
    return token.token;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("invalid_rapt") || msg.includes("invalid_grant")) {
      throw new Error(
        "GCP auth expired (RAPT policy). Re-run: gcloud auth application-default login"
      );
    }
    throw err;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callGemini(token: string, model: string, prompt: string, schema: Record<string, any>) {
  const url = `${VERTEX_BASE}/google/models/${model}:generateContent`;
  const res = await fetch(url, {
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
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini Vertex API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!raw) throw new Error("Empty response from Gemini");
  return JSON.parse(raw);
}

async function callClaude(token: string, model: string, prompt: string, fieldNames: string[]) {
  const url = `${VERTEX_BASE}/anthropic/models/${model}:rawPredict`;
  const fieldList = fieldNames.map((f) => `"${f}"`).join(", ");
  const res = await fetch(url, {
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

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude Vertex API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const raw = json.content?.[0]?.text?.trim();
  if (!raw) throw new Error("Empty response from Claude");
  return JSON.parse(raw);
}

// --- POST /api/combine ---
app.post("/api/combine", async (req, res) => {
  const { model, prompt } = req.body;

  const config = MODELS[model];
  if (!config) {
    res.status(400).json({ error: `Unknown model: ${model}` });
    return;
  }

  try {
    const token = await getAccessToken();

    let result;
    if (config.publisher === "google") {
      result = await callGemini(token, config.vertexModel, prompt, COMBINE_SCHEMA);
    } else {
      result = await callClaude(token, config.vertexModel, prompt, ["name", "color", "emoji", "description", "narrative"]);
    }

    res.json(result);
  } catch (err) {
    console.error("Combine error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// --- POST /api/check-era ---
interface EraCheckRequest {
  model: string;
  goals: string[];
  actionLog: { parentA: string; parentB: string; result: string; resultTier: number }[];
  inventory: string[];
}

app.post("/api/check-era", async (req, res) => {
  const { model, goals, actionLog, inventory } = req.body as EraCheckRequest;

  const config = MODELS[model];
  if (!config) {
    res.status(400).json({ error: `Unknown model: ${model}` });
    return;
  }

  const recentActions = actionLog
    .map((a) => `  ${a.parentA} + ${a.parentB} → ${a.result} (tier ${a.resultTier})`)
    .join("\n");

  const goalList = goals.map((g, i) => `  ${i + 1}. "${g}"`).join("\n");

  const prompt = `You are judging whether a civilization-building game player has achieved any of the following goals.

Goals to evaluate:
${goalList}

Recent actions:
${recentActions}

Current inventory: ${inventory.join(", ")}

For EACH goal, determine if the player's items or actions achieve it. Be generous but reasonable — items don't need to literally match, but should clearly relate to the goal. For each met goal, write 1-2 sentences describing how. Return your evaluation for every goal listed.`;

  try {
    const token = await getAccessToken();

    let result;
    if (config.publisher === "google") {
      result = await callGemini(token, config.vertexModel, prompt, ERA_CHECK_SCHEMA);
    } else {
      result = await callClaude(token, config.vertexModel, prompt, ["results"]);
    }

    res.json(result);
  } catch (err) {
    console.error("Era check error:", err);
    res.status(500).json({ error: String(err) });
  }
});

// --- POST /api/choose-era ---
const CHOOSE_ERA_SCHEMA = {
  type: "object" as const,
  properties: {
    chosenEra: {
      type: "string" as const,
      description: "The exact name of the chosen era from the eligible list",
    },
    narrative: {
      type: "string" as const,
      description: "2-3 sentences explaining why the civilization is entering this era, based on what the player created",
    },
  },
  required: ["chosenEra", "narrative"],
};

interface ChooseEraRequest {
  model: string;
  completedEras: string[];
  currentEra: string;
  actionLog: { parentA: string; parentB: string; result: string; resultTier: number }[];
  inventory: string[];
  eligibleEras: { name: string; order: number }[];
}

app.post("/api/choose-era", async (req, res) => {
  const { model, completedEras, currentEra, actionLog, inventory, eligibleEras } = req.body as ChooseEraRequest;

  const config = MODELS[model];
  if (!config) {
    res.status(400).json({ error: `Unknown model: ${model}` });
    return;
  }

  const recentActions = actionLog
    .map((a) => `  ${a.parentA} + ${a.parentB} → ${a.result} (tier ${a.resultTier})`)
    .join("\n");

  const eraOptions = eligibleEras.map((e) => `  - ${e.name}`).join("\n");

  const prompt = `You are guiding a civilization-building game. The player has just completed the ${currentEra} and needs to advance to a new era.

Previously completed eras: ${completedEras.length > 0 ? completedEras.join(", ") : "none"}

Recent actions in the ${currentEra}:
${recentActions}

Items the player created: ${inventory.join(", ")}

Based on what the player has built and discovered, choose the most thematically fitting next era from these options:
${eraOptions}

Pick the era that best matches the direction of this civilization's development. For example, if they focused on trade and sailing, the Age of Exploration fits well. If they focused on metalworking and warfare, the Iron Age fits. Write a narrative (2-3 sentences) explaining how the civilization's achievements led them into this new era.

You MUST choose one of the listed era names exactly as written.`;

  try {
    const token = await getAccessToken();

    let result;
    if (config.publisher === "google") {
      result = await callGemini(token, config.vertexModel, prompt, CHOOSE_ERA_SCHEMA);
    } else {
      result = await callClaude(token, config.vertexModel, prompt, ["chosenEra", "narrative"]);
    }

    res.json(result);
  } catch (err) {
    console.error("Choose era error:", err);
    res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
