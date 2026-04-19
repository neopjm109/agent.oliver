import { Tool } from "../types";

const readFileTool = (): Tool => {
  return {
    definition: {
      name: "read_file",
      description: "",
    },
    execute: async () => {},
  };
};

export default readFileTool;
