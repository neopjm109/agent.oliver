import * as z from "zod";
import { Tool } from "../types";
import { safePath } from "../../utils/paths";
import { readFile, writeFile } from "fs/promises";

export const PatchFilesSchema = z.object({
  pathname: z
    .string()
    .describe("Path to the file (relative to root, or absolute within root)"),
  search: z
    .string()
    .describe("The exact string/code block to find in the file"),
  replace: z.string().describe("The new string/code block to replace it with"),
});

type PatchFileType = z.infer<typeof PatchFilesSchema>;
export const patchFileName = "patch_file";

export const patchFileTool: Tool = {
  definition: {
    name: patchFileName,
    description:
      "Replace a specific portion of a file's content with new content. Useful for large files.",
    intents: ["compute"],
    tags: ["file", "replace", "patch"],
    parameters: {
      type: "object",
      properties: {
        pathname: {
          type: "string",
          description:
            "Path to the file (relative to root, or absolute within root)",
        },
        search: {
          type: "string",
          description: "The exact string/code block to find in the file",
        },
        replace: {
          type: "string",
          description: "The new string/code block to replace it with",
        },
      },
      required: ["path", "search", "replace"],
    },
  },
  execute: async (args: PatchFileType) => {
    const { pathname, search, replace } = args;
    if (!pathname || search === undefined || replace === undefined) {
      return {
        status: "failed",
        reason: "Missing required parameters: pathname, search, replace",
      };
    }

    try {
      const abs = safePath(pathname);
      const content = await readFile(abs, "utf-8");

      if (!content.includes(search)) {
        return "Error: The search string was not found in the file. Make sure the search string matches exactly (including indentation).";
      }

      const newContent = content.replace(search, replace);
      await writeFile(abs, newContent, "utf-8");

      return `Successfully patched ${pathname}`;
    } catch (err: unknown) {
      return (err as Error).message;
    }
  },
};
