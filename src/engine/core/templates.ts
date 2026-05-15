import { GraphTemplate } from "./types";
import { eq, neq, and } from "./conditions";

/**
 * ---------------------------------------------------
 * Simple Response
 * ---------------------------------------------------
 */

export const SimpleResponseTemplate: GraphTemplate = {
  intent: "SIMPLE_RESPONSE",
  description:
    "Use for casual conversation, trivial questions, or no-tool-needed responses.",
  nodes: [
    {
      id: "respond",
      tool: "simpleResponseTool",
      status: "pending",
    },
  ],
  edges: [
    { from: "START", to: "respond" },
    { from: "respond", to: "END" },
  ],
};

export const DocAnalysisTemplate: GraphTemplate = {
  intent: "DOC_ANALYSIS",
  description:
    "Use when user provides text, logs, or documents for analysis or summarization.",
  nodes: [
    {
      id: "find_file",
      tool: "findFilesTool",
      status: "pending",
    },
    {
      id: "read_files",
      tool: "readFilesTool",
      status: "pending",
    },
    {
      id: "chunk_files",
      tool: "chunkFilesTool",
      status: "pending",
    },
    {
      id: "summarize",
      tool: "summarizeTool",
      status: "pending",
    },
  ],
  edges: [
    { from: "START", to: "find_file" },
    { from: "find_file", to: "read_files" },
    { from: "read_files", to: "chunk_files" },
    { from: "chunk_files", to: "summarize" },
    { from: "summarize", to: "END" },
  ],
};

export const FolderAnalysisTemplate: GraphTemplate = {
  intent: "FOLDER_ANALYSIS",
  description:
    "Use when user provides text, logs, or documents for analysis or summarization.",
  nodes: [
    {
      id: "find_file",
      tool: "findFilesTool",
      status: "pending",
    },
    {
      id: "read_files",
      tool: "readFilesTool",
      status: "pending",
    },
    {
      id: "summarize",
      tool: "summarizeFolderTool",
      status: "pending",
    },
  ],
  edges: [
    { from: "START", to: "find_file" },
    { from: "find_file", to: "read_files" },
    { from: "read_files", to: "summarize" },
    { from: "summarize", to: "END" },
  ],
};

export const TEMPLATES_LIST: GraphTemplate[] = [
  SimpleResponseTemplate,
  DocAnalysisTemplate,
  FolderAnalysisTemplate,
];
