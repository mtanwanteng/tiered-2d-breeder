import type { CombineResult, ModelId } from "./types.ts";

export async function combineElements(model: ModelId, prompt: string): Promise<CombineResult> {
  const res = await fetch("/api/combine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Combine API error ${res.status}: ${text}`);
  }

  return res.json();
}
