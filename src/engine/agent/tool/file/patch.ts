import { Tool } from "../types";

const patchFileTool = (): Tool => {
  return {
    definition: {
      name: "patch_file",
      description: "",
    },
    execute: async () => {},
  };
};

export default patchFileTool;
