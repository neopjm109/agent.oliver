import fs from "fs/promises";
import path from "path";

import {
  SideEffect,
  Tool,
  ToolCategory,
  ToolExecutionContext,
  ToolResult,
} from "../types";

export interface DeleteFileInput {
  paths: string[];
  recursive?: boolean;
  force?: boolean;
}

export interface DeleteFileOutput {
  deleted: string[];
  total: number;
}

const deleteFileTool: Tool<DeleteFileOutput> = {
  definition: {
    name: "deleteFiles",
    description: "Delete files or directories.",
    category: ToolCategory.FILE_SYSTEM,
    capabilities: ["delete_files", "remove_directories"],
    sideEffects: [SideEffect.FILE_DELETE],
    retryable: false,
    timeoutMs: 30_000,
    version: "1.0.0",
    tags: ["filesystem", "delete"],
  },

  execute: async (
    context: ToolExecutionContext,
  ): Promise<ToolResult<DeleteFileOutput>> => {
    try {
      const input = context.node.input as DeleteFileInput;

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

      const recursive = input.recursive ?? true;

      const force = input.force ?? true;

      const deleted: string[] = [];

      for (const target of input.paths) {
        const resolvedPath = path.resolve(workspace, target);

        await fs.rm(resolvedPath, {
          recursive,
          force,
        });

        deleted.push(target);
      }

      return {
        success: true,
        data: {
          deleted,
          total: deleted.length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to delete files.",
      };
    }
  },
};

export default deleteFileTool;
