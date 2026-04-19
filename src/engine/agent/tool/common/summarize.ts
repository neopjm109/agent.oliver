import { Tool } from "../types";

const summarizeTool = (): Tool => {
  return {
    definition: {
      name: "summarize",
      description: "",
    },
    execute: async () => {},
  };
};

export default summarizeTool;
