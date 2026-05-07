import { GraphTemplate } from "./types";

export class IntentRegistry {
  constructor(private templates: Map<string, GraphTemplate>) {}

  get(intent: string): GraphTemplate {
    const template = this.templates.get(intent);

    if (!template) {
      throw new Error(`No template found for intent: ${intent}`);
    }

    return template;
  }
}
