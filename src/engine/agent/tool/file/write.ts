import { Tool } from "../types";

const writeFileTool = (): Tool => {
  return {
    definition: {
      name: "write_file",
      description: "",
    },
    execute: async () => {},
  };
};

export default writeFileTool;
