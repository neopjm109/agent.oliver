import * as z from "zod";
import { Tool } from "../types";

export const ListFilesSchema = z.object({
  pathname: z.string().describe("보여줄 파일리스트 경로"),
  recursive: z
    .boolean()
    .default(true)
    .describe("true일 경우, 하위 디렉토리까지 전체 검색"),
});

type ListFilesType = z.infer<typeof ListFilesSchema>;
export const listFilesName = "list_files";

export const listFilesTool = (): Tool => {
  return {
    definition: {
      name: listFilesName,
      description: "",
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
    execute: async (args: ListFilesType) => {},
  };
};
