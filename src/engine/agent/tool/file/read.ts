import * as z from "zod";
import { Tool } from "../types";

export const ReadFilesSchema = z.object({
  pathname: z
    .string()
    .describe("Path to the file (relative to root, or absolute within root)"),
});

type ReadFileType = z.infer<typeof ReadFilesSchema>;
export const readFileName = "read_file";

export const readFileTool = (): Tool => {
  return {
    definition: {
      name: readFileName,
      description:
        "Read the contents of a file. Paths are relative to the root directory.",
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
    execute: async (args: ReadFileType) => {},
  };
};
