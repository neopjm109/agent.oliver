import { zodResponseFormat } from "openai/helpers/zod.js";
import z from "zod";
import {
  Tool,
  ToolCategory,
  ToolExecutionContext,
  ToolResult,
  SideEffect,
} from "../types";
import { IntentSchema } from "../../core/types";
import { chatMessages } from "../../client/client";

/**
 * ------------------------------------------------------
 * Schema
 * ------------------------------------------------------
 */

export const AnalyzeSchema = z.object({
  intent: IntentSchema,
  next_intent: z.string(),
  summary: z.string(),
  requirements: z.array(z.string()),
  constraints: z.array(z.string()),
  assumptions: z.array(z.string()),
  risks: z.array(z.string()),
  ambiguities: z.array(z.string()),
  routing: z.object({
    is_simple_query: z.boolean(),
    should_search: z.boolean(),
    should_compute: z.boolean(),
    should_verify: z.boolean(),
    confidence: z.number(),
  }),

  suggested_actions: z.array(z.string()),

  confidence: z.number(),
});

export type AnalyzeData = z.infer<typeof AnalyzeSchema>;

/**
 * ------------------------------------------------------
 * Constants
 * ------------------------------------------------------
 */

export const analyzeToolName = "analyzeTool";

/**
 * ------------------------------------------------------
 * Analyze Tool
 * ------------------------------------------------------
 */

export const analyzeTool: Tool<AnalyzeData> = {
  definition: {
    name: analyzeToolName,
    description:
      "Analyzes user input and extracts structured reasoning insights for graph orchestration.",
    category: ToolCategory.ANALYSIS,
    capabilities: [
      "intent_detection",
      "requirement_extraction",
      "risk_analysis",
      "routing",
    ],

    sideEffects: [SideEffect.NETWORK_CALL],
    retryable: true,
    timeoutMs: 30_000,
    version: "1.0.0",
    tags: ["analysis", "reasoning", "routing", "core"],

    inputSchema: {
      type: "object",
      properties: {
        input: {
          type: "string",
        },
        context: {
          type: "object",
          additionalProperties: true,
        },
      },
      required: ["input"],
    },

    outputSchema: {
      type: "object",
    },
  },

  async execute(
    context: ToolExecutionContext,
  ): Promise<ToolResult<AnalyzeData>> {
    try {
      /**
       * ------------------------------------------------------
       * Extract Node Input
       * ------------------------------------------------------
       */

      const nodeInput = context.node.input || {};
      const input = nodeInput.input;
      const previousContext =
        nodeInput.context ||
        context.memory?.shortTerm ||
        context.memory?.retrieved;

      /**
       * ------------------------------------------------------
       * Prompt
       * ------------------------------------------------------
       */

      const systemPrompt = `
You are an expert AI system that analyzes user input and extracts structured insights for downstream graph orchestration.

Your responsibilities:
1. Understand the user's true intent.
2. Extract requirements, constraints, assumptions.
3. Identify risks and ambiguities.
4. Determine the most appropriate next action.

Return ONLY valid JSON.
      `;

      const userPrompt = `
Analyze the following input.

[INPUT]
${input}

[CONTEXT]
${JSON.stringify(previousContext, null, 2)}

---

Return JSON with:

- intent
- next_intent
- summary
- requirements
- constraints
- assumptions
- risks
- ambiguities
- routing
- suggested_actions
- confidence
      `;

      /**
       * ------------------------------------------------------
       * LLM Call
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

        zodResponseFormat(AnalyzeSchema, "analyze_schema"),
      );

      /**
       * ------------------------------------------------------
       * Parse Result
       * ------------------------------------------------------
       */

      const raw = response.choices[0]?.message?.content;

      if (!raw) {
        return {
          success: false,
          error: "Empty response from LLM",
          metadata: {
            tool: "analyze",
          },
        };
      }

      const parsed = AnalyzeSchema.parse(JSON.parse(raw));

      /**
       * ------------------------------------------------------
       * Return Structured Result
       * ------------------------------------------------------
       */

      return {
        success: true,
        data: parsed,
        metadata: {
          tool: "analyze",
          model: response.model,
          confidence: parsed.confidence,
          nextIntent: parsed.next_intent,
          executionId: context.runtime.executionId,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Unknown analyze error",
        metadata: {
          tool: "analyze",
          executionId: context.runtime.executionId,
        },
      };
    }
  },
};