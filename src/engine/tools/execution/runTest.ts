import path from "path";

import {
  SideEffect,
  Tool,
  ToolCategory,
  ToolExecutionContext,
  ToolResult,
} from "../types";

import runCommandTool from "./runCommand";

export interface RunTestInput {
  command?: string;
  cwd?: string;
  timeoutMs?: number;
}

export interface RunTestOutput {
  passed: boolean;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

const DEFAULT_TEST_COMMANDS = ["npm test", "pnpm test", "yarn test"];

async function detectTestCommand(workspace: string): Promise<string> {
  /**
   * --------------------------------------------------
   * Optional:
   * package.json 분석해서
   * scripts.test 감지 가능
   * --------------------------------------------------
   */

  return DEFAULT_TEST_COMMANDS[0];
}

const runTestTool: Tool<RunTestOutput> = {
  definition: {
    name: "runTest",

    description: "Run project test command.",

    category: ToolCategory.EXECUTION,

    capabilities: ["test_execution", "quality_validation", "project_testing"],

    sideEffects: [SideEffect.PROCESS_EXECUTION],

    retryable: false,

    timeoutMs: 300_000,

    version: "1.0.0",

    tags: ["execution", "test"],
  },

  execute: async (
    context: ToolExecutionContext,
  ): Promise<ToolResult<RunTestOutput>> => {
    try {
      const input = context.node.input as RunTestInput;

      const workspace = context.runtime.workspace || process.cwd();

      const command = input?.command || (await detectTestCommand(workspace));

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
          error: result.error || "Test execution failed.",
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
        error: error?.message || "Failed to run tests.",
      };
    }
  },
};

export default runTestTool;
