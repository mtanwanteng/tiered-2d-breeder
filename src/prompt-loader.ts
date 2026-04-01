import type { PromptProvider, Tier } from "./types.ts";
import promptsConfig from "./prompts.json";

const config = promptsConfig as {
  tiers: Record<string, string>;
  eras: Record<string, string>;
};

export class FilePromptProvider implements PromptProvider {
  async getPrompt(tier: Tier, eraName: string): Promise<string> {
    const template = config.tiers[String(tier)];
    if (!template) {
      throw new Error(`No prompt configured for tier ${tier}`);
    }
    const eraContext = config.eras[eraName] || "";
    return template.replace("{{era_context}}", eraContext);
  }
}
