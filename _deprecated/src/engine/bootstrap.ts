import { ToolExecutor, ToolRegistry } from "./core/3.executor";
import { IntentRegistry } from "./core/intent.registry";
import { TEMPLATES_LIST } from "./core/templates";
import { GraphTemplate } from "./core/types";
import { TOOL_LIST } from "./tools";

export const bootstrapToolRouter = (): ToolExecutor => {
  const registry = new ToolRegistry();
  for (const t of TOOL_LIST) {
    registry.register(t);
  }
  return new ToolExecutor(registry);
};

const templates: Map<string, GraphTemplate> = new Map();
export const bootstrapIntentRegistry = (): IntentRegistry => {
  for (const t of TEMPLATES_LIST) {
    templates.set(t.intent, t);
  }
  return new IntentRegistry(templates);
};
