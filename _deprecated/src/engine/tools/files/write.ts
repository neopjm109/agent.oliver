import fs from "fs/promises";
import path from "path";

import {
  SideEffect,
  Tool,
  ToolCategory,
  ToolExecutionContext,
  ToolResult,
} from "../types";

export interface WriteFileItem {
  path: string;
  content: string;
}

export interface WriteFileInput {
  files: WriteFileItem[];
  encoding?: BufferEncoding;
  createDirectories?: boolean;
  overwrite?: boolean;
}

export interface WriteFileOutput {
  written: string[];
  total: number;
}

const writeFileTool: Tool<WriteFileOutput> = {
  definition: {
    name: "writeFiles",
    description: "Write one or multiple files.",
    category: ToolCategory.FILE_SYSTEM,
    capabilities: ["write_files", "create_files"],
    sideEffects: [SideEffect.FILE_WRITE],
    retryable: false,
    timeoutMs: 30_000,
    version: "1.0.0",
    tags: ["filesystem", "writer"],
  },

  execute: async (
    context: ToolExecutionContext,
  ): Promise<ToolResult<WriteFileOutput>> => {
    try {
      const input = context.node.input as WriteFileInput;

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

      const encoding = input.encoding || "utf-8";

      const createDirectories = input.createDirectories ?? true;

      const overwrite = input.overwrite ?? true;

      const written: string[] = [];

      for (const file of input.files) {
        const resolvedPath = path.resolve(workspace, file.path);

        try {
          const stat = await fs.stat(resolvedPath);

          if (stat.isFile() && !overwrite) {
            return {
              success: false,
              error: `File already exists: ${file.path}`,
            };
          }
        } catch {}

        if (createDirectories) {
          await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
        }

        await fs.writeFile(resolvedPath, file.content, encoding);

        written.push(file.path);
      }

      return {
        success: true,
        data: {
          written,
          total: written.length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to write files.",
      };
    }
  },
};

export default writeFileTool;
