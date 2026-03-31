import type { PromptProvider, Tier } from "./types.ts";
import promptsConfig from "./prompts.json";

const prompts = promptsConfig as Record<string, string>;

export class FilePromptProvider implements PromptProvider {
  async getPrompt(tier: Tier): Promise<string> {
    const template = prompts[String(tier)];
    if (!template) {
      throw new Error(`No prompt configured for tier ${tier}`);
    }
    return template;
  }
}
