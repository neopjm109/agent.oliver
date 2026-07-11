import fs from "fs/promises";
import path from "path";

import { Tool, ToolCategory, ToolExecutionContext, ToolResult } from "../types";

export interface RelevantFilesInput {
  query: string;
  paths?: string[];
  extensions?: string[];
  limit?: number;
  maxFileSizeBytes?: number;
}

export interface RelevantFile {
  path: string;
  score: number;
  matchedTerms: string[];
}

export interface RelevantFilesOutput {
  files: RelevantFile[];
  total: number;
}

const DEFAULT_MAX_SIZE = 1024 * 1024 * 2;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-zA-Z0-9_]+/)
    .filter(Boolean);
}

async function collectFiles(dir: string, results: string[]): Promise<void> {
  const entries = await fs.readdir(dir, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (
      entry.name === "node_modules" ||
      entry.name === ".git" ||
      entry.name === "dist" ||
      entry.name === "build"
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      await collectFiles(fullPath, results);

      continue;
    }

    results.push(fullPath);
  }
}

function calculateScore(
  queryTerms: string[],
  content: string,
  filePath: string,
): {
  score: number;
  matchedTerms: string[];
} {
  const lowerContent = content.toLowerCase();

  const lowerPath = filePath.toLowerCase();

  let score = 0;

  const matchedTerms: string[] = [];

  for (const term of queryTerms) {
    let matched = false;

    const contentMatches = lowerContent.split(term).length - 1;

    const pathMatches = lowerPath.split(term).length - 1;

    if (contentMatches > 0) {
      score += contentMatches * 2;
      matched = true;
    }

    if (pathMatches > 0) {
      score += pathMatches * 5;
      matched = true;
    }

    if (matched) {
      matchedTerms.push(term);
    }
  }

  return {
    score,
    matchedTerms,
  };
}

const relevantFilesTool: Tool<RelevantFilesOutput> = {
  definition: {
    name: "relevantFiles",
    description: "Find relevant files using keyword scoring.",
    category: ToolCategory.RETRIEVAL,
    capabilities: ["semantic_search", "project_search", "file_ranking"],
    sideEffects: [],
    retryable: true,
    timeoutMs: 60_000,
    version: "1.0.0",
    tags: ["retrieval", "search"],
  },

  execute: async (
    context: ToolExecutionContext,
  ): Promise<ToolResult<RelevantFilesOutput>> => {
    try {
      const input = context.node.input as RelevantFilesInput;

      if (!input?.query) {
        return {
          success: false,
          error: "query is required.",
        };
      }

      const workspace = context.runtime.workspace || process.cwd();

      const limit = input.limit ?? 10;

      const maxFileSize = input.maxFileSizeBytes || DEFAULT_MAX_SIZE;

      const queryTerms = tokenize(input.query);

      const targetFiles: string[] = [];

      if (input.paths && input.paths.length > 0) {
        for (const target of input.paths) {
          targetFiles.push(path.resolve(workspace, target));
        }
      } else {
        await collectFiles(workspace, targetFiles);
      }

      const results: RelevantFile[] = [];

      for (const filePath of targetFiles) {
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

        const { score, matchedTerms } = calculateScore(
          queryTerms,
          content,
          filePath,
        );

        if (score <= 0) {
          continue;
        }

        results.push({
          path: path.relative(workspace, filePath),
          score,
          matchedTerms,
        });
      }

      results.sort((a, b) => b.score - a.score);

      const files = results.slice(0, limit);

      return {
        success: true,
        data: {
          files,
          total: files.length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to find relevant files.",
      };
    }
  },
};

export default relevantFilesTool;
