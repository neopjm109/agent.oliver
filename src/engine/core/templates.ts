import { GraphTemplate } from "./types";
import { eq, neq, and } from "./conditions";

/**
 * ---------------------------------------------------
 * Simple Response
 * ---------------------------------------------------
 */

export const SimpleResponseTemplate: GraphTemplate = {
  intent: "SIMPLE_RESPONSE",
  nodes: [
    {
      id: "respond",
      tool: "simpleResponseTool",
      status: "pending",
    },
  ],
  edges: [
    {
      from: "START",
      to: "respond",
    },
    {
      from: "respond",
      to: "END",
    },
  ],
};

/**
 * ---------------------------------------------------
 * Translate
 * ---------------------------------------------------
 */

export const TranslateTemplate: GraphTemplate = {
  intent: "TRANSLATE",
  nodes: [
    {
      id: "translate",
      tool: "translateTool",
      status: "pending",
    },
    {
      id: "format",
      tool: "formatMarkdownTool",
      status: "pending",
    },
  ],
  edges: [
    {
      from: "START",
      to: "translate",
    },
    {
      from: "translate",
      to: "format",
    },
    {
      from: "format",
      to: "END",
    },
  ],
};

/**
 * ---------------------------------------------------
 * Run Execute
 * ---------------------------------------------------
 */

export const RunExecuteTemplate: GraphTemplate = {
  intent: "RUN_EXECUTE",
  nodes: [
    {
      id: "run_cmd",
      tool: "runCommandTool",
      status: "pending",
    },
    {
      id: "verify",
      tool: "verifyOutputTool",
      status: "pending",
    },
  ],
  edges: [
    {
      from: "START",
      to: "run_cmd",
    },
    {
      from: "run_cmd",
      to: "verify",
    },
    {
      from: "verify",
      to: "END",
    },
  ],
};

/**
 * ---------------------------------------------------
 * Web Research
 * ---------------------------------------------------
 */

export const WebResearchTemplate: GraphTemplate = {
  intent: "WEB_RESEARCH",
  nodes: [
    {
      id: "search",
      tool: "searchWebTool",
      status: "pending",
    },
    {
      id: "extract",
      tool: "summarizeTool",
      status: "pending",
    },
    {
      id: "verify",
      tool: "verifyOutputTool",
      status: "pending",
    },
    {
      id: "format",
      tool: "formatMarkdownTool",
      status: "pending",
    },
  ],
  edges: [
    {
      from: "START",
      to: "search",
    },
    {
      from: "search",
      to: "extract",
    },
    {
      from: "search",
      to: "verify",
    },
    {
      from: "extract",
      to: "format",
    },
    {
      from: "verify",
      to: "format",
    },
    {
      from: "format",
      to: "END",
    },
  ],
};

/**
 * ---------------------------------------------------
 * Document Analysis
 * ---------------------------------------------------
 */

export const DocAnalysisTemplate: GraphTemplate = {
  intent: "DOC_ANALYSIS",
  nodes: [
    {
      id: "load",
      tool: "readFileTool",
      status: "pending",
    },
    {
      id: "summarize",
      tool: "summarizeTool",
      status: "pending",
    },
    {
      id: "insight",
      tool: "generateContentTool",
      status: "pending",
    },
    {
      id: "verify",
      tool: "verifyOutputTool",
      status: "pending",
    },
  ],
  edges: [
    {
      from: "START",
      to: "load",
    },
    {
      from: "load",
      to: "summarize",
    },
    {
      from: "summarize",
      to: "insight",
    },
    {
      from: "insight",
      to: "verify",
    },
    {
      from: "verify",
      to: "END",
    },
  ],
};

/**
 * ---------------------------------------------------
 * Code Generate
 * ---------------------------------------------------
 */

export const CodeGenerateTemplate: GraphTemplate = {
  intent: "CODE_GENERATE",
  nodes: [
    {
      id: "generate",
      tool: "generateCodeTool",
      status: "pending",
    },
    // {
    //   id: "execute_initial",
    //   tool: "executeCodeTool",
    //   status: "pending",
    // },
    // {
    //   id: "verify_initial",
    //   tool: "verifyOutputTool",
    //   status: "pending",
    // },
    // {
    //   id: "fix",
    //   tool: "patchFileTool",
    //   status: "pending",
    //   condition: eq(
    //     "node.verify_initial.output.valid",
    //     false,
    //   ),
    // },
    // {
    //   id: "execute_retry",
    //   tool: "executeCodeTool",
    //   status: "pending",
    // },
    // {
    //   id: "verify_retry",
    //   tool: "verifyOutputTool",
    //   status: "pending",
    // },
  ],
  edges: [
    {
      from: "START",
      to: "generate",
    },
    // {
    //   from: "generate",
    //   to: "execute_initial",
    // },
    // {
    //   from: "execute_initial",
    //   to: "verify_initial",
    // },
    // /**
    //  * success path
    //  */
    // {
    //   from: "verify_initial",
    //   to: "END",
    // },
    // /**
    //  * retry path
    //  */
    // {
    //   from: "verify_initial",
    //   to: "fix",
    // },
    // {
    //   from: "fix",
    //   to: "execute_retry",
    // },
    // {
    //   from: "execute_retry",
    //   to: "verify_retry",
    // },
    // {
    //   from: "verify_retry",
    //   to: "END",
    // },
    {
      from: "generate",
      to: "END",
    },
  ],
};

