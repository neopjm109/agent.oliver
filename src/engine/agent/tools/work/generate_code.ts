import z from "zod";
import { chatMessages } from "../../../client/client";
import { Tool } from "../types";
import { zodResponseFormat } from "openai/helpers/zod.js";

const GenerateCodeSchema = z.object({
  code: z.string(),
  tests: z.string(),
  explanation: z.string(),
  confidence: z.number(),
  error: z.string().optional().nullable(),
});

export type GenerateCodeType = z.infer<z.ZodType<typeof GenerateCodeSchema>>;

export const generateCodeTool: Tool = {
  definition: {
    name: "generate_code",
    description:
      "Generates code based on a given requirement with optional style and explanation.",

    intents: ["generate"],

    tags: ["code", "development", "programming"],

    parameters: {
      type: "object",
      properties: {
        requirement: {
          type: "string",
          description: "Description of what the code should do.",
        },
        language: {
          type: "string",
          description: "Programming language (e.g., TypeScript, Python).",
        },
        style: {
          type: "string",
          enum: ["clean", "optimized", "minimal"],
        },
        include_tests: {
          type: "boolean",
          description: "Whether to include test code.",
        },
        include_explanation: {
          type: "boolean",
          description: "Whether to include explanation.",
        },
      },
      required: ["requirement", "language"],
    },
  },

  execute: async (args: any) => {
    const {
      requirement,
      language,
      style = "clean",
      include_tests = false,
      include_explanation = false,
    } = args;

    // 🔹 1. 스타일 가이드
    const styleGuideMap: Record<string, string> = {
      clean:
        "Write clean, readable, and well-structured code following best practices.",
      optimized:
        "Write optimized and efficient code with performance considerations.",
      minimal: "Write minimal code with only essential logic.",
    };

    const styleGuide = styleGuideMap[style] || styleGuideMap.clean;

    // 🔹 2. 테스트 요구사항
    const testInstruction = include_tests ? `Also include test code.` : "";

    // 🔹 3. 설명 요구사항
    const explanationInstruction = include_explanation
      ? `Also include a clear explanation of the code.`
      : "";

    // 🔹 4. Prompt 구성
    const prompt = `
You are a senior software engineer.

Task:
Generate ${language} code.

Requirement:
${requirement}

Instructions:
- ${styleGuide}
- Ensure the code is correct and runnable.
- Use appropriate naming and structure.
${testInstruction}
${explanationInstruction}
`;

    try {
      const response = await chatMessages(
        [
          {
            role: "system",
            content:
              "You are a highly skilled software engineer. Always respond in valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        zodResponseFormat(GenerateCodeSchema, "generate_code_schema"),
      );

      const text = response.choices[0]?.message?.content || "{}";

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = {
          code: text,
          tests: "",
          explanation: "",
        };
      }

      return {
        code: parsed.code || "",
        tests: include_tests ? parsed.tests || "" : "",
        explanation: include_explanation ? parsed.explanation || "" : "",
        confidence: 0.9,
      };
    } catch (error: any) {
      return {
        code: "",
        tests: "",
        explanation: "",
        confidence: 0,
        error: error.message,
      };
    }
  },
};
