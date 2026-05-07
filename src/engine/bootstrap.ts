import { ToolExecutor, ToolRegistry, ToolRouter } from "./core/3.executor";
import { IntentRegistry } from "./core/intent.registry";
import { GraphTemplate } from "./core/types";

const bootstrapToolRegistry = new ToolRegistry();
const bootstrapToolExecutor = new ToolExecutor(bootstrapToolRegistry);
export const bootstrapToolRouter = new ToolRouter(bootstrapToolExecutor);

const templates: Map<string, GraphTemplate> = new Map();
export const bootstrapIntentRegistry = new IntentRegistry(templates);
