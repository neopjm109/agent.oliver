import { Tool } from "../types";

const listFilesTool = (): Tool => {
  return {
    definition: {
      name: "list_files",
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
    execute: async () => {},
  };
};

export default listFilesTool;
