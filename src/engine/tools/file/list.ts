import * as z from "zod";
import { readdir, stat } from "fs/promises";
import { join, relative } from "path";
import { ROOT_DIR, safePath } from "../../utils/paths";
import { Tool, ToolCategory, ToolExecutionContext, ToolResult } from "../types";

export const ListFilesSchema = z.object({
  pathname: z.string().describe("조회할 디렉토리 경로"),
  recursive: z
    .boolean()
    .default(true)
    .describe("하위 디렉토리까지 재귀적으로 탐색 여부"),
});

export type ListFilesInput = z.infer<typeof ListFilesSchema>;

export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  modifiedAt?: number;
}

export interface ListFilesResult {
  root: string;
  recursive: boolean;
  total: number;
  files: FileEntry[];
}

export const listFilesName = "listFilesTool";

async function scanDirectory(
  dir: string,
  recursive: boolean,
): Promise<FileEntry[]> {
  const entries = await readdir(dir);
  const results: FileEntry[] = [];

  for (const name of entries) {
    const abs = join(dir, name);
    const info = await stat(abs).catch(() => null);
    if (!info) continue;

    const isDirectory = info.isDirectory();
    const relativePath = relative(ROOT_DIR, abs);

    results.push({
      name,
      path: relativePath,
      type: isDirectory ? "dir" : "file",
      size: info.size,
      modifiedAt: info.mtimeMs,
    });

    if (recursive && isDirectory) {
      const children = await scanDirectory(abs, recursive);
      results.push(...children);
    }
  }

  return results;
}

export const listFilesTool: Tool<ListFilesResult> = {
  definition: {
    name: listFilesName,
    description:
      "Lists files and directories from the local filesystem with optional recursive traversal.",
    category: ToolCategory.FILE_SYSTEM,
    capabilities: ["filesystem_access", "directory_listing", "recursive_scan"],
    retryable: true,
    timeoutMs: 15_000,
    version: "1.0.0",
    tags: ["filesystem", "directory", "list", "search"],
    inputSchema: {
      type: "object",
      properties: {
        pathname: {
          type: "string",
          description: "Directory path to scan.",
        },
        recursive: {
          type: "boolean",
          description: "Whether to recursively scan subdirectories.",
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
  ): Promise<ToolResult<ListFilesResult>> {
    try {
      const nodeInput = context.node.input || {};
      const pathname = nodeInput.pathname || ".";
      const recursive = nodeInput.recursive ?? true;

      const dir = safePath(pathname);

      const files = await scanDirectory(dir, recursive);

      return {
        success: true,
        data: {
          root: relative(ROOT_DIR, dir),
          recursive,
          total: files.length,
          files,
        },
        metadata: {
          tool: listFilesName,
          root: dir,
          recursive,
          fileCount: files.length,
          executionId: context.runtime.executionId,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Unknown filesystem error",
        metadata: {
          tool: listFilesName,
          executionId: context.runtime.executionId,
        },
      };
    }
  },
};
