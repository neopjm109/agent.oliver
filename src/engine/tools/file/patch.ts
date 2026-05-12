import * as z from "zod";
import { readFile, writeFile } from "fs/promises";
import { relative } from "path";
import { safePath, ROOT_DIR } from "../../utils/paths";
import {
  Tool,
  ToolCategory,
  ToolExecutionContext,
  ToolResult,
  SideEffect,
} from "../types";

export const PatchFilesSchema = z.object({
  pathname: z
    .string()
    .describe("Path to the file (relative to root or absolute within root)"),
  search: z.string().describe("Exact string or code block to find"),
  replace: z.string().describe("Replacement string or code block"),
});

export type PatchFileInput = z.infer<typeof PatchFilesSchema>;

export interface PatchFileResult {
  pathname: string;
  patched: boolean;
  replacements: number;
  originalLength: number;
  updatedLength: number;
}

export const patchFileName = "patchFileTool";

export const patchFileTool: Tool<PatchFileResult> = {
  definition: {
    name: patchFileName,
    description:
      "Replaces a specific portion of a file with new content using exact string matching.",
    category: ToolCategory.FILE_SYSTEM,
    capabilities: [
      "filesystem_write",
      "file_patch",
      "code_modification",
      "content_replacement",
    ],
    sideEffects: [SideEffect.FILE_WRITE],
    retryable: false,
    timeoutMs: 20_000,
    version: "1.0.0",
    tags: ["filesystem", "patch", "replace", "modify", "code"],
    inputSchema: {
      type: "object",
      properties: {
        pathname: {
          type: "string",
          description: "Target file path relative to project root.",
        },
        search: {
          type: "string",
          description: "Exact string or code block to search for.",
        },
        replace: {
          type: "string",
          description: "Replacement string or code block.",
        },
      },
      required: ["pathname", "search", "replace"],
    },
    outputSchema: {
      type: "object",
    },
  },

  async execute(
    context: ToolExecutionContext,
  ): Promise<ToolResult<PatchFileResult>> {
    try {
      const nodeInput = context.node.input || {};
      const pathname = nodeInput.pathname;
      const search = nodeInput.search;
      const replace = nodeInput.replace;

      if (!pathname || search === undefined || replace === undefined) {
        return {
          success: false,
          error: "Missing required input: pathname, search, replace",
          metadata: {
            tool: patchFileName,
          },
        };
      }

      const abs = safePath(pathname);

      const content = await readFile(abs, "utf-8");

      if (!content.includes(search)) {
        return {
          success: false,
          error:
            "Search string not found in file. Ensure exact match including whitespace and indentation.",
          metadata: {
            tool: patchFileName,
            pathname,
            executionId: context.runtime.executionId,
          },
        };
      }

      const replacements = content.split(search).length - 1;
      const updatedContent = content.replace(search, replace);

      await writeFile(abs, updatedContent, "utf-8");

      return {
        success: true,
        data: {
          pathname: relative(ROOT_DIR, abs),
          patched: true,
          replacements,
          originalLength: content.length,
          updatedLength: updatedContent.length,
        },
        metadata: {
          tool: patchFileName,
          pathname: abs,
          replacements,
          executionId: context.runtime.executionId,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Unknown patch file error",
        metadata: {
          tool: patchFileName,
          executionId: context.runtime.executionId,
        },
      };
    }
  },
};
