import fs from "fs/promises";
import path from "path";

import {
  SideEffect,
  Tool,
  ToolCategory,
  ToolExecutionContext,
  ToolResult,
} from "../types";

export interface MoveFileItem {
  from: string;
  to: string;
}

export interface MoveFileInput {
  files: MoveFileItem[];
  overwrite?: boolean;
  createDirectories?: boolean;
}

export interface MoveFileResult {
  from: string;
  to: string;
}

export interface MoveFileOutput {
  files: MoveFileResult[];
  total: number;
}

const moveFileTool: Tool<MoveFileOutput> = {
  definition: {
    name: "moveFiles",
    description: "Move or rename files.",
    category: ToolCategory.FILE_SYSTEM,
    capabilities: ["move_files", "rename_files"],
    sideEffects: [SideEffect.FILE_WRITE, SideEffect.FILE_DELETE],
    retryable: false,
    timeoutMs: 30_000,
    version: "1.0.0",
    tags: ["filesystem", "move"],
  },

  execute: async (
    context: ToolExecutionContext,
  ): Promise<ToolResult<MoveFileOutput>> => {
    try {
      const input = context.node.input as MoveFileInput;

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

      const overwrite = input.overwrite ?? true;

      const createDirectories = input.createDirectories ?? true;

      const results: MoveFileResult[] = [];

      for (const file of input.files) {
        const fromPath = path.resolve(workspace, file.from);

        const toPath = path.resolve(workspace, file.to);

        try {
          const stat = await fs.stat(toPath);

          if (stat && !overwrite) {
            return {
              success: false,
              error: `Target already exists: ${file.to}`,
            };
          }
        } catch {}

        if (createDirectories) {
          await fs.mkdir(path.dirname(toPath), { recursive: true });
        }

        await fs.rename(fromPath, toPath);

        results.push({
          from: file.from,
          to: file.to,
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
        error: error?.message || "Failed to move files.",
      };
    }
  },
};

export default moveFileTool;
