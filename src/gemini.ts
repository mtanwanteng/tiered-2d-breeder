import type { CombineResult, ModelId } from "./types";

export async function combineElements(
  model: ModelId,
  prompt: string,
  tier?: number,
  eraName?: string,
  anonId?: string,
  runId?: string,
): Promise<CombineResult> {
  const res = await fetch("/api/combine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, tier, eraName, anonId, runId }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Combine API error ${res.status}: ${text}`);
  }

  return res.json();
}
