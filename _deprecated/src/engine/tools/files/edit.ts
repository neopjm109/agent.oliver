import fs from "fs/promises";
import path from "path";

import {
  SideEffect,
  Tool,
  ToolCategory,
  ToolExecutionContext,
  ToolResult,
} from "../types";

export interface EditOperation {
  type: "replace" | "insert" | "delete";

  target?: string;
  content?: string;

  position?: "before" | "after";

  startLine?: number;
  endLine?: number;

  replaceAll?: boolean;
}

export interface EditFileItem {
  path: string;
  operations: EditOperation[];
}

export interface EditFileInput {
  files: EditFileItem[];
  encoding?: BufferEncoding;
}

export interface EditFileResult {
  path: string;
  edited: boolean;
}

export interface EditFileOutput {
  files: EditFileResult[];
  total: number;
}

function applyReplace(source: string, operation: EditOperation): string {
  if (!operation.target) return source;

  if (operation.replaceAll) {
    return source.split(operation.target).join(operation.content || "");
  }

  return source.replace(operation.target, operation.content || "");
}

function applyInsert(source: string, operation: EditOperation): string {
  if (!operation.target) return source;

  const index = source.indexOf(operation.target);

  if (index === -1) return source;

  if (operation.position === "before") {
    return (
      source.slice(0, index) + (operation.content || "") + source.slice(index)
    );
  }

  return (
    source.slice(0, index + operation.target.length) +
    (operation.content || "") +
    source.slice(index + operation.target.length)
  );
}

function applyDelete(source: string, operation: EditOperation): string {
  if (operation.startLine !== undefined && operation.endLine !== undefined) {
    const lines = source.split("\n");

    lines.splice(
      operation.startLine - 1,
      operation.endLine - operation.startLine + 1,
    );

    return lines.join("\n");
  }

  if (!operation.target) return source;

  if (operation.replaceAll) {
    return source.split(operation.target).join("");
  }

  return source.replace(operation.target, "");
}

function applyOperation(source: string, operation: EditOperation): string {
  switch (operation.type) {
    case "replace":
      return applyReplace(source, operation);

    case "insert":
      return applyInsert(source, operation);

    case "delete":
      return applyDelete(source, operation);

    default:
      return source;
  }
}

const editFileTool: Tool<EditFileOutput> = {
  definition: {
    name: "editFiles",
    description: "Edit existing files using structured operations.",

    category: ToolCategory.FILE_SYSTEM,

    capabilities: ["edit_files", "modify_content", "patch_code"],

    sideEffects: [SideEffect.FILE_WRITE],
    retryable: false,
    timeoutMs: 30_000,
    version: "1.0.0",
    tags: ["filesystem", "editor"],
  },

  execute: async (
    context: ToolExecutionContext,
  ): Promise<ToolResult<EditFileOutput>> => {
    try {
      const input = context.node.input as EditFileInput;

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

      const results: EditFileResult[] = [];

      for (const file of input.files) {
        const resolvedPath = path.resolve(workspace, file.path);

        let content = await fs.readFile(resolvedPath, encoding);

        const original = content;

        for (const operation of file.operations) {
          content = applyOperation(content, operation);
        }

        const edited = original !== content;

        if (edited) {
          await fs.writeFile(resolvedPath, content, encoding);
        }

        results.push({
          path: file.path,
          edited,
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
        error: error?.message || "Failed to edit files.",
      };
    }
  },
};

export default editFileTool;
