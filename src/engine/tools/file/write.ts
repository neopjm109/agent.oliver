import * as z from "zod";
import { dirname, relative } from "path";
import { mkdir, writeFile, stat } from "fs/promises";
import { safePath, ROOT_DIR } from "../../utils/paths";
import {
  Tool,
  ToolCategory,
  ToolExecutionContext,
  ToolResult,
  SideEffect,
} from "../types";

export const WriteFilesSchema = z.object({
  pathname: z
    .string()
    .describe("Path to the file (relative to root or absolute within root)"),
  content: z.string().describe("Raw content to write into the file"),
});

export type WriteFileInput = z.infer<typeof WriteFilesSchema>;

export interface WriteFileResult {
  pathname: string;
  written: boolean;
  created: boolean;
  bytesWritten: number;
}

export const writeFileName = "writeFileTool";

export const writeFileTool: Tool<WriteFileResult> = {
  definition: {
    name: writeFileName,
    description:
      "Writes content to a file and automatically creates missing directories.",
    category: ToolCategory.FILE_SYSTEM,
    capabilities: [
      "filesystem_write",
      "file_creation",
      "content_persistence",
      "directory_creation",
    ],
    sideEffects: [SideEffect.FILE_WRITE],
    retryable: false,
    timeoutMs: 15_000,
    version: "1.0.0",
    tags: ["filesystem", "write", "create", "file", "content"],
    inputSchema: {
      type: "object",
      properties: {
        pathname: {
          type: "string",
          description: "Target file path relative to the project root.",
        },
        content: {
          type: "string",
          description: "Raw content that will be written into the file.",
        },
      },
      required: ["pathname", "content"],
    },
    outputSchema: {
      type: "object",
    },
  },

  async execute(
    context: ToolExecutionContext,
  ): Promise<ToolResult<WriteFileResult>> {
    try {
      const nodeInput = context.node.input || {};
      const pathname = nodeInput.pathname;
      const content = nodeInput.content;

      if (!pathname) {
        return {
          success: false,
          error: "Missing required input: pathname",
          metadata: {
            tool: writeFileName,
          },
        };
      }

      if (content === undefined) {
        return {
          success: false,
          error: "Missing required input: content",
          metadata: {
            tool: writeFileName,
          },
        };
      }

      const abs = safePath(pathname);
      const dir = dirname(abs);

      const existing = await stat(abs).catch(() => null);
      const created = !existing;

      await mkdir(dir, {
        recursive: true,
      });

      await writeFile(abs, content, "utf-8");

      return {
        success: true,
        data: {
          pathname: relative(ROOT_DIR, abs),
          written: true,
          created,
          bytesWritten: Buffer.byteLength(content, "utf-8"),
        },
        metadata: {
          tool: writeFileName,
          pathname: abs,
          created,
          contentLength: content.length,
          executionId: context.runtime.executionId,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Unknown write file error",
        metadata: {
          tool: writeFileName,
          executionId: context.runtime.executionId,
        },
      };
    }
  },
};
