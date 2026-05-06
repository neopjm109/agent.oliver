import * as z from "zod";
import { Tool } from "../types";
import { ROOT_DIR, safePath } from "../../utils/paths";
import { readdir, stat } from "fs/promises";
import { join, relative } from "path";

export const ListFilesSchema = z.object({
  pathname: z.string().describe("보여줄 파일리스트 경로"),
  recursive: z
    .boolean()
    .default(true)
    .describe("true일 경우, 하위 디렉토리까지 전체 검색"),
});

type ListFilesType = z.infer<typeof ListFilesSchema>;
export const listFilesName = "list_files";

export const listFilesTool: Tool = {
  definition: {
    name: listFilesName,
    description: "",
    intents: ["search"],
    tags: ["file", "list", "search", "directory"],
    parameters: {
      type: "object",
      properties: {
        pathname: { type: "string", description: "보여줄 파일리스트 경로" },
        recursive: {
          type: "boolean",
          description: "true일 경우, 하위 디렉토리까지 전체 검색",
        },
      },
      required: ["pathname"],
    },
  },
  execute: async (args: ListFilesType) => {
    try {
      const dir = safePath(args.pathname || ".");
      const entries = await readdir(dir);
      const details = await Promise.all(
        entries.map(async (name) => {
          const abs = join(dir, name);
          const info = await stat(abs).catch(() => null);
          const type = info?.isDirectory() ? "dir" : "file";
          // ROOT 기준 상대경로로 표시 — read_file에 그대로 사용 가능
          const relPath = relative(ROOT_DIR, abs);
          return { name: relPath, type: type };
        }),
      );
      return JSON.stringify(details);
    } catch (err: unknown) {
      return (err as Error).message;
    }
  },
};
