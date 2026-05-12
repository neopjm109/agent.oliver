import * as z from "zod";

import vm from "node:vm";

import { Tool, ToolCategory, ToolExecutionContext, ToolResult } from "../types";

export const CalculateSchema = z.object({
  expression: z.string().describe("Mathematical expression to evaluate"),

  precision: z
    .number()
    .min(0)
    .max(15)
    .optional()
    .describe("Optional decimal precision for the result"),
});

export type CalculateInput = z.infer<typeof CalculateSchema>;

export interface CalculateResult {
  expression: string;

  result: number;

  formatted: string;

  precision?: number;

  durationMs: number;
}

export const calculateToolName = "calculateTool";

const SAFE_MATH_CONTEXT = {
  Math,

  abs: Math.abs,
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round,

  min: Math.min,
  max: Math.max,

  sqrt: Math.sqrt,
  pow: Math.pow,

  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,

  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,

  log: Math.log,
  log10: Math.log10,

  exp: Math.exp,

  PI: Math.PI,
  E: Math.E,
};

function validateExpression(expression: string) {
  /**
   * Allow:
   * - numbers
   * - operators
   * - parentheses
   * - decimals
   * - commas
   * - spaces
   * - letters for safe math funcs
   */

  const allowed = /^[0-9+\-*/%().,\s_a-zA-Z]+$/;

  if (!allowed.test(expression)) {
    throw new Error("Expression contains unsupported characters");
  }

  const blockedKeywords = [
    "process",
    "global",
    "require",
    "import",
    "eval",
    "Function",
    "while",
    "for",
    "this",
    "constructor",
  ];

  const lower = expression.toLowerCase();

  for (const keyword of blockedKeywords) {
    if (lower.includes(keyword.toLowerCase())) {
      throw new Error(`Blocked keyword detected: ${keyword}`);
    }
  }
}

function evaluateExpression(expression: string): number {
  validateExpression(expression);

  const context = vm.createContext(SAFE_MATH_CONTEXT);

  const script = new vm.Script(expression);

  const result = script.runInContext(context, {
    timeout: 1000,
  });

  if (typeof result !== "number") {
    throw new Error("Expression did not evaluate to a number");
  }

  if (!Number.isFinite(result)) {
    throw new Error("Result is not a finite number");
  }

  return result;
}

const calculateTool: Tool<CalculateResult> = {
  definition: {
    name: calculateToolName,
    description:
      "Safely evaluates mathematical expressions and returns numeric results.",
    category: ToolCategory.EXECUTION,
    capabilities: [
      "math_evaluation",
      "arithmetic",
      "scientific_calculation",
      "expression_parsing",
    ],
    retryable: true,
    timeoutMs: 3_000,
    version: "1.0.0",
    tags: ["math", "calculation", "compute", "scientific", "expression"],
    inputSchema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "Mathematical expression to evaluate.",
        },
        precision: {
          type: "number",
          description: "Optional decimal precision.",
        },
      },
      required: ["expression"],
    },
    outputSchema: {
      type: "object",
    },
  },

  async execute(
    context: ToolExecutionContext,
  ): Promise<ToolResult<CalculateResult>> {
    const startedAt = Date.now();

    try {
      const nodeInput = context.node.input || {};
      const expression = nodeInput.expression;
      const precision = nodeInput.precision;

      if (!expression) {
        return {
          success: false,
          error: "Missing required input: expression",
          metadata: {
            tool: calculateToolName,
          },
        };
      }

      let result = evaluateExpression(expression);
      let formatted = result.toString();

      if (precision !== undefined && Number.isInteger(precision)) {
        result = Number(result.toFixed(precision));
        formatted = result.toFixed(precision);
      }

      return {
        success: true,
        data: {
          expression,
          result,
          formatted,
          precision,
          durationMs: Date.now() - startedAt,
        },
        metadata: {
          tool: calculateToolName,
          executionId: context.runtime.executionId,
          durationMs: Date.now() - startedAt,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Unknown calculation error",
        metadata: {
          tool: calculateToolName,
          executionId: context.runtime.executionId,
          durationMs: Date.now() - startedAt,
        },
      };
    }
  },
};

export default calculateTool;
