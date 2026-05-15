import fs from "fs/promises";
import path from "path";

import { Tool, ToolCategory, ToolExecutionContext, ToolResult } from "../types";

export interface ReadFilesInput {
  paths: string[];
  encoding?: BufferEncoding;
  maxSizeBytes?: number;
}

export interface ReadFileItem {
  path: string;
  content: string;
  size: number;
}

export interface ReadFilesOutput {
  files: ReadFileItem[];
  total: number;
}

const DEFAULT_MAX_SIZE = 1024 * 1024 * 5;

const readFilesTool: Tool<ReadFilesOutput> = {
  definition: {
    name: "readFiles",
    description: "Read one or multiple files.",
    category: ToolCategory.FILE_SYSTEM,
    capabilities: ["read_files", "load_file_content"],
    sideEffects: [],
    retryable: true,
    timeoutMs: 30_000,
    version: "1.0.0",
    tags: ["filesystem", "reader"],
  },

  execute: async (
    context: ToolExecutionContext,
  ): Promise<ToolResult<ReadFilesOutput>> => {
    try {
      const input = (context.node.input || {}) as ReadFilesInput;

      if (
        !input.paths ||
        !Array.isArray(input.paths) ||
        input.paths.length === 0
      ) {
        return {
          success: false,
          error: "paths is required.",
        };
      }

      const workspace = context.runtime.workspace || process.cwd();

      const encoding = input.encoding || "utf-8";

      const maxSize = input.maxSizeBytes || DEFAULT_MAX_SIZE;

      const files: ReadFileItem[] = [];

      for (const targetPath of input.paths) {
        const resolvedPath = path.resolve(workspace, targetPath);

        const stat = await fs.stat(resolvedPath);

        if (!stat.isFile()) {
          continue;
        }

        if (stat.size > maxSize) {
          return {
            success: false,
            error: `File too large: ${targetPath}`,
          };
        }

        const content = await fs.readFile(resolvedPath, encoding);

        files.push({
          path: targetPath,
          content,
          size: stat.size,
        });
      }

      return {
        success: true,
        data: {
          files,
          total: files.length,
        },
        metadata: {
          encoding,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to read files.",
      };
    }
  },
};

export default readFilesTool;
