import { Tool } from "../types";

const analyzeTool = (): Tool => {
  return {
    definition: {
      name: "analyze",
      intents: ["analyze"],
      tags: ["analyze", "respond", "response"],
      description: "",
    },
    execute: async () => {},
  };
};

export default analyzeTool;
