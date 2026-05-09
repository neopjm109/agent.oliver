import * as z from "zod";
import { dirname, relative } from "path";
import { mkdir, rename, stat } from "fs/promises";
import { safePath, ROOT_DIR } from "../../utils/paths";
import {
  Tool,
  ToolCategory,
  ToolExecutionContext,
  ToolResult,
  SideEffect,
} from "../types";

/**
 * ------------------------------------------------------
 * Schema
 * ------------------------------------------------------
 */

export const MoveFilesSchema = z.object({
  source: z
    .string()
    .describe("Original path of the file or directory"),
  destination: z
    .string()
    .describe("Target path for the file or directory"),
});

export type MoveFileInput = z.infer<typeof MoveFilesSchema>;

/**
 * ------------------------------------------------------
 * Types
 * ------------------------------------------------------
 */

export interface MoveFileResult {
  source: string;
  destination: string;
  moved: boolean;
  type: "file" | "dir";
}

/**
 * ------------------------------------------------------
 * Constants
 * ------------------------------------------------------
 */

export const moveFileName = "moveFileTool";

/**
 * ------------------------------------------------------
 * Tool
 * ------------------------------------------------------
 */

export const moveFileTool: Tool<MoveFileResult> = {
  definition: {
    name: moveFileName,
    description:
      "Moves or renames a file or directory to a new target path.",
    category: ToolCategory.FILE_SYSTEM,
    capabilities: [
      "filesystem_write",
      "file_move",
      "file_rename",
      "directory_move",
    ],
    sideEffects: [
      SideEffect.FILE_WRITE,
      SideEffect.FILE_DELETE,
    ],
    retryable: false,
    timeoutMs: 15_000,
    version: "1.0.0",
    tags: ["filesystem", "move", "rename", "file"],
    inputSchema: {
      type: "object",
      properties: {
        source: {
          type: "string",
          description:
            "Original path of the file or directory.",
        },
        destination: {
          type: "string",
          description:
            "New target path for the file or directory.",
        },
      },
      required: ["source", "destination"],
    },
    outputSchema: {
      type: "object",
    },
  },

  async execute(
    context: ToolExecutionContext,
  ): Promise<ToolResult<MoveFileResult>> {
    try {
      /**
       * ------------------------------------------------------
       * Extract Input
       * ------------------------------------------------------
       */

      const nodeInput = context.node.input || {};
      const source = nodeInput.source;
      const destination = nodeInput.destination;

      if (!source || !destination) {
        return {
          success: false,
          error:
            "Missing required input: source or destination",
          metadata: {
            tool: moveFileName,
          },
        };
      }

      /**
       * ------------------------------------------------------
       * Resolve Safe Paths
       * ------------------------------------------------------
       */

      const sourceAbs = safePath(source);
      const destinationAbs = safePath(destination);

      /**
       * ------------------------------------------------------
       * Validate Source
       * ------------------------------------------------------
       */

      const sourceInfo = await stat(sourceAbs).catch(() => null);

      if (!sourceInfo) {
        return {
          success: false,
          error: `Source path does not exist: ${source}`,
          metadata: {
            tool: moveFileName,
          },
        };
      }

      /**
       * ------------------------------------------------------
       * Create Target Directory
       * ------------------------------------------------------
       */

      const targetDir = dirname(destinationAbs);

      await mkdir(targetDir, {
        recursive: true,
      });

      /**
       * ------------------------------------------------------
       * Move / Rename
       * ------------------------------------------------------
       */

      await rename(sourceAbs, destinationAbs);

      /**
       * ------------------------------------------------------
       * Return Structured Result
       * ------------------------------------------------------
       */

      return {
        success: true,
        data: {
          source: relative(ROOT_DIR, sourceAbs),
          destination: relative(ROOT_DIR, destinationAbs),
          moved: true,
          type: sourceInfo.isDirectory() ? "dir" : "file",
        },
        metadata: {
          tool: moveFileName,
          source: sourceAbs,
          destination: destinationAbs,
          executionId: context.runtime.executionId,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Unknown move file error",
        metadata: {
          tool: moveFileName,
          executionId: context.runtime.executionId,
        },
      };
    }
  },
};