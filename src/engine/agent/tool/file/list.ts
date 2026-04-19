import { Tool } from "../types";

const listFileTool = (): Tool => {
  return {
    definition: {
      name: "list_file",
      description: "",
    },
    execute: async () => {},
  };
};

export default listFileTool;
