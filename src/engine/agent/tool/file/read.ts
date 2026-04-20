import * as z from "zod";
import { Tool } from "../types";

export const readFileName = "read_file";

export const readFileTool = (): Tool => {
  return {
    definition: {
      name: "read_file",
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
    execute: async () => {},
  };
};

export const readFilesSchema = z.object({
  pathname: z.string().describe("Path to the file (relative to root, or absolute within root)"),
});
