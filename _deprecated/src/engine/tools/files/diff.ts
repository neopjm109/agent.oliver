import fs from "fs/promises";
import path from "path";

import { Tool, ToolCategory, ToolExecutionContext, ToolResult } from "../types";

export interface DiffFileItem {
  originalPath: string;
  modifiedPath: string;
}

export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  line: string;
}

export interface DiffResult {
  originalPath: string;
  modifiedPath: string;
  changed: boolean;
  diff: DiffLine[];
}

export interface DiffFileInput {
  files: DiffFileItem[];
  encoding?: BufferEncoding;
}

export interface DiffFileOutput {
  files: DiffResult[];
  total: number;
}

function buildDiff(original: string, modified: string): DiffLine[] {
  const originalLines = original.split("\n");

  const modifiedLines = modified.split("\n");

  const max = Math.max(originalLines.length, modifiedLines.length);

  const diff: DiffLine[] = [];

  for (let i = 0; i < max; i++) {
    const oldLine = originalLines[i];
    const newLine = modifiedLines[i];

    if (oldLine === newLine) {
      if (oldLine !== undefined) {
        diff.push({
          type: "unchanged",
          line: oldLine,
        });
      }

      continue;
    }

    if (oldLine !== undefined) {
      diff.push({
        type: "removed",
        line: oldLine,
      });
    }

    if (newLine !== undefined) {
      diff.push({
        type: "added",
        line: newLine,
      });
    }
  }

  return diff;
}

const diffFileTool: Tool<DiffFileOutput> = {
  definition: {
    name: "diffFile",
    description: "Compare two files and generate line-based diff.",

    category: ToolCategory.FILE_SYSTEM,

    capabilities: ["diff_files", "compare_content"],

    sideEffects: [],

    retryable: true,

    timeoutMs: 30_000,

    version: "1.0.0",

    tags: ["filesystem", "diff"],
  },

  execute: async (
    context: ToolExecutionContext,
  ): Promise<ToolResult<DiffFileOutput>> => {
    try {
      const input = context.node.input as DiffFileInput;

      if (
        !input?.files ||
        !Array.isArray(input.files) ||
        input.files.length === 0
      ) {
        return {
          success: false,
          error: "files is required.",
        };
      }

      const workspace = context.runtime.workspace || process.cwd();

      const encoding = input.encoding || "utf-8";

      const results: DiffResult[] = [];

      for (const file of input.files) {
        const originalPath = path.resolve(workspace, file.originalPath);

        const modifiedPath = path.resolve(workspace, file.modifiedPath);

        const originalContent = await fs.readFile(originalPath, encoding);

        const modifiedContent = await fs.readFile(modifiedPath, encoding);

        const diff = buildDiff(originalContent, modifiedContent);

        results.push({
          originalPath: file.originalPath,
          modifiedPath: file.modifiedPath,
          changed: originalContent !== modifiedContent,
          diff,
        });
      }

      return {
        success: true,
        data: {
          files: results,
          total: results.length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to diff files.",
      };
    }
  },
};

export default diffFileTool;
