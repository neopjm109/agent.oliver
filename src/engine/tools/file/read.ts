import * as z from "zod";
import { readFile, stat } from "fs/promises";
import { relative, extname } from "path";
import { safePath, ROOT_DIR } from "../../utils/paths";
import {
  Tool,
  ToolCategory,
  ToolExecutionContext,
  ToolResult,
} from "../types";

/**
 * ------------------------------------------------------
 * Schema
 * ------------------------------------------------------
 */

export const ReadFilesSchema = z.object({
  pathname: z
    .string()
    .describe(
      "Path to the file (relative to root or absolute within root)",
    ),
});

export type ReadFileInput = z.infer<typeof ReadFilesSchema>;

/**
 * ------------------------------------------------------
 * Types
 * ------------------------------------------------------
 */

export interface ReadFileResult {
  pathname: string;
  extension: string;
  size: number;
  content: string;
}

/**
 * ------------------------------------------------------
 * Constants
 * ------------------------------------------------------
 */

export const readFileName = "readFileTool";

/**
 * ------------------------------------------------------
 * Tool
 * ------------------------------------------------------
 */

export const readFileTool: Tool<ReadFileResult> = {
  definition: {
    name: readFileName,
    description:
      "Reads the contents of a file from the local filesystem.",
    category: ToolCategory.FILE_SYSTEM,
    capabilities: [
      "filesystem_read",
      "file_access",
      "content_loading",
    ],
    retryable: true,
    timeoutMs: 10_000,
    version: "1.0.0",
    tags: ["filesystem", "read", "file", "content"],
    inputSchema: {
      type: "object",
      properties: {
        pathname: {
          type: "string",
          description:
            "Path to the file relative to the project root.",
        },
      },
      required: ["pathname"],
    },
    outputSchema: {
      type: "object",
    },
  },

  async execute(
    context: ToolExecutionContext,
  ): Promise<ToolResult<ReadFileResult>> {
    try {
      /**
       * ------------------------------------------------------
       * Extract Input
       * ------------------------------------------------------
       */

      const nodeInput = context.node.input || {};
      const pathname = nodeInput.pathname;

      if (!pathname) {
        return {
          success: false,
          error: "Missing required input: pathname",
          metadata: {
            tool: readFileName,
          },
        };
      }

      /**
       * ------------------------------------------------------
       * Resolve Safe Path
       * ------------------------------------------------------
       */

      const abs = safePath(pathname);

      /**
       * ------------------------------------------------------
       * Validate File
       * ------------------------------------------------------
       */

      const fileInfo = await stat(abs).catch(() => null);

      if (!fileInfo) {
        return {
          success: false,
          error: `File does not exist: ${pathname}`,
          metadata: {
            tool: readFileName,
            executionId: context.runtime.executionId,
          },
        };
      }

      if (!fileInfo.isFile()) {
        return {
          success: false,
          error: `Path is not a file: ${pathname}`,
          metadata: {
            tool: readFileName,
            executionId: context.runtime.executionId,
          },
        };
      }

      /**
       * ------------------------------------------------------
       * Read File
       * ------------------------------------------------------
       */

      const content = await readFile(abs, "utf-8");

      /**
       * ------------------------------------------------------
       * Return Structured Result
       * ------------------------------------------------------
       */

      return {
        success: true,
        data: {
          pathname: relative(ROOT_DIR, abs),
          extension: extname(abs),
          size: fileInfo.size,
          content,
        },
        metadata: {
          tool: readFileName,
          pathname: abs,
          fileSize: fileInfo.size,
          executionId: context.runtime.executionId,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Unknown read file error",
        metadata: {
          tool: readFileName,
          executionId: context.runtime.executionId,
        },
      };
    }
  },
};