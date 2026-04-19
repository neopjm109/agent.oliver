import { Tool } from "../types";

const patchFileTool = (): Tool => {
  return {
    definition: {
      name: "patch_file",
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
    execute: async () => {},
  };
};

export default patchFileTool;
