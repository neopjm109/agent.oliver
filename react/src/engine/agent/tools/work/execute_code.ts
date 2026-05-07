import { execAsync } from "../../utils/utils";
import { Tool } from "../types";

export const executeCodeTool: Tool = {
  definition: {
    name: "execute_code",
    description:
      "Executes code in a given programming language and returns the result.",

    intents: ["execute"],

    tags: ["code", "execution", "runtime"],

    parameters: {
      type: "object",
      properties: {
        language: {
          type: "string",
          description: "Programming language (e.g., python, javascript).",
        },
        code: {
          type: "string",
          description: "Code to execute.",
        },
      },
      required: ["language", "code"],
    },
  },

  execute: async ({ language, code }) => {
    try {
      let command = "";

      if (language === "javascript") {
        command = `node -e "${code.replace(/"/g, '\\"')}"`;
      } else if (language === "python") {
        command = `python3 -c "${code.replace(/"/g, '\\"')}"`;
      } else {
        throw new Error("Unsupported language");
      }

      const { stdout, stderr } = await execAsync(command, {
        timeout: 5000,
      });

      return {
        output: stdout,
        error: stderr,
        success: !stderr,
        confidence: 0.9,
      };
    } catch (error: any) {
      return {
        output: "",
        error: error.message,
        success: false,
        confidence: 0,
      };
    }
  },
};
