import fs from "fs/promises";
import path from "path";

import {
  SideEffect,
  Tool,
  ToolCategory,
  ToolExecutionContext,
  ToolResult,
} from "../types";

import runCommandTool from "./runCommand";

export interface FormatToolInput {
  command?: string;
  cwd?: string;
  check?: boolean;
  timeoutMs?: number;
}

export interface FormatToolOutput {
  formatted: boolean;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

async function detectFormatCommand(
  workspace: string,
  check: boolean,
): Promise<string> {
  try {
    const packageJsonPath = path.join(workspace, "package.json");

    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));

    const scripts = packageJson.scripts || {};

    if (check && scripts["format:check"]) {
      return "npm run format:check";
    }

    if (scripts.format) {
      return check ? "npm run format -- --check" : "npm run format";
    }
  } catch {}

  return check ? "npx prettier . --check" : "npx prettier . --write";
}

const formatTool: Tool<FormatToolOutput> = {
  definition: {
    name: "format",

    description: "Run project formatter.",

    category: ToolCategory.EXECUTION,

    capabilities: [
      "code_formatting",
      "style_normalization",
      "prettier_execution",
    ],

    sideEffects: [SideEffect.PROCESS_EXECUTION, SideEffect.FILE_WRITE],

    retryable: false,

    timeoutMs: 300_000,

    version: "1.0.0",

    tags: ["execution", "format"],
  },

  execute: async (
    context: ToolExecutionContext,
  ): Promise<ToolResult<FormatToolOutput>> => {
    try {
      const input = context.node.input as FormatToolInput;

      const workspace = context.runtime.workspace || process.cwd();

      const check = input?.check ?? false;

      const command =
        input?.command || (await detectFormatCommand(workspace, check));

      const result = await runCommandTool.execute({
        ...context,

        node: {
          ...context.node,

          input: {
            command,
            cwd: input?.cwd,
            timeoutMs: input?.timeoutMs,
          },
        },
      });

      if (!result.data) {
        return {
          success: false,
          error: result.error || "Format execution failed.",
        };
      }

      return {
        success: result.success,

        data: {
          formatted: result.data.exitCode === 0,
          command: result.data.command,
          exitCode: result.data.exitCode,
          stdout: result.data.stdout,
          stderr: result.data.stderr,
          durationMs: result.data.durationMs,
        },

        error: result.error,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to run formatter.",
      };
    }
  },
};

export default formatTool;
