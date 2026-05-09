import { GraphTemplate } from "./types";

export const SimpleResponseTemplate: GraphTemplate = {
  intent: "SIMPLE_RESPONSE",
  nodes: [{ id: "respond", tool: "simpleResponseTool", status: "pending" }],
  edges: [],
};

export const TranslateTemplate: GraphTemplate = {
  intent: "TRANSLATE",
  nodes: [
    { id: "detect_lang", tool: "analyzeTool", status: "pending" },
    { id: "translate", tool: "translateTool", status: "pending" },
    { id: "refine", tool: "generateContentTool", status: "pending" },
    { id: "format", tool: "formatMarkdownTool", status: "pending" },
  ],
  edges: [
    { from: "detect_lang", to: "translate" },
    { from: "translate", to: "refine" },
    { from: "refine", to: "format" },
  ],
};

export const RunExecuteTemplate: GraphTemplate = {
  intent: "RUN_EXECUTE",
  nodes: [
    { id: "validate", tool: "analyzeTool", status: "pending" },
    { id: "run_cmd", tool: "runCommandTool", status: "pending" },
    { id: "exec_code", tool: "executeCodeTool", status: "pending" },
    { id: "verify", tool: "verifyOutputTool", status: "pending" },
  ],
  edges: [
    { from: "validate", to: "run_cmd" },
    { from: "run_cmd", to: "exec_code" },
    { from: "exec_code", to: "verify" },
  ],
};

export const WebResearchTemplate: GraphTemplate = {
  intent: "WEB_RESEARCH",
  nodes: [
    { id: "search", tool: "searchWebTool", status: "pending" },
    { id: "extract", tool: "summarizeTool", status: "pending" },
    { id: "analyze", tool: "analyzeTool", status: "pending" },
    { id: "verify", tool: "verifyOutputTool", status: "pending" },
    { id: "format", tool: "formatMarkdownTool", status: "pending" },
  ],
  edges: [
    { from: "search", to: "extract" },
    { from: "extract", to: "analyze" },
    { from: "analyze", to: "verify" },
    { from: "verify", to: "format" },
  ],
};

export const DocAnalysisTemplate: GraphTemplate = {
  intent: "DOC_ANALYSIS",
  nodes: [
    { id: "load", tool: "analyzeTool", status: "pending" },
    { id: "chunk", tool: "analyzeTool", status: "pending" },
    { id: "summarize", tool: "summarizeTool", status: "pending" },
    { id: "insight", tool: "generateContentTool", status: "pending" },
    { id: "verify", tool: "verifyOutputTool", status: "pending" },
  ],
  edges: [
    { from: "load", to: "chunk" },
    { from: "chunk", to: "summarize" },
    { from: "summarize", to: "insight" },
    { from: "insight", to: "verify" },
  ],
};

export const CodeGenerateTemplate: GraphTemplate = {
  intent: "CODE_GENERATE",
  nodes: [
    { id: "design", tool: "analyzeTool", status: "pending" },
    { id: "generate", tool: "generateCodeTool", status: "pending" },
    { id: "execute", tool: "executeCodeTool", status: "pending" },
    { id: "verify", tool: "verifyOutputTool", status: "pending" },
    { id: "fix", tool: "patchFileTool", status: "pending" },
  ],
  edges: [
    { from: "design", to: "generate" },
    { from: "generate", to: "execute" },
    { from: "execute", to: "verify" },
    { from: "verify", to: "fix" },
    { from: "fix", to: "execute" },
  ],
};

export const CodeDebuggingTemplate: GraphTemplate = {
  intent: "CODE_DEBUGGING",
  nodes: [
    { id: "inspect", tool: "analyzeTool", status: "pending" },
    { id: "trace", tool: "analyzeTool", status: "pending" },
    { id: "hypothesis", tool: "generateContentTool", status: "pending" },
    { id: "patch", tool: "patchFileTool", status: "pending" },
    { id: "retest", tool: "executeCodeTool", status: "pending" },
    { id: "verify", tool: "verifyOutputTool", status: "pending" },
  ],
  edges: [
    { from: "inspect", to: "trace" },
    { from: "trace", to: "hypothesis" },
    { from: "hypothesis", to: "patch" },
    { from: "patch", to: "retest" },
    { from: "retest", to: "verify" },
    { from: "verify", to: "hypothesis" },
  ],
};

export const ScenarioGenerateTemplate: GraphTemplate = {
  intent: "SCENARIO_GENERATE",
  nodes: [
    { id: "context", tool: "analyzeTool", status: "pending" },
    { id: "branch", tool: "generateContentTool", status: "pending" },
    { id: "simulate", tool: "analyzeTool", status: "pending" },
    { id: "compare", tool: "analyzeTool", status: "pending" },
    { id: "finalize", tool: "generateContentTool", status: "pending" },
  ],
  edges: [
    { from: "context", to: "branch" },
    { from: "branch", to: "simulate" },
    { from: "simulate", to: "compare" },
    { from: "compare", to: "finalize" },
  ],
};

export const ReportGenerateTemplate: GraphTemplate = {
  intent: "REPORT_GENERATE",
  nodes: [
    { id: "collect", tool: "searchWebTool", status: "pending" },
    { id: "structure", tool: "analyzeTool", status: "pending" },
    { id: "write", tool: "generateContentTool", status: "pending" },
    { id: "refine", tool: "summarizeTool", status: "pending" },
    { id: "format", tool: "formatMarkdownTool", status: "pending" },
  ],
  edges: [
    { from: "collect", to: "structure" },
    { from: "structure", to: "write" },
    { from: "write", to: "refine" },
    { from: "refine", to: "format" },
  ],
};

export const TEMPLATES_LIST = [
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