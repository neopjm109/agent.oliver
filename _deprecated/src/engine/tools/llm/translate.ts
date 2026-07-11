import { Tool, ToolCategory, ToolExecutionContext, ToolResult } from "../types";

export interface TranslateInput {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
  preserveFormatting?: boolean;
  temperature?: number;
  model?: string;
}

export interface TranslateOutput {
  translatedText: string;
  sourceLanguage?: string;
  targetLanguage: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

async function translateText(input: TranslateInput): Promise<TranslateOutput> {
  /**
   * --------------------------------------------------
   * Implement LLM Provider
   * --------------------------------------------------
   */

  const prompt = [
    input.sourceLanguage ? `Source Language: ${input.sourceLanguage}` : "",

    `Target Language: ${input.targetLanguage}`,

    `Preserve Formatting: ${input.preserveFormatting !== false}`,

    `Text:\n${input.text}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  console.log(
    `[translate] model=${input.model || "default"} target=${input.targetLanguage}`,
  );

  console.log(prompt);

  return {
    translatedText: "",
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
  };
}

const translateTool: Tool<TranslateOutput> = {
  definition: {
    name: "translate",

    description: "Translate text into another language.",

    category: ToolCategory.LLM,

    capabilities: [
      "translation",
      "multilingual_generation",
      "language_conversion",
    ],

    sideEffects: [],

    retryable: true,

    timeoutMs: 120_000,

    version: "1.0.0",

    tags: ["llm", "translation"],
  },

  execute: async (
    context: ToolExecutionContext,
  ): Promise<ToolResult<TranslateOutput>> => {
    try {
      const input = context.node.input as TranslateInput;

      if (!input?.text) {
        return {
          success: false,
          error: "text is required.",
        };
      }

      if (!input.targetLanguage) {
        return {
          success: false,
          error: "targetLanguage is required.",
        };
      }

      const result = await translateText(input);

      return {
        success: true,
        data: result,
        metadata: {
          model: input.model || "default",
          targetLanguage: result.targetLanguage,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to translate text.",
      };
    }
  },
};

export default translateTool;
