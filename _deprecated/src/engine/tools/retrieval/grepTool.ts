import fs from "fs/promises";
import path from "path";

import { Tool, ToolCategory, ToolExecutionContext, ToolResult } from "../types";

export interface GrepToolInput {
  pattern: string;
  paths?: string[];
  extensions?: string[];
  caseSensitive?: boolean;
  limit?: number;
  maxFileSizeBytes?: number;
}

export interface GrepMatch {
  path: string;
  line: number;
  column: number;
  content: string;
}

export interface GrepToolOutput {
  matches: GrepMatch[];
  total: number;
}

const DEFAULT_MAX_SIZE = 1024 * 1024 * 2;

async function collectFiles(dir: string, results: string[]): Promise<void> {
  const entries = await fs.readdir(dir, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".git" ||
      entry.name === "dist" ||
      entry.name === "build"
    ) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await collectFiles(fullPath, results);

      continue;
    }

    results.push(fullPath);
  }
}

const grepTool: Tool<GrepToolOutput> = {
  definition: {
    name: "grepTool",
    description: "Search text patterns inside files.",
    category: ToolCategory.RETRIEVAL,
    capabilities: ["text_search", "pattern_matching", "code_search"],
    sideEffects: [],
    retryable: true,
    timeoutMs: 60_000,
    version: "1.0.0",
    tags: ["retrieval", "grep"],
  },

  execute: async (
    context: ToolExecutionContext,
  ): Promise<ToolResult<GrepToolOutput>> => {
    try {
      const input = context.node.input as GrepToolInput;

      if (!input?.pattern) {
        return {
          success: false,
          error: "pattern is required.",
        };
      }

      const workspace = context.runtime.workspace || process.cwd();

      const limit = input.limit ?? 100;

      const maxFileSize = input.maxFileSizeBytes || DEFAULT_MAX_SIZE;

      const flags = input.caseSensitive ? "g" : "gi";

      const regex = new RegExp(input.pattern, flags);

      const targetFiles: string[] = [];

      if (input.paths && input.paths.length > 0) {
        for (const target of input.paths) {
          targetFiles.push(path.resolve(workspace, target));
        }
      } else {
        await collectFiles(workspace, targetFiles);
      }

      const matches: GrepMatch[] = [];

      for (const filePath of targetFiles) {
        if (matches.length >= limit) {
          break;
        }

        const ext = path.extname(filePath);

        if (
          input.extensions &&
          input.extensions.length > 0 &&
          !input.extensions.includes(ext)
        ) {
          continue;
        }

        const stat = await fs.stat(filePath);

        if (!stat.isFile() || stat.size > maxFileSize) {
          continue;
        }

        const content = await fs.readFile(filePath, "utf-8");

        const lines = content.split("\n");

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          if (matches.length >= limit) {
            break;
          }

          const lineContent = lines[lineIndex];

          regex.lastIndex = 0;

          let result: RegExpExecArray | null;

          while ((result = regex.exec(lineContent)) !== null) {
            matches.push({
              path: path.relative(workspace, filePath),
              line: lineIndex + 1,
              column: result.index + 1,
              content: lineContent,
            });

            if (matches.length >= limit) {
              break;
            }

            if (result.index === regex.lastIndex) {
              regex.lastIndex++;
            }
          }
        }
      }

      return {
        success: true,
        data: {
          matches,
          total: matches.length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to grep files.",
      };
    }
  },
};

export default grepTool;
