import z from "zod";

export type Intent =
  | "SIMPLE_RESPONSE"
  | "TRANSLATE"
  | "RUN_EXECUTE"
  | "WEB_RESEARCH"
  | "DOC_ANALYSIS"
  | "CODE_GENERATE"
  | "CODE_DEBUGGING"
  | "SCENARIO_GENERATE"
  | "REPORT_GENERATE"
  | "UNKNOWN";

export const IntentSchema = z.enum([
  "SIMPLE_RESPONSE",
  "TRANSLATE",
  "RUN_EXECUTE",
  "WEB_RESEARCH",
  "DOC_ANALYSIS",
  "CODE_GENERATE",
  "CODE_DEBUGGING",
  "SCENARIO_GENERATE",
  "REPORT_GENERATE",
  "UNKNOWN",
]);

export interface IntentResult {
  intent: Intent;
  confidence: number;
  reason?: string;
}

export const IntentResultSchema = z.object({
  intent: IntentSchema,
  confidence: z.number(),
  reason: z.string().optional().nullable(),
});

export type ActionStatus =
  | "pending"
  | "ready"
  | "running"
  | "success"
  | "failed";

export interface ActionNode {
  id: string;
  tool: string;
  status: ActionStatus;
  retryCount?: number;
  error?: string;
  input?: any;
  output?: any;
}

export interface ActionEdge {
  from: string;
  to: string;
}

export interface ActionGraph {
  id: string;
  intent: string;
  nodes: Map<string, ActionNode>;
  edges: ActionEdge[];
  input: any;
}

export interface GraphTemplate {
  intent: Intent;
  nodes: ActionNode[];
  edges: ActionEdge[];
}

export type MutationEvent =
  | { type: "ADD_NODE"; node: ActionNode; after?: string }
  | { type: "REMOVE_NODE"; nodeId: string }
  | { type: "REPLACE_NODE"; oldId: string; newNode: ActionNode }
  | { type: "ADD_EDGE"; from: string; to: string }
  | { type: "REWIRE"; from: string; to: string }
  | { type: "NOOP" };
