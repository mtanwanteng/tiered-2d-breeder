const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export interface FusionResult {
  name: string;
  color: string;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description:
        "A single word or short phrase for the combined concept. Be creative — like Infinite Craft. Stick to real words.",
    },
    color: {
      type: "string",
      description: "A hex color code (e.g. #ff5733) that visually represents the result",
    },
  },
  required: ["name", "color"],
};

export async function fuseElements(a: string, b: string): Promise<FusionResult> {
  if (!API_KEY) {
    console.warn("No VITE_GEMINI_API_KEY set — returning placeholder");
    return { name: `${a}+${b}`, color: "#daa520" };
  }

  const prompt = `You are a creative concept fusion engine, like the game Infinite Craft. Combine these two elements into one new concept. Pick a name (a real word or common phrase) and a hex color that visually represents it.

Element A: "${a}"
Element B: "${b}"`;

  const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!raw) throw new Error("Empty response from Gemini");

  return JSON.parse(raw) as FusionResult;
}
