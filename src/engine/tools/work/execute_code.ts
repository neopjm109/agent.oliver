import * as z from "zod";
import { execAsync } from "../../utils/utils";
import {
  Tool,
  ToolCategory,
  ToolExecutionContext,
  ToolResult,
  SideEffect,
} from "../types";

export const ExecuteCodeSchema = z.object({
  language: z
    .string()
    .describe("Programming language such as javascript or python"),
  code: z.string().describe("Source code to execute"),
});

export type ExecuteCodeInput = z.infer<typeof ExecuteCodeSchema>;

export interface ExecuteCodeResult {
  language: string;
  output: string;
  error?: string;
  exitCode: number;
  durationMs: number;
}

export const executeCodeName = "executeCodeTool";

function buildCommand(language: string, code: string): string {
  const escaped = code.replace(/"/g, '\\"');
  switch (language.toLowerCase()) {
    case "javascript":
    case "js":
      return `node -e "${escaped}"`;

    case "python":
    case "python3":
    case "py":
      return `python3 -c "${escaped}"`;

    case "typescript":
    case "ts":
      /**
       * tsx 필요
       * npm install tsx
       */
      return `npx tsx -e "${escaped}"`;

    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}

export const executeCodeTool: Tool<ExecuteCodeResult> = {
  definition: {
    name: executeCodeName,
    description:
      "Executes source code in a sandboxed runtime and returns stdout/stderr output.",
    category: ToolCategory.EXECUTION,
    capabilities: [
      "code_execution",
      "runtime_execution",
      "script_evaluation",
      "process_runtime",
    ],
    sideEffects: [SideEffect.PROCESS_EXECUTION],
    retryable: false,
    timeoutMs: 5_000,
    version: "1.0.0",
    tags: ["execution", "runtime", "javascript", "python", "sandbox"],
    inputSchema: {
      type: "object",
      properties: {
        language: {
          type: "string",
          description: "Programming language runtime to use.",
        },
        code: {
          type: "string",
          description: "Source code that will be executed.",
        },
      },
      required: ["language", "code"],
    },
    outputSchema: {
      type: "object",
    },
  },

  async execute(
    context: ToolExecutionContext,
  ): Promise<ToolResult<ExecuteCodeResult>> {
    const startedAt = Date.now();

    try {
      /**
       * ------------------------------------------------------
       * Extract Input
       * ------------------------------------------------------
       */

      const nodeInput = context.node.input || {};
      const language = nodeInput.language;
      const code = nodeInput.code;

      if (!language) {
        return {
          success: false,
          error: "Missing required input: language",
          metadata: {
            tool: executeCodeName,
          },
        };
      }

      if (!code) {
        return {
          success: false,
          error: "Missing required input: code",
          metadata: {
            tool: executeCodeName,
          },
        };
      }

      /**
       * ------------------------------------------------------
       * Build Runtime Command
       * ------------------------------------------------------
       */

      const command = buildCommand(language, code);

      /**
       * ------------------------------------------------------
       * Execute Process
       * ------------------------------------------------------
       */

      const { stdout, stderr } = await execAsync(command, {
        timeout: 5_000,
      });

      const durationMs = Date.now() - startedAt;

      /**
       * ------------------------------------------------------
       * Return Structured Result
       * ------------------------------------------------------
       */

      return {
        success: !stderr,
        data: {
          language,
          output: stdout || "",
          error: stderr || undefined,
          exitCode: stderr ? 1 : 0,
          durationMs,
        },
        metadata: {
          tool: executeCodeName,
          language,
          executionId: context.runtime.executionId,
          durationMs,
          outputLength: stdout?.length || 0,
          errorLength: stderr?.length || 0,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Unknown code execution error",
        metadata: {
          tool: executeCodeName,
          executionId: context.runtime.executionId,
          durationMs: Date.now() - startedAt,
        },
      };
    }
  },
};
