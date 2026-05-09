import * as z from "zod";
import { execAsync } from "../../utils/utils";
import {
  Tool,
  ToolCategory,
  ToolExecutionContext,
  ToolResult,
  SideEffect,
} from "../types";

/**
 * ------------------------------------------------------
 * Schema
 * ------------------------------------------------------
 */

export const RunCommandSchema = z.object({
  command: z
    .string()
    .describe("Shell command to execute"),
});

export type RunCommandInput = z.infer<
  typeof RunCommandSchema
>;

/**
 * ------------------------------------------------------
 * Types
 * ------------------------------------------------------
 */

export interface RunCommandResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

/**
 * ------------------------------------------------------
 * Constants
 * ------------------------------------------------------
 */

export const runCommandName = "runCommandTool";

/**
 * ------------------------------------------------------
 * Security
 * ------------------------------------------------------
 */

const BLOCKED_PATTERNS = [
  "rm ",
  "shutdown",
  "reboot",
  "mkfs",
  ":(){:|:&};:",
  "dd if=",
  "kill -9",
  "poweroff",
];

/**
 * ------------------------------------------------------
 * Helpers
 * ------------------------------------------------------
 */

function validateCommand(command: string) {
  const lower = command.toLowerCase();

  for (const blocked of BLOCKED_PATTERNS) {
    if (lower.includes(blocked)) {
      throw new Error(
        `Blocked dangerous command pattern: ${blocked}`,
      );
    }
  }
}

/**
 * ------------------------------------------------------
 * Tool
 * ------------------------------------------------------
 */

export const runCommandTool: Tool<RunCommandResult> =
  {
    definition: {
      name: runCommandName,
      description:
        "Executes a system-level shell command and returns stdout/stderr output.",
      category: ToolCategory.SYSTEM,
      capabilities: [
        "shell_execution",
        "system_command",
        "terminal_runtime",
        "process_execution",
      ],
      sideEffects: [
        SideEffect.PROCESS_EXECUTION,
      ],
      retryable: false,
      timeoutMs: 5_000,
      version: "1.0.0",
      tags: [
        "system",
        "shell",
        "command",
        "terminal",
        "runtime",
      ],
      inputSchema: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description:
              "Shell command to execute.",
          },
        },
        required: ["command"],
      },
      outputSchema: {
        type: "object",
      },
    },

    async execute(
      context: ToolExecutionContext,
    ): Promise<
      ToolResult<RunCommandResult>
    > {
      const startedAt = Date.now();

      try {
        /**
         * ------------------------------------------------------
         * Extract Input
         * ------------------------------------------------------
         */

        const nodeInput =
          context.node.input || {};

        const command =
          nodeInput.command;

        if (!command) {
          return {
            success: false,
            error:
              "Missing required input: command",
            metadata: {
              tool: runCommandName,
            },
          };
        }

        /**
         * ------------------------------------------------------
         * Security Validation
         * ------------------------------------------------------
         */

        validateCommand(command);

        /**
         * ------------------------------------------------------
         * Execute Command
         * ------------------------------------------------------
         */

        const {
          stdout,
          stderr,
        } = await execAsync(command, {
          timeout: 5_000,
        });

        const durationMs =
          Date.now() - startedAt;

        /**
         * ------------------------------------------------------
         * Return Structured Result
         * ------------------------------------------------------
         */

        return {
          success: !stderr,
          data: {
            command,
            stdout: stdout || "",
            stderr: stderr || "",
            exitCode: stderr ? 1 : 0,
            durationMs,
          },
          metadata: {
            tool: runCommandName,
            command,
            executionId:
              context.runtime.executionId,
            durationMs,
            stdoutLength:
              stdout?.length || 0,
            stderrLength:
              stderr?.length || 0,
          },
        };
      } catch (error: any) {
        return {
          success: false,
          error:
            error?.message ||
            "Unknown shell execution error",
          metadata: {
            tool: runCommandName,
            executionId:
              context.runtime.executionId,
            durationMs:
              Date.now() - startedAt,
          },
        };
      }
    },
  };