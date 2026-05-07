import * as z from "zod";
import { Tool } from "../types";
import { safePath } from "../../utils/paths";
import { readFile } from "fs/promises";

export const ReadFilesSchema = z.object({
  pathname: z
    .string()
    .describe("Path to the file (relative to root, or absolute within root)"),
});

type ReadFileType = z.infer<typeof ReadFilesSchema>;
export const readFileName = "read_file";

export const readFileTool: Tool = {
  definition: {
    name: readFileName,
    description:
      "Read the contents of a file. Paths are relative to the root directory.",
    intents: ["search"],
    tags: ["file", "read", "search"],
    parameters: {
      type: "object",
      properties: {
        pathname: {
          type: "string",
          description:
            "Path to the file (relative to root, or absolute within root)",
        },
      },
      required: ["pathname"],
    },
  },
  execute: async (args: ReadFileType) => {
    const { pathname } = args;
    if (!pathname)
      return {
        status: "failed",
        reason: "Error: 'pathname' parameter is required",
      };

    try {
      const abs = safePath(pathname);
      const content = await readFile(abs, "utf-8");

      return {
        pathname: args.pathname,
        content: content, // 원문
      };
    } catch (err: unknown) {
      return (err as Error).message;
    }
  },
};
