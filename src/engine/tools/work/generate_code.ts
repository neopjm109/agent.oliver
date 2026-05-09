import z from "zod";
import { zodResponseFormat } from "openai/helpers/zod.js";
import { chatMessages } from "../../client/client";
import {
  Tool,
  ToolCategory,
  ToolExecutionContext,
  ToolResult,
  SideEffect,
} from "../types";

/**
 * ------------------------------------------------------
 * Schema
 * ------------------------------------------------------
 */

export const GenerateCodeSchema = z.object({
  code: z.string(),
  tests: z.string(),
  explanation: z.string(),
  confidence: z.number(),
  error: z.string().optional().nullable(),
});

export type GenerateCodeData = z.infer<
  typeof GenerateCodeSchema
>;

/**
 * ------------------------------------------------------
 * Constants
 * ------------------------------------------------------
 */

export const generateCodeName = "generateCodeTool";

/**
 * ------------------------------------------------------
 * Tool
 * ------------------------------------------------------
 */

export const generateCodeTool: Tool<GenerateCodeData> = {
  definition: {
    name: generateCodeName,
    description:
      "Generates source code from requirements with optional tests and explanations.",
    category: ToolCategory.LLM,
    capabilities: [
      "code_generation",
      "test_generation",
      "software_engineering",
      "code_explanation",
      "multi_language_programming",
    ],
    sideEffects: [SideEffect.NETWORK_CALL],
    retryable: true,
    timeoutMs: 60_000,
    version: "1.0.0",
    tags: [
      "code",
      "generation",
      "development",
      "programming",
      "llm",
    ],

    inputSchema: {
      type: "object",
      properties: {
        requirement: {
          type: "string",
          description:
            "Description of the functionality to implement.",
        },
        language: {
          type: "string",
          description:
            "Programming language such as TypeScript, Java, or Python.",
        },
        style: {
          type: "string",
          enum: [
            "clean",
            "optimized",
            "minimal",
          ],
          description:
            "Preferred coding style.",
        },
        include_tests: {
          type: "boolean",
          description:
            "Whether to generate test code.",
        },
        include_explanation: {
          type: "boolean",
          description:
            "Whether to generate implementation explanations.",
        },
      },
      required: ["requirement", "language"],
    },
    outputSchema: {
      type: "object",
    },
  },

  async execute(
    context: ToolExecutionContext,
  ): Promise<ToolResult<GenerateCodeData>> {
    try {
      /**
       * ------------------------------------------------------
       * Extract Input
       * ------------------------------------------------------
       */

      const nodeInput = context.node.input || {};
      const requirement =
        nodeInput.requirement;
      const language = nodeInput.language;
      const style =
        nodeInput.style || "clean";
      const includeTests =
        nodeInput.include_tests || false;
      const includeExplanation =
        nodeInput.include_explanation ||
        false;

      if (!requirement) {
        return {
          success: false,
          error:
            "Missing required input: requirement",
          metadata: {
            tool: generateCodeName,
          },
        };
      }

      if (!language) {
        return {
          success: false,
          error:
            "Missing required input: language",
          metadata: {
            tool: generateCodeName,
          },
        };
      }

      /**
       * ------------------------------------------------------
       * Style Guides
       * ------------------------------------------------------
       */

      const styleGuideMap: Record<
        string,
        string
      > = {
        clean:
          "Write clean, readable, maintainable, and production-quality code following best practices.",

        optimized:
          "Write optimized and performant code while preserving readability and maintainability.",

        minimal:
          "Write concise code with only essential logic and minimal abstraction.",
      };

      const styleGuide =
        styleGuideMap[style] ||
        styleGuideMap.clean;

      /**
       * ------------------------------------------------------
       * Optional Instructions
       * ------------------------------------------------------
       */

      const testInstruction =
        includeTests
          ? `
Also generate relevant test code.
`
          : "";

      const explanationInstruction =
        includeExplanation
          ? `
Also generate a detailed explanation of the implementation.
`
          : "";

      /**
       * ------------------------------------------------------
       * Prompt
       * ------------------------------------------------------
       */

      const systemPrompt = `
You are a senior software engineer.

Responsibilities:
1. Generate correct and production-ready code.
2. Follow best practices.
3. Use appropriate naming and architecture.
4. Generate tests and explanations if requested.

Return ONLY valid JSON.
      `;

      const userPrompt = `
Generate ${language} code.

[REQUIREMENT]
${requirement}

[STYLE]
${style}

[STYLE GUIDE]
${styleGuide}

${testInstruction}

${explanationInstruction}

---

Return JSON with:

- code
- tests
- explanation
- confidence
- error
      `;

      /**
       * ------------------------------------------------------
       * Execute LLM Request
       * ------------------------------------------------------
       */

      const response = await chatMessages(
        [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        zodResponseFormat(
          GenerateCodeSchema,
          "generate_code_schema",
        ),
      );

      /**
       * ------------------------------------------------------
       * Parse Response
       * ------------------------------------------------------
       */

      const raw =
        response.choices[0]?.message?.content;

      if (!raw) {
        return {
          success: false,
          error: "Empty response from LLM",
          metadata: {
            tool: generateCodeName,
          },
        };
      }

      let parsed: GenerateCodeData;

      try {
        parsed = GenerateCodeSchema.parse(
          JSON.parse(raw),
        );
      } catch {
        parsed = {
          code: raw,
          tests: "",
          explanation: "",
          confidence: 0,
          error: "Schema parsing failed",
        };
      }

      /**
       * ------------------------------------------------------
       * Return Structured Result
       * ------------------------------------------------------
       */

      return {
        success: true,
        data: {
          code: parsed.code || "",
          tests: includeTests
            ? parsed.tests || ""
            : "",
          explanation:
            includeExplanation
              ? parsed.explanation || ""
              : "",
          confidence:
            parsed.confidence || 0,
          error: parsed.error,
        },
        metadata: {
          tool: generateCodeName,
          model: response.model,
          language,
          style,
          includeTests,
          includeExplanation,
          codeLength:
            parsed.code?.length || 0,
          testLength:
            parsed.tests?.length || 0,
          confidence:
            parsed.confidence,
          executionId:
            context.runtime.executionId,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error:
          error?.message ||
          "Unknown code generation error",
        metadata: {
          tool: generateCodeName,
          executionId:
            context.runtime.executionId,
        },
      };
    }
  },
};