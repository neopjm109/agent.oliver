import { Tool } from "../types";

const codeTool = (): Tool => {
  return {
    definition: {
      name: "code",
      description: "",
    },
    execute: async () => {},
  };
};

export default codeTool;
