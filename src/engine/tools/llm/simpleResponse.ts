import { Tool, ToolCategory, ToolExecutionContext, ToolResult } from "../types";

export interface SimpleResponseInput {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface SimpleResponseOutput {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

async function generateResponse(
  input: SimpleResponseInput,
): Promise<SimpleResponseOutput> {
  /**
   * --------------------------------------------------
   * Implement LLM Provider
   * --------------------------------------------------
   *
   * Examples:
   * - OpenAI
   * - Anthropic
   * - Gemini
   * - Ollama
   * - Local Model
   */

  console.log(`[simpleResponse] model=${input.model || "default"}`);

  return {
    content: "",
  };
}

const simpleResponseTool: Tool<SimpleResponseOutput> = {
  definition: {
    name: "simpleResponse",

    description: "Generate a simple LLM response from a prompt.",

    category: ToolCategory.LLM,

    capabilities: ["text_generation", "question_answering", "reasoning"],

    sideEffects: [],

    retryable: true,

    timeoutMs: 120_000,

    version: "1.0.0",

    tags: ["llm", "generation"],
  },

  execute: async (
    context: ToolExecutionContext,
  ): Promise<ToolResult<SimpleResponseOutput>> => {
    try {
      const input = context.node.input as SimpleResponseInput;

      if (!input?.prompt) {
        return {
          success: false,
          error: "prompt is required.",
        };
      }

      const result = await generateResponse(input);

      return {
        success: true,
        data: result,
        metadata: {
          model: input.model || "default",
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to generate response.",
      };
    }
  },
};

export default simpleResponseTool;
