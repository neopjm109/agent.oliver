import * as z from "zod";
import { Tool } from "../types";

export const moveFileName = "move_file";

export const moveFileTool = (): Tool => {
  return {
    definition: {
      name: moveFileName,
      description: "Rename or move a file/directory to a new path.",
      parameters: {
        type: "object",
        properties: {
          source: {
            type: "string",
            description: "Original path of the file/directory",
          },
          destination: {
            type: "string",
            description: "New path (target path) for the file/directory",
          },
        },
        required: ["source", "destination"],
      },
    },
    execute: async () => {},
  };
};

export const readFilesSchema = z.object({
  source: z.string().describe("Original path of the file/directory"),
  destination: z.string().describe("New path (target path) for the file/directory"),
});
