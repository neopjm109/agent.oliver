import { Tool, ToolCategory, ToolExecutionContext, ToolResult } from "../types";

export interface GenerateCodeInput {
  instruction: string;
  language?: string;
  context?: string;
  framework?: string;
  existingCode?: string;
  constraints?: string[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface GenerateCodeOutput {
  code: string;
  language: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

async function generateCode(
  input: GenerateCodeInput,
): Promise<GenerateCodeOutput> {
  /**
   * --------------------------------------------------
   * Implement LLM Provider
   * --------------------------------------------------
   */

  const prompt = [
    `Instruction:\n${input.instruction}`,

    input.language ? `Language: ${input.language}` : "",

    input.framework ? `Framework: ${input.framework}` : "",

    input.constraints && input.constraints.length > 0
      ? `Constraints:\n- ${input.constraints.join("\n- ")}`
      : "",

    input.context ? `Context:\n${input.context}` : "",

    input.existingCode ? `Existing Code:\n${input.existingCode}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  console.log(
    `[generateCode] model=${input.model || "default"} language=${input.language || "unknown"}`,
  );

  console.log(prompt);

  return {
    code: "",
    language: input.language || "plaintext",
  };
}

const generateCodeTool: Tool<GenerateCodeOutput> = {
  definition: {
    name: "generateCode",

    description: "Generate source code using an LLM.",

    category: ToolCategory.LLM,

    capabilities: [
      "code_generation",
      "software_engineering",
      "code_completion",
    ],

    sideEffects: [],

    retryable: true,

    timeoutMs: 180_000,

    version: "1.0.0",

    tags: ["llm", "code"],
  },

  execute: async (
    context: ToolExecutionContext,
  ): Promise<ToolResult<GenerateCodeOutput>> => {
    try {
      const input = context.node.input as GenerateCodeInput;

      if (!input?.instruction) {
        return {
          success: false,
          error: "instruction is required.",
        };
      }

      const result = await generateCode(input);

      return {
        success: true,
        data: result,
        metadata: {
          model: input.model || "default",
          language: result.language,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to generate code.",
      };
    }
  },
};

export default generateCodeTool;
