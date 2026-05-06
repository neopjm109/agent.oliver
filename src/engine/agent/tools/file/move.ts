import * as z from "zod";
import { Tool } from "../types";
import { safePath } from "../../utils/paths";
import { dirname } from "path";
import { mkdir, rename } from "fs/promises";

export const MoveFilesSchema = z.object({
  source: z.string().describe("Original path of the file/directory"),
  destination: z
    .string()
    .describe("New path (target path) for the file/directory"),
});

type MoveFileType = z.infer<typeof MoveFilesSchema>;
export const moveFileName = "move_file";

export const moveFileTool: Tool = {
  definition: {
    name: moveFileName,
    description: "Rename or move a file/directory to a new path.",
    intents: ["compute"],
    tags: ["file", "rename", "move"],
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
  execute: async (args: MoveFileType) => {
    const { source, destination } = args;
    if (!source || !destination) {
      return {
        status: "failed",
        reason: "Missing required parameters: source, destination",
      };
    }

    try {
      const oldAbs = safePath(source);
      const newAbs = safePath(destination);
      const newDir = dirname(newAbs);

      // 대상 디렉토리가 없으면 생성
      await mkdir(newDir, { recursive: true });

      // 이동 또는 이름 변경 실행
      await rename(oldAbs, newAbs);

      return `Successfully moved/renamed ${source} to ${destination}`;
    } catch (err: unknown) {
      return (err as Error).message;
    }
  },
};
