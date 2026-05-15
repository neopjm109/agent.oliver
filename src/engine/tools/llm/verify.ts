import { Tool, ToolCategory, ToolExecutionContext, ToolResult } from "../types";

export interface VerifyInput {
  instruction: string;
  content: string;
  criteria?: string[];
  context?: string;
  model?: string;
}

export interface VerifyIssue {
  message: string;
  severity: "low" | "medium" | "high";
  suggestion?: string;
}

export interface VerifyOutput {
  valid: boolean;
  score: number;
  issues: VerifyIssue[];
  feedback: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

async function verifyContent(input: VerifyInput): Promise<VerifyOutput> {
  /**
   * --------------------------------------------------
   * Implement LLM Provider
   * --------------------------------------------------
   */

  const prompt = [
    `Instruction:\n${input.instruction}`,

    input.criteria && input.criteria.length > 0
      ? `Criteria:\n- ${input.criteria.join("\n- ")}`
      : "",

    input.context ? `Context:\n${input.context}` : "",

    `Content:\n${input.content}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  console.log(`[verify] model=${input.model || "default"}`);

  console.log(prompt);

  return {
    valid: false,
    score: 0,
    issues: [],
    feedback: "",
  };
}

const verifyTool: Tool<VerifyOutput> = {
  definition: {
    name: "verify",

    description: "Verify generated content against requirements.",

    category: ToolCategory.LLM,

    capabilities: ["verification", "quality_check", "requirement_validation"],

    sideEffects: [],

    retryable: true,

    timeoutMs: 120_000,

    version: "1.0.0",

    tags: ["llm", "verification"],
  },

  execute: async (
    context: ToolExecutionContext,
  ): Promise<ToolResult<VerifyOutput>> => {
    try {
      const input = context.node.input as VerifyInput;

      if (!input?.instruction) {
        return {
          success: false,
          error: "instruction is required.",
        };
      }

      if (!input.content) {
        return {
          success: false,
          error: "content is required.",
        };
      }

      const result = await verifyContent(input);

      return {
        success: true,
        data: result,
        metadata: {
          model: input.model || "default",
          valid: result.valid,
          score: result.score,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to verify content.",
      };
    }
  },
};

export default verifyTool;