/**
 * ---------------------------------------------------
 * Code Debugging
 * ---------------------------------------------------
 */

export const CodeDebuggingTemplate: GraphTemplate = {
  intent: "CODE_DEBUGGING",
  nodes: [
    {
      id: "inspect",
      tool: "readFileTool",
      status: "pending",
    },
    {
      id: "hypothesis",
      tool: "generateContentTool",
      status: "pending",
    },
    {
      id: "patch",
      tool: "patchFileTool",
      status: "pending",
    },
    {
      id: "retest",
      tool: "executeCodeTool",
      status: "pending",
    },
    {
      id: "verify",
      tool: "verifyOutputTool",
      status: "pending",
    },
    {
      id: "complete",
      tool: "noopTool",
      status: "pending",
      condition: eq("node.verify.output.valid", true),
    },
  ],
  edges: [
    {
      from: "START",
      to: "inspect",
    },
    {
      from: "inspect",
      to: "hypothesis",
    },
    {
      from: "hypothesis",
      to: "patch",
    },
    {
      from: "patch",
      to: "retest",
    },
    {
      from: "retest",
      to: "verify",
    },
    /**
     * success
     */
    {
      from: "verify",
      to: "complete",
    },
    {
      from: "complete",
      to: "END",
    },
    /**
     * retry loop
     */
    {
      from: "verify",
      to: "hypothesis",
    },
  ],
};

/**
 * ---------------------------------------------------
 * Scenario Generate
 * ---------------------------------------------------
 */

export const ScenarioGenerateTemplate: GraphTemplate = {
  intent: "SCENARIO_GENERATE",
  nodes: [
    {
      id: "context",
      tool: "resolveNodeInputs",
      status: "pending",
    },
    {
      id: "branch",
      tool: "generateContentTool",
      status: "pending",
    },
    {
      id: "simulate",
      tool: "generateContentTool",
      status: "pending",
    },
    {
      id: "compare",
      tool: "summarizeTool",
      status: "pending",
    },
    {
      id: "finalize",
      tool: "generateContentTool",
      status: "pending",
    },
  ],
  edges: [
    {
      from: "START",
      to: "context",
    },
    {
      from: "context",
      to: "branch",
    },
    {
      from: "branch",
      to: "simulate",
    },
    {
      from: "simulate",
      to: "compare",
    },
    {
      from: "compare",
      to: "finalize",
    },
    {
      from: "finalize",
      to: "END",
    },
  ],
};

/**
 * ---------------------------------------------------
 * Report Generate
 * ---------------------------------------------------
 */

export const ReportGenerateTemplate: GraphTemplate = {
  intent: "REPORT_GENERATE",
  nodes: [
    {
      id: "collect",
      tool: "searchWebTool",
      status: "pending",
    },
    {
      id: "structure",
      tool: "resolveNodeInputs",
      status: "pending",
    },
    {
      id: "write",
      tool: "generateContentTool",
      status: "pending",
    },
    {
      id: "refine",
      tool: "summarizeTool",
      status: "pending",
    },
    {
      id: "format",
      tool: "formatMarkdownTool",
      status: "pending",
    },
  ],
  edges: [
    {
      from: "START",
      to: "collect",
    },
    {
      from: "collect",
      to: "structure",
    },
    {
      from: "structure",
      to: "write",
    },
    {
      from: "write",
      to: "refine",
    },
    {
      from: "refine",
      to: "format",
    },
    {
      from: "format",
      to: "END",
    },
  ],
};

/**
 * ---------------------------------------------------
 * Registry
 * ---------------------------------------------------
 */

export const TEMPLATES_LIST: GraphTemplate[] = [
  SimpleResponseTemplate,
  TranslateTemplate,
  RunExecuteTemplate,
  WebResearchTemplate,
  DocAnalysisTemplate,
  CodeGenerateTemplate,
  CodeDebuggingTemplate,
  ScenarioGenerateTemplate,
  ReportGenerateTemplate,
];
