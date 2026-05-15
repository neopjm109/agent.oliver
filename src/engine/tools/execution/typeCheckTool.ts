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

export interface TypeCheckToolInput {
  command?: string;
  cwd?: string;
  timeoutMs?: number;
}

export interface TypeCheckToolOutput {
  passed: boolean;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

async function detectTypeCheckCommand(workspace: string): Promise<string> {
  try {
    const packageJsonPath = path.join(workspace, "package.json");

    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));

    const scripts = packageJson.scripts || {};

    if (scripts.typecheck) {
      return "npm run typecheck";
    }

    if (scripts["type-check"]) {
      return "npm run type-check";
    }
  } catch {}

  const tsconfigPath = path.join(workspace, "tsconfig.json");

  try {
    await fs.access(tsconfigPath);

    return "npx tsc --noEmit";
  } catch {}

  return "npm run build";
}

const typeCheckTool: Tool<TypeCheckToolOutput> = {
  definition: {
    name: "typeCheck",

    description: "Run project type checking.",

    category: ToolCategory.EXECUTION,

    capabilities: ["type_checking", "typescript_validation", "static_analysis"],

    sideEffects: [SideEffect.PROCESS_EXECUTION],

    retryable: false,

    timeoutMs: 300_000,

    version: "1.0.0",

    tags: ["execution", "types"],
  },

  execute: async (
    context: ToolExecutionContext,
  ): Promise<ToolResult<TypeCheckToolOutput>> => {
    try {
      const input = context.node.input as TypeCheckToolInput;

      const workspace = context.runtime.workspace || process.cwd();

      const command =
        input?.command || (await detectTypeCheckCommand(workspace));

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
          error: result.error || "Type check failed.",
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
        error: error?.message || "Failed to run type check.",
      };
    }
  },
};

export default typeCheckTool;
