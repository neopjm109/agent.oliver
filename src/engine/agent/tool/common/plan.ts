import { Tool } from "../types";

const planTool = (): Tool => {
  return {
    definition: {
      name: "plan",
      description: "",
    },
    execute: async () => {},
  };
};

export default planTool;
