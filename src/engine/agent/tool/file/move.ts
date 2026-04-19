import { Tool } from "../types";

const moveFileTool = (): Tool => {
  return {
    definition: {
      name: "move_file",
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

export default moveFileTool;
