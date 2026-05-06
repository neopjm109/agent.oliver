import * as z from "zod";
import { Tool } from "../types";
import { safePath } from "../../utils/paths";
import { dirname } from "path";
import { mkdir, writeFile } from "fs/promises";

export const WriteFilesSchema = z.object({
  pathname: z
    .string()
    .describe("Path to the file (relative to root, or absolute within root)"),
  content: z.string().describe("파일에 작성할 순수 내용만 입력하세요."),
});

type WriteFileType = z.infer<typeof WriteFilesSchema>;
export const writeFileName = "write_file";

export const writeFileTool: Tool = {
  definition: {
    name: writeFileName,
    description:
      "Write content to a file. Directories will be created automatically if they don't exist.",
    intents: ["compute"],
    tags: ["file", "write", "create"],
    parameters: {
      type: "object",
      properties: {
        pathname: {
          type: "string",
          description:
            "Path to the file (relative to root, or absolute within root)",
        },
        content: {
          type: "string",
          description: "파일에 작성할 순수 내용만 입력하세요.",
        },
      },
      required: ["pathname", "content"],
    },
  },
  execute: async (args: WriteFileType) => {
    const { pathname, content } = args;
    if (!pathname)
      return {
        status: "failed",
        reason: "Error: 'pathname' parameter is required",
      };
    if (content === undefined)
      return {
        status: "failed",
        reason: "Error: 'content' parameter is required",
      };

    try {
      const abs = safePath(pathname); // 보안을 위해 safePath는 유지하세요
      const dir = dirname(abs); // 파일이 위치할 디렉토리 추출

      // 1. 디렉토리 재귀적 생성 (이미 있으면 무시됨)
      await mkdir(dir, { recursive: true });

      // 2. 파일 쓰기
      await writeFile(abs, content, "utf-8");

      return `Successfully wrote to ${pathname}`;
    } catch (err: unknown) {
      return (err as Error).message;
    }
  },
};
