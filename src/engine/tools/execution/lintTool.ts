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

export interface LintToolInput {
  command?: string;
  cwd?: string;
  fix?: boolean;
  timeoutMs?: number;
}

export interface LintToolOutput {
  passed: boolean;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

async function detectLintCommand(
  workspace: string,
  fix: boolean,
): Promise<string> {
  try {
    const packageJsonPath = path.join(workspace, "package.json");

    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));

    const scripts = packageJson.scripts || {};

    if (fix && scripts["lint:fix"]) {
      return "npm run lint:fix";
    }

    if (scripts.lint) {
      return fix ? "npm run lint -- --fix" : "npm run lint";
    }
  } catch {}

  return fix ? "npx eslint . --fix" : "npx eslint .";
}

const lintTool: Tool<LintToolOutput> = {
  definition: {
    name: "lint",

    description: "Run project lint checks.",

    category: ToolCategory.EXECUTION,

    capabilities: ["lint_execution", "code_quality_check", "static_analysis"],

    sideEffects: [SideEffect.PROCESS_EXECUTION],

    retryable: false,

    timeoutMs: 300_000,

    version: "1.0.0",

    tags: ["execution", "lint"],
  },

  execute: async (
    context: ToolExecutionContext,
  ): Promise<ToolResult<LintToolOutput>> => {
    try {
      const input = context.node.input as LintToolInput;

      const workspace = context.runtime.workspace || process.cwd();

      const command =
        input?.command ||
        (await detectLintCommand(workspace, input?.fix ?? false));

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
          error: result.error || "Lint execution failed.",
        };
      }

      return {
        success: result.success,

        data: {
          passed: result.data.exitCode === 0,
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
        error: error?.message || "Failed to run lint.",
      };
    }
  },
};

export default lintTool;
