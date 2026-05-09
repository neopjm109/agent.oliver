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

export const TranslateSchema = z.object({
  translation: z.string(),
  explanation: z.object({
    key_vocabulary: z.array(z.string()),
    grammar_points: z.array(z.string()),
    notes: z.array(z.string()),
  }),
  confidence: z.number(),
});

export type TranslateData = z.infer<typeof TranslateSchema>;

/**
 * ------------------------------------------------------
 * Constants
 * ------------------------------------------------------
 */

export const translateToolName = "translateTool";

/**
 * ------------------------------------------------------
 * Translate Tool
 * ------------------------------------------------------
 */

export const translateTool: Tool<TranslateData> = {
  definition: {
    name: translateToolName,
    description:
      "Translates text into a target language and optionally provides educational explanations including vocabulary and grammar analysis.",
    category: ToolCategory.LLM,
    capabilities: [
      "translation",
      "language_generation",
      "grammar_analysis",
      "vocabulary_extraction",
      "multilingual_processing",
    ],
    sideEffects: [SideEffect.NETWORK_CALL],
    retryable: true,
    timeoutMs: 30_000,
    version: "1.0.0",
    tags: [
      "translation",
      "language",
      "education",
      "multilingual",
      "nlp",
    ],
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The source text to translate.",
        },
        target: {
          type: "string",
          description:
            "Target language such as English, Korean, Japanese, or Spanish.",
        },
        mode: {
          type: "string",
          enum: ["simple", "explain"],
          description:
            "'simple' returns only translation, 'explain' includes vocabulary and grammar explanations.",
        },
        tone: {
          type: "string",
          enum: ["neutral", "formal", "casual"],
          description: "Desired translation tone.",
        },
      },
      required: ["text", "target"],
    },
    outputSchema: {
      type: "object",
    },
  },

  async execute(
    context: ToolExecutionContext,
  ): Promise<ToolResult<TranslateData>> {
    try {
      /**
       * ------------------------------------------------------
       * Extract Input
       * ------------------------------------------------------
       */

      const nodeInput = context.node.input || {};
      const text = nodeInput.text;
      const target = nodeInput.target;
      const mode = nodeInput.mode || "simple";
      const tone = nodeInput.tone || "neutral";

      if (!text) {
        return {
          success: false,
          error: "Missing required input: text",
          metadata: {
            tool: "translate",
          },
        };
      }

      if (!target) {
        return {
          success: false,
          error: "Missing required input: target",
          metadata: {
            tool: "translate",
          },
        };
      }

      /**
       * ------------------------------------------------------
       * Prompt
       * ------------------------------------------------------
       */

      const systemPrompt = `
You are a professional translator and language teacher.

Responsibilities:
1. Translate accurately into the target language.
2. Preserve meaning and tone.
3. Adapt style if tone is specified.
4. If explanation mode is enabled, explain vocabulary and grammar clearly.

Return ONLY valid JSON.
      `;

      const userPrompt = `
Translate the following text.

[TEXT]
${text}

[TARGET LANGUAGE]
${target}

[OPTIONS]
- mode: ${mode}
- tone: ${tone}

---

Return JSON with:

- translation

If mode is "explain", also include:
- explanation
  - key_vocabulary
  - grammar_points
  - notes

- confidence
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
        zodResponseFormat(TranslateSchema, "translate_schema"),
      );

      /**
       * ------------------------------------------------------
       * Parse Response
       * ------------------------------------------------------
       */

      const raw = response.choices[0]?.message?.content;

      if (!raw) {
        return {
          success: false,
          error: "Empty response from LLM",
          metadata: {
            tool: "translate",
          },
        };
      }

      const parsed = TranslateSchema.parse(JSON.parse(raw));

      /**
       * ------------------------------------------------------
       * Return Structured Result
       * ------------------------------------------------------
       */

      return {
        success: true,
        data: parsed,
        metadata: {
          tool: "translate",
          model: response.model,
          mode,
          tone,
          targetLanguage: target,
          confidence: parsed.confidence,
          executionId: context.runtime.executionId,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Unknown translation error",
        metadata: {
          tool: "translate",
          executionId: context.runtime.executionId,
        },
      };
    }
  },
};