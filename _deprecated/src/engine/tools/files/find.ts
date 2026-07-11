import fs from "fs/promises";
import path from "path";

import { Tool, ToolCategory, ToolExecutionContext, ToolResult } from "../types";

export interface FindFilesInput {
  root?: string;
  patterns?: string[];
  exclude?: string[];
  recursive?: boolean;
  maxDepth?: number;
  includeDirectories?: boolean;
  absolute?: boolean;
}

export interface FindFilesOutput {
  files: string[];
  total: number;
}

function escapeRegex(value: string): string {
  return value.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

function globToRegex(pattern: string): RegExp {
  const normalized = pattern.replace(/\\/g, "/");

  let regex = escapeRegex(normalized);

  regex = regex.replace(/\\\*\\\*/g, "§DOUBLE_STAR§");
  regex = regex.replace(/\\\*/g, "[^/]*");
  regex = regex.replace(/\\\?/g, ".");

  regex = regex.replace(/§DOUBLE_STAR§/g, ".*");

  return new RegExp(`^${regex}$`);
}

function matchPattern(target: string, patterns: string[]): boolean {
  if (patterns.length === 0) return true;

  const normalized = target.replace(/\\/g, "/");

  return patterns.some((pattern) => globToRegex(pattern).test(normalized));
}

async function walk(
  currentDir: string,
  rootDir: string,
  options: Required<FindFilesInput>,
  depth: number,
  results: string[],
): Promise<void> {
  if (depth > options.maxDepth) return;

  const entries = await fs.readdir(currentDir, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);

    const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, "/");

    if (matchPattern(relativePath, options.exclude)) {
      continue;
    }

    if (entry.isDirectory()) {
      if (
        options.includeDirectories &&
        matchPattern(relativePath, options.patterns)
      ) {
        results.push(options.absolute ? fullPath : relativePath);
      }

      if (options.recursive) {
        await walk(fullPath, rootDir, options, depth + 1, results);
      }

      continue;
    }

    if (!matchPattern(relativePath, options.patterns)) {
      continue;
    }

    results.push(options.absolute ? fullPath : relativePath);
  }
}

const findFilesTool: Tool<FindFilesOutput> = {
  definition: {
    name: "findFiles",
    description: "Find files using glob-like patterns.",
    category: ToolCategory.FILE_SYSTEM,
    capabilities: ["search_files", "directory_traversal"],
    sideEffects: [],
    retryable: true,
    timeoutMs: 30_000,
    version: "1.0.0",
    tags: ["filesystem", "search"],
  },

  execute: async (
    context: ToolExecutionContext,
  ): Promise<ToolResult<FindFilesOutput>> => {
    try {
      const input = (context.node.input || {}) as FindFilesInput;

      const options: Required<FindFilesInput> = {
        root: input.root || process.cwd(),

        patterns: input.patterns || [],

        exclude: input.exclude || [
          "**/node_modules/**",
          "**/.git/**",
          "**/dist/**",
          "**/build/**",
        ],

        recursive: input.recursive ?? true,
        maxDepth: input.maxDepth ?? Infinity,
        includeDirectories: input.includeDirectories ?? false,
        absolute: input.absolute ?? false,
      };

      const rootDir = path.resolve(options.root);

      const results: string[] = [];

      await walk(rootDir, rootDir, options, 0, results);

      results.sort();

      return {
        success: true,
        data: {
          files: results,
          total: results.length,
        },
        metadata: {
          root: rootDir,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to find files.",
      };
    }
  },
};

export default findFilesTool;
