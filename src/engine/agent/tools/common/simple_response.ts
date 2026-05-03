import { chatInput } from "../../../client/client";
import { Tool } from "../types";

const simpleResponseTool: Tool = {
  definition: {
    name: "simple_llm_response",
    description:
      "Use LLM to analyze or generate a direct response for a given input.",

    intents: ["analyze"],

    parameters: {
      type: "object",
      properties: {
        input: {
          type: "string",
          description: "The text or question to analyze",
        },
      },
      required: ["input"],
    },
  },
  execute: async (args: { input: string; instruction?: string }) => {
    const { input } = args;
    const result = await chatInput(input, { type: "text" });
    return result.choices[0].message?.content || "";
  },
};

export default simpleResponseTool;
