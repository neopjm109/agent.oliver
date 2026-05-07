import { execAsync } from "../../utils/utils";
import { Tool } from "../types";

export const runCommandTool: Tool = {
  definition: {
    name: "run_command",
    description: "Executes a system-level command and returns the result.",

    intents: ["execute"],

    tags: ["system", "shell", "command"],

    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Shell command to execute.",
        },
      },
      required: ["command"],
    },
  },

  execute: async ({ command }) => {
    try {
      // 🔥 간단한 보안 필터
      if (command.includes("rm") || command.includes("shutdown")) {
        throw new Error("Dangerous command blocked");
      }

      const { stdout, stderr } = await execAsync(command, {
        timeout: 5000,
      });

      return {
        stdout,
        stderr,
        success: !stderr,
        confidence: 0.85,
      };
    } catch (error: any) {
      return {
        stdout: "",
        stderr: error.message,
        success: false,
        confidence: 0,
      };
    }
  },
};
