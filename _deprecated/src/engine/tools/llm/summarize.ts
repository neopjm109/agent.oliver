import { Tool, ToolCategory, ToolExecutionContext, ToolResult } from "../types";

export interface SummarizeInput {
  content: string;
  format?: "text" | "bullet" | "markdown";
  maxLength?: number;
  focus?: string;
  temperature?: number;
  model?: string;
}

export interface SummarizeOutput {
  summary: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

async function summarizeContent(
  input: SummarizeInput,
): Promise<SummarizeOutput> {
  /**
   * --------------------------------------------------
   * Implement LLM Provider
   * --------------------------------------------------
   */

  const prompt = [
    `Format: ${input.format || "text"}`,

    input.maxLength ? `Max Length: ${input.maxLength}` : "",

    input.focus ? `Focus: ${input.focus}` : "",

    `Content:\n${input.content}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  console.log(`[summarize] model=${input.model || "default"}`);

  console.log(prompt);

  return {
    summary: "",
  };
}

const summarizeTool: Tool<SummarizeOutput> = {
  definition: {
    name: "summarize",

    description: "Summarize long-form content using an LLM.",

    category: ToolCategory.LLM,

    capabilities: [
      "summarization",
      "content_compression",
      "information_extraction",
    ],

    sideEffects: [],

    retryable: true,

    timeoutMs: 120_000,

    version: "1.0.0",

    tags: ["llm", "summary"],
  },

  execute: async (
    context: ToolExecutionContext,
  ): Promise<ToolResult<SummarizeOutput>> => {
    try {
      const input = context.node.input as SummarizeInput;

      if (!input?.content) {
        return {
          success: false,
          error: "content is required.",
        };
      }

      const result = await summarizeContent(input);

      return {
        success: true,
        data: result,
        metadata: {
          model: input.model || "default",
          format: input.format || "text",
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to summarize content.",
      };
    }
  },
};

export default summarizeTool;
