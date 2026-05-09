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

export const VerifySchema = z.object({
  is_valid: z.boolean(),
  score: z.number(),
  issues: z.array(z.string()),
  suggestions: z.array(z.string()),
  improved_output: z.string(),
  confidence: z.number(),
  error: z.string().optional().nullable(),
});

export type VerifyData = z.infer<typeof VerifySchema>;

/**
 * ------------------------------------------------------
 * Constants
 * ------------------------------------------------------
 */

export const verifyOutputToolName = "verifyOutputTool";

/**
 * ------------------------------------------------------
 * Verify Output Tool
 * ------------------------------------------------------
 */

export const verifyOutputTool: Tool<VerifyData> = {
  definition: {
    name: verifyOutputToolName,
    description:
      "Evaluates whether generated output is valid, complete, consistent, and aligned with user requirements.",
    category: ToolCategory.ANALYSIS,
    capabilities: [
      "validation",
      "quality_assurance",
      "consistency_check",
      "output_evaluation",
      "improvement_suggestion",
    ],
    sideEffects: [SideEffect.NETWORK_CALL],
    retryable: true,
    timeoutMs: 30_000,
    version: "1.0.0",
    tags: [
      "verification",
      "validation",
      "quality",
      "evaluation",
      "reasoning",
    ],
    inputSchema: {
      type: "object",
      properties: {
        input: {
          type: "string",
          description:
            "Original user request, requirement, or expected objective.",
        },
        output: {
          type: "string",
          description: "Generated output to verify.",
        },
        criteria: {
          type: "array",
          items: {
            type: "string",
          },
          description:
            "Optional custom evaluation criteria for validation.",
        },
      },
      required: ["output"],
    },
    outputSchema: {
      type: "object",
    },
  },

  async execute(
    context: ToolExecutionContext,
  ): Promise<ToolResult<VerifyData>> {
    try {
      /**
       * ------------------------------------------------------
       * Extract Input
       * ------------------------------------------------------
       */

      const nodeInput = context.node.input || {};
      const input = nodeInput.input || "";
      const output = nodeInput.output;
      const criteria = nodeInput.criteria || [];

      if (!output) {
        return {
          success: false,
          error: "Missing required input: output",
          metadata: {
            tool: "verify_output",
          },
        };
      }

      /**
       * ------------------------------------------------------
       * Build Criteria
       * ------------------------------------------------------
       */

      const criteriaText =
        criteria.length > 0
          ? `
Evaluation Criteria:
- ${criteria.join("\n- ")}
`
          : `
Evaluate:
- correctness
- completeness
- consistency
- clarity
- reliability
`;

      /**
       * ------------------------------------------------------
       * Prompt
       * ------------------------------------------------------
       */

      const systemPrompt = `
You are a strict and highly precise evaluator.

Responsibilities:
1. Verify correctness and consistency.
2. Detect issues or weaknesses.
3. Suggest improvements.
4. Improve output quality if necessary.

Return ONLY valid JSON.
      `;

      const userPrompt = `
Verify the following output.

[INPUT]
${input}

[OUTPUT]
${output}

${criteriaText}

---

Return JSON with:

- is_valid
- score
- issues
- suggestions
- improved_output
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
        zodResponseFormat(VerifySchema, "verify_schema"),
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
            tool: "verify_output",
          },
        };
      }

      let parsed: VerifyData;

      try {
        parsed = VerifySchema.parse(JSON.parse(raw));
      } catch {
        parsed = {
          is_valid: false,
          score: 0,
          issues: ["Invalid JSON response"],
          suggestions: [],
          improved_output: output,
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
        data: parsed,
        metadata: {
          tool: "verify_output",
          model: response.model,
          score: parsed.score,
          valid: parsed.is_valid,
          confidence: parsed.confidence,
          issueCount: parsed.issues.length,
          executionId: context.runtime.executionId,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Unknown verification error",
        metadata: {
          tool: "verify_output",
          executionId: context.runtime.executionId,
        },
      };
    }
  },
};