import { Tool } from "../types";

const writeFileTool = (): Tool => {
  return {
    definition: {
      name: "write_file",
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

export default writeFileTool;
