import * as z from "zod";
import { Tool } from "../types";

export const writeFileName = "write_file"

export const writeFileTool = (): Tool => {
  return {
    definition: {
      name: writeFileName,
      description:
        "Write content to a file. Directories will be created automatically if they don't exist.",
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
    execute: async () => {},
  };
};

export const writeFilesSchema = z.object({
  pathname: z.string().describe("Path to the file (relative to root, or absolute within root)"),
  content: z.string().describe("파일에 작성할 순수 내용만 입력하세요."),
});
