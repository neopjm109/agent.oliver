import z from "zod";

export type Intent =
  | "SIMPLE_RESPONSE"
  | "DOC_ANALYSIS"
  | "FOLDER_ANALYSIS"
  | "UNKNOWN";
// | "TRANSLATE"
// | "RUN_EXECUTE"
// | "WEB_RESEARCH"
// | "CODE_GENERATE"
// | "CODE_DEBUGGING"
// | "SCENARIO_GENERATE"
// | "REPORT_GENERATE"
// | "UNKNOWN";

export const IntentSchema = z.enum([
  "SIMPLE_RESPONSE",
  // "TRANSLATE",
  // "RUN_EXECUTE",
  // "WEB_RESEARCH",
  "DOC_ANALYSIS",
  "FOLDER_ANALYSIS",
  // "CODE_GENERATE",
  // "CODE_DEBUGGING",
  // "SCENARIO_GENERATE",
  // "REPORT_GENERATE",
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
  | "queued"
  | "running"
  | "completed"
  | "skipped"
  | "failed"
  | "cancelled";

export type GraphPhase =
  | "planning"
  | "execution"
  | "repair"
  | "reflection"
  | "completed"
  | "failed";

export type Condition =
  | ComparisonCondition
  | LogicalCondition
  | ExistsCondition
  | StatusCondition;

export interface ComparisonCondition {
  /** Condition type */
  type: "comparison";

  /** Left operand path */
  left: string;

  /** Comparison operator */
  operator: "==" | "!=" | ">" | "<" | ">=" | "<=" | "includes" | "matches";

  /** Right operand */
  right: any;
}

export interface LogicalCondition {
  /** Condition type */
  type: "logical";

  /** Logical operator */
  operator: "AND" | "OR" | "NOT";

  /** Nested conditions */
  conditions: Condition[];
}

export interface ExistsCondition {
  /** Condition type */
  type: "exists";

  /** Target path */
  target: string;

  /** Expected existence */
  exists?: boolean;
}

export interface StatusCondition {
  /** Condition type */
  type: "status";

  /** Target node id */
  nodeId: string;

  /** Expected status */
  status: ActionStatus | ActionStatus[];
}

export interface ActionNode {
  /** Node id */
  id: string;

  /** Tool name */
  tool: string;

  /** Runtime status */
  status: ActionStatus;

  /** Node condition */
  condition?: Condition;

  /** Raw unresolved input */
  rawInput?: any;

  /** Resolved input */
  input?: any;

  /** Tool output */
  output?: any;

  /** Retry count */
  retryCount?: number;

  /** Max retry limit */
  maxRetries?: number;

  /** Error message */
  error?: string;

  /** Dependency node ids */
  dependsOn?: string[];

  /** Execution priority */
  priority?: number;

  /** Node tags */
  tags?: string[];

  /** Start timestamp */
  startedAt?: number;

  /** Completion timestamp */
  completedAt?: number;

  /** Execution duration */
  durationMs?: number;
}

export interface ActionEdge {
  /** Source node id */
  from: string;

  /** Target node id */
  to: string;

  /** Edge condition */
  condition?: Condition;

  /** Edge label */
  label?: string;
}

export interface FileSnapshot {
  /** File path */
  path: string;

  /** File content */
  content: string;

  /** Content hash */
  hash?: string;

  /** Cached summary */
  summary?: string;

  /** Last modified timestamp */
  lastModified?: number;
}

export interface FileChange {
  /** File path */
  path: string;

  /** Change type */
  type: "create" | "update" | "delete";

  /** Previous content */
  before?: string;

  /** Updated content */
  after?: string;

  /** Unified diff */
  diff?: string;
}

export interface CommandResult {
  /** Executed command */
  command: string;

  /** Standard output */
  stdout: string;

  /** Standard error */
  stderr: string;

  /** Exit code */
  exitCode: number;

  /** Success flag */
  success: boolean;

  /** Execution timestamp */
  timestamp: number;
}

export interface Diagnostic {
  /** File path */
  file: string;

  /** Severity level */
  severity: "error" | "warning" | "info";

  /** Diagnostic message */
  message: string;

  /** Line number */
  line?: number;

  /** Column number */
  column?: number;

  /** Diagnostic source */
  source?: string;

  /** Diagnostic code */
  code?: string | number;
}

export interface Goal {
  /** Goal id */
  id: string;

  /** Goal description */
  description: string;

  /** Goal status */
  status: "pending" | "running" | "completed" | "failed";

  /** Goal priority */
  priority?: number;
}

export interface Artifact {
  /** Artifact type */
  type: "patch" | "report" | "plan" | "test" | "summary";

  /** Artifact content */
  content: any;
}

export interface ExecutionContext {
  /** Current node id */
  currentNodeId?: string;

  /** Current iteration */
  iteration: number;

  /** Max iteration limit */
  maxIterations?: number;

  /** Workflow start timestamp */
  startedAt?: number;

  /** Last execution timestamp */
  lastExecutedAt?: number;
}

export interface ActionState {
  /** Current workflow phase */
  phase: GraphPhase;

  /** Shared result store */
  result: Record<string, any>;

  /** Selected file paths */
  selectedFiles: string[];

  /** Loaded file snapshots */
  loadedFiles: Record<string, FileSnapshot>;

  /** Changed files */
  changedFiles: FileChange[];

  /** Command execution results */
  commandResults: CommandResult[];

  /** Compiler/LSP diagnostics */
  diagnostics: Diagnostic[];

  /** Cached summaries */
  summaries: Record<string, string>;

  /** ReAct-style observations */
  observations: string[];

  /** Active goals */
  goals: Goal[];

  /** Generated artifacts */
  artifacts: Artifact[];

  /** Runtime execution context */
  executionContext: ExecutionContext;
}

export interface ActionGraph {
  /** Workflow id */
  id: string;

  /** User intent */
  intent: string;

  /** Initial input */
  input: any;

  /** Workflow nodes */
  nodes: ActionNode[];

  /** Workflow edges */
  edges: ActionEdge[];

  /** Shared runtime state */
  state: ActionState;

  /** Graph metadata */
  metadata?: {
    createdAt?: number;
    updatedAt?: number;
    version?: string;
    tags?: string[];
  };
}

export interface GraphTemplate {
  /** Target intent */
  intent: Intent;

  /** Template description */
  description: string;

  /** Template nodes */
  nodes: ActionNode[];

  /** Template edges */
  edges: ActionEdge[];
}

export interface RuntimeContext {
  /** Graph id */
  graphId: string;

  /** Execution id */
  executionId: string;

  /** Execution start timestamp */
  startedAt: number;

  /** Workspace path */
  workspace?: string;

  /** Runtime metadata */
  metadata?: Record<string, any>;
}

export type MutationEvent =
  | {
      type: "ADD_NODE";
      node: ActionNode;
      after?: string;
    }
  | {
      type: "REMOVE_NODE";
      nodeId: string;
    }
  | {
      type: "REPLACE_NODE";
      oldId: string;
      newNode: ActionNode;
    }
  | {
      type: "ADD_EDGE";
      from: string;
      to: string;
      condition?: Condition;
    }
  | {
      type: "REMOVE_EDGE";
      from: string;
      to: string;
    }
  | {
      type: "REWIRE";
      from: string;
      to: string;
    }
  | {
      type: "UPDATE_CONDITION";
      target: "node" | "edge";
      targetId: string;
      condition?: Condition;
    }
  | {
      type: "NOOP";
    };
