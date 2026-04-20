import * as z from "zod";
import { Tool } from "../types";

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

export const patchFileTool = (): Tool => {
  return {
    definition: {
      name: patchFileName,
      description:
        "Replace a specific portion of a file's content with new content. Useful for large files.",
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
    execute: async (args: PatchFileType) => {},
  };
};
