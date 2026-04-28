// AI-thinking phase machine. Spec §3.2 "Combine feedback".
//
// Fires Start at +0s, Longer at +2.5s, Long at +6s. resolve() / fail() collapse
// the machine. The copy strings come from the active theme manifest
// (getTheme().copy.aiThinking) — the machine itself is theme-agnostic; only
// the words change per theme.

import { getTheme } from "./theme";

export type AiThinkingPhase =
  | "start"
  | "longer"
  | "long"
  | "veryLong"
  | "failed"
  | "resolved";

export interface AiThinkingOptions {
  /** Fired on every phase transition (including the initial "start" emit). */
  onPhase: (phase: AiThinkingPhase) => void;
  /** Override timing thresholds (ms). Tuned long for the bibliophile pace —
   *  AI calls usually resolve fast; the copy escalation is for the rare slow
   *  one, when patience needs to be acknowledged in a contemplative way. */
  thresholds?: { longer?: number; long?: number; veryLong?: number };
}

export interface AiThinkingHandle {
  /** API call settled successfully — clean up timers, fire "resolved". */
  resolve(): void;
  /** API call failed — clean up timers, fire "failed". */
  fail(): void;
}

export function startAiThinking(opts: AiThinkingOptions): AiThinkingHandle {
  const longerMs = opts.thresholds?.longer ?? 8_000;
  const longMs = opts.thresholds?.long ?? 16_000;
  const veryLongMs = opts.thresholds?.veryLong ?? 24_000;
  let settled = false;

  // Fire start synchronously so the caller can paint the first frame.
  opts.onPhase("start");

  const t1 = setTimeout(() => {
    if (settled) return;
    opts.onPhase("longer");
  }, longerMs);
  const t2 = setTimeout(() => {
    if (settled) return;
    opts.onPhase("long");
  }, longMs);
  const t3 = setTimeout(() => {
    if (settled) return;
    opts.onPhase("veryLong");
  }, veryLongMs);

  return {
    resolve() {
      if (settled) return;
      settled = true;
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      opts.onPhase("resolved");
    },
    fail() {
      if (settled) return;
      settled = true;
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      opts.onPhase("failed");
    },
  };
}

/** Resolve the active theme's copy for a given phase. Returns "" for the
 *  resolved sentinel since the consumer overwrites the toast with the result. */
export function aiThinkingCopy(phase: AiThinkingPhase): string {
  const copy = getTheme().copy.aiThinking;
  switch (phase) {
    case "start": return copy.start;
    case "longer": return copy.longer;
    case "long": return copy.long;
    case "veryLong": return copy.veryLong;
    case "failed": return copy.failed;
    case "resolved": return "";
  }
}
