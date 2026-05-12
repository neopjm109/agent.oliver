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
  | "running"
  | "completed"
  | "skipped"
  | "failed";

export interface ActionNode {
  id: string;
  tool: string;
  status: ActionStatus;
  condition?: Condition;
  rawInput?: number;
  retryCount?: number;
  error?: string;
  input?: any;
  output?: any;
}

export interface ActionEdge {
  from: string;
  to: string;
  condition?: Condition;
}

export interface ActionGraph {
  id: string;
  intent: string;
  nodes: ActionNode[];
  edges: ActionEdge[];
  input: any;
  state: {
    phase: "initial" | "retry" | "finish";
    result: Record<string, any>;
  };
}

export interface GraphTemplate {
  intent: Intent;
  nodes: ActionNode[];
  edges: ActionEdge[];
}

export interface RuntimeContext {
  graphId: string;
  executionId: string;
  startedAt: number;
  metadata?: Record<string, any>;
}

export type MutationEvent =
  | { type: "ADD_NODE"; node: ActionNode; after?: string }
  | { type: "REMOVE_NODE"; nodeId: string }
  | { type: "REPLACE_NODE"; oldId: string; newNode: ActionNode }
  | { type: "ADD_EDGE"; from: string; to: string }
  | { type: "REWIRE"; from: string; to: string }
  | { type: "NOOP" };

export type Condition = ComparisonCondition | LogicalCondition;

export interface ComparisonCondition {
  type: "comparison";
  left: string;
  operator: "==" | "!=" | ">" | "<" | ">=" | "<=";
  right: any;
}

export interface LogicalCondition {
  type: "logical";
  operator: "AND" | "OR";
  conditions: Condition[];
}
