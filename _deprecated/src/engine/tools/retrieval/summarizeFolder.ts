import fs from "fs/promises";
import path from "path";

import { Tool, ToolCategory, ToolExecutionContext, ToolResult } from "../types";

export interface SummarizeFolderInput {
  root?: string;
  maxDepth?: number;
  includeHidden?: boolean;
}

export interface FolderSummary {
  totalFiles: number;
  totalDirectories: number;
  extensions: Record<string, number>;
  largestFiles: {
    path: string;
    size: number;
  }[];
  files: string[];
}

export interface SummarizeFolderOutput {
  summary: FolderSummary;
}

interface ScanState {
  totalFiles: number;
  totalDirectories: number;
  extensions: Record<string, number>;
  largestFiles: {
    path: string;
    size: number;
  }[];
  files: string[];
}

async function scanDirectory(
  currentDir: string,
  rootDir: string,
  depth: number,
  maxDepth: number,
  includeHidden: boolean,
  state: ScanState,
): Promise<void> {
  if (depth > maxDepth) {
    return;
  }

  const entries = await fs.readdir(currentDir, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    if (!includeHidden && entry.name.startsWith(".")) {
      continue;
    }

    if (
      entry.name === "node_modules" ||
      entry.name === "dist" ||
      entry.name === "build"
    ) {
      continue;
    }

    const fullPath = path.join(currentDir, entry.name);

    const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      state.totalDirectories++;

      await scanDirectory(
        fullPath,
        rootDir,
        depth + 1,
        maxDepth,
        includeHidden,
        state,
      );

      continue;
    }

    const stat = await fs.stat(fullPath);

    state.totalFiles++;

    state.files.push(relativePath);

    const ext = path.extname(entry.name) || "[no-extension]";

    state.extensions[ext] = (state.extensions[ext] || 0) + 1;

    state.largestFiles.push({
      path: relativePath,
      size: stat.size,
    });
  }
}

const summarizeFolderTool: Tool<SummarizeFolderOutput> = {
  definition: {
    name: "summarizeFolder",

    description: "Analyze and summarize folder structure.",

    category: ToolCategory.RETRIEVAL,

    capabilities: [
      "folder_analysis",
      "project_summary",
      "filesystem_inspection",
    ],

    sideEffects: [],

    retryable: true,

    timeoutMs: 60_000,

    version: "1.0.0",

    tags: ["retrieval", "folder"],
  },

  execute: async (
    context: ToolExecutionContext,
  ): Promise<ToolResult<SummarizeFolderOutput>> => {
    try {
      const input = context.node.input as SummarizeFolderInput;

      const workspace = context.runtime.workspace || process.cwd();

      const root = path.resolve(workspace, input?.root || ".");

      const maxDepth = input?.maxDepth ?? Infinity;

      const includeHidden = input?.includeHidden ?? false;

      const state: ScanState = {
        totalFiles: 0,
        totalDirectories: 0,
        extensions: {},
        largestFiles: [],
        files: [],
      };

      await scanDirectory(root, root, 0, maxDepth, includeHidden, state);

      state.largestFiles.sort((a, b) => b.size - a.size);

      return {
        success: true,
        data: {
          summary: {
            totalFiles: state.totalFiles,
            totalDirectories: state.totalDirectories,
            extensions: state.extensions,
            largestFiles: state.largestFiles.slice(0, 10),
            files: state.files.sort(),
          },
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to summarize folder.",
      };
    }
  },
};

export default summarizeFolderTool;
