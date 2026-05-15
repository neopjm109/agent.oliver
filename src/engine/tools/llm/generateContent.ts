import { Tool, ToolCategory, ToolExecutionContext, ToolResult } from "../types";

export interface GenerateContentInput {
  instruction: string;
  context?: string;
  format?: "text" | "markdown" | "html" | "json";
  tone?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface GenerateContentOutput {
  content: string;
  format: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

async function generateContent(
  input: GenerateContentInput,
): Promise<GenerateContentOutput> {
  /**
   * --------------------------------------------------
   * Implement LLM Provider
   * --------------------------------------------------
   */

  const prompt = [
    input.context ? `Context:\n${input.context}` : "",
    `Instruction:\n${input.instruction}`,
    input.tone ? `Tone: ${input.tone}` : "",
    `Format: ${input.format || "text"}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  console.log(`[generateContent] model=${input.model || "default"}`);

  return {
    content: "",
    format: input.format || "text",
  };
}

const generateContentTool: Tool<GenerateContentOutput> = {
  definition: {
    name: "generateContent",

    description: "Generate structured content using an LLM.",

    category: ToolCategory.LLM,

    capabilities: [
      "content_generation",
      "structured_writing",
      "creative_generation",
    ],

    sideEffects: [],

    retryable: true,

    timeoutMs: 120_000,

    version: "1.0.0",

    tags: ["llm", "content"],
  },

  execute: async (
    context: ToolExecutionContext,
  ): Promise<ToolResult<GenerateContentOutput>> => {
    try {
      const input = context.node.input as GenerateContentInput;

      if (!input?.instruction) {
        return {
          success: false,
          error: "instruction is required.",
        };
      }

      const result = await generateContent(input);

      return {
        success: true,
        data: result,
        metadata: {
          model: input.model || "default",
          format: result.format,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to generate content.",
      };
    }
  },
};

export default generateContentTool;
