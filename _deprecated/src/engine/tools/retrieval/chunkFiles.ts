import fs from "fs/promises";
import path from "path";

import { Tool, ToolCategory, ToolExecutionContext, ToolResult } from "../types";

export interface ChunkFilesInput {
  paths: string[];
  chunkSize?: number;
  chunkOverlap?: number;
  encoding?: BufferEncoding;
}

export interface FileChunk {
  path: string;
  chunkIndex: number;
  startLine: number;
  endLine: number;
  content: string;
}

export interface ChunkFilesOutput {
  chunks: FileChunk[];
  total: number;
}

const chunkFilesTool: Tool<ChunkFilesOutput> = {
  definition: {
    name: "chunkFiles",
    description: "Split files into smaller chunks.",

    category: ToolCategory.RETRIEVAL,

    capabilities: ["chunk_files", "split_content", "prepare_embeddings"],

    sideEffects: [],

    retryable: true,

    timeoutMs: 60_000,

    version: "1.0.0",

    tags: ["retrieval", "chunk"],
  },

  execute: async (
    context: ToolExecutionContext,
  ): Promise<ToolResult<ChunkFilesOutput>> => {
    try {
      const input = context.node.input as ChunkFilesInput;

      if (
        !input?.paths ||
        !Array.isArray(input.paths) ||
        input.paths.length === 0
      ) {
        return {
          success: false,
          error: "paths is required.",
        };
      }

      const workspace = context.runtime.workspace || process.cwd();

      const chunkSize = input.chunkSize ?? 100;

      const chunkOverlap = input.chunkOverlap ?? 20;

      const encoding = input.encoding || "utf-8";

      const chunks: FileChunk[] = [];

      for (const targetPath of input.paths) {
        const resolvedPath = path.resolve(workspace, targetPath);

        const content = await fs.readFile(resolvedPath, encoding);

        const lines = content.split("\n");

        let chunkIndex = 0;

        for (
          let start = 0;
          start < lines.length;
          start += chunkSize - chunkOverlap
        ) {
          const end = Math.min(start + chunkSize, lines.length);

          const chunkContent = lines.slice(start, end).join("\n");

          chunks.push({
            path: targetPath,
            chunkIndex,
            startLine: start + 1,
            endLine: end,
            content: chunkContent,
          });

          chunkIndex++;

          if (end >= lines.length) {
            break;
          }
        }
      }

      return {
        success: true,
        data: {
          chunks,
          total: chunks.length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to chunk files.",
      };
    }
  },
};

export default chunkFilesTool;
