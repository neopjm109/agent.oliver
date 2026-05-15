import { exec, ExecOptions } from "child_process";
import path from "path";
import util from "util";

import {
  SideEffect,
  Tool,
  ToolCategory,
  ToolExecutionContext,
  ToolResult,
} from "../types";
import { normalizeOutput } from "../../utils/utils";

const execAsync = util.promisify(exec);

export interface RunCommandInput {
  command: string;
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
  shell?: boolean;
}

export interface RunCommandOutput {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

const runCommandTool: Tool<RunCommandOutput> = {
  definition: {
    name: "runCommand",

    description: "Execute shell commands.",

    category: ToolCategory.EXECUTION,

    capabilities: ["shell_execution", "process_execution", "cli_automation"],

    sideEffects: [SideEffect.PROCESS_EXECUTION],

    retryable: false,

    timeoutMs: 300_000,

    version: "1.0.0",

    tags: ["execution", "shell"],
  },

  execute: async (
    context: ToolExecutionContext,
  ): Promise<ToolResult<RunCommandOutput>> => {
    const startedAt = Date.now();

    try {
      const input = context.node.input as RunCommandInput;

      if (!input?.command) {
        return {
          success: false,
          error: "command is required.",
        };
      }

      const workspace = context.runtime.workspace || process.cwd();

      const cwd = input.cwd ? path.resolve(workspace, input.cwd) : workspace;

      const timeoutMs = input.timeoutMs ?? 300_000;

      const options: ExecOptions = {
        cwd,
        timeout: timeoutMs,
        env: {
          ...process.env,
          ...(input.env || {}),
        },
        shell:
          input.shell === false
            ? undefined
            : process.platform === "win32"
              ? "cmd.exe"
              : "/bin/sh",
        maxBuffer: 1024 * 1024 * 10,
      };

      const result = await execAsync(input.command, options);

      return {
        success: true,

        data: {
          command: input.command,
          exitCode: 0,
          stdout: normalizeOutput(result.stdout) || "",
          stderr: normalizeOutput(result.stderr) || "",
          durationMs: Date.now() - startedAt,
        },
      };
    } catch (error: any) {
      return {
        success: false,

        data: {
          command: error?.cmd || "",
          exitCode: error?.code || 1,
          stdout: error?.stdout || "",
          stderr: error?.stderr || "",
          durationMs: Date.now() - startedAt,
        },

        error: error?.message || "Failed to execute command.",
      };
    }
  },
};

export default runCommandTool;
