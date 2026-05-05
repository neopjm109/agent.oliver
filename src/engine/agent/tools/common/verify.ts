import { zodResponseFormat } from "openai/helpers/zod.js";
import { chatMessages } from "../../../client/client";
import { Tool } from "../types";
import z from "zod";

const VerifySchema = z.object({
  is_valid: z.boolean(),
  score: z.number(),
  issues: z.array(z.string()),
  suggestions: z.array(z.string()),
  improved_output: z.string(),
  confidence: z.number(),
  error: z.string().optional().nullable(),
});

export type VerifyType = z.infer<z.ZodType<typeof VerifySchema>>;

export const verifyOutputTool: Tool = {
  definition: {
    name: "verify_output",
    description:
      "Evaluates whether a given output meets requirements, is correct, consistent, and reliable.",

    intents: ["verify"],

    tags: ["verification", "quality", "validation"],

    parameters: {
      type: "object",
      properties: {
        input: {
          type: "string",
          description: "Original user request or requirement.",
        },
        output: {
          type: "string",
          description: "Generated result to verify.",
        },
        criteria: {
          type: "array",
          items: { type: "string" },
          description: "Optional evaluation criteria.",
        },
      },
      required: ["output"],
    },
  },

  execute: async (args: any) => {
    const { input = "", output, criteria = [] } = args;

    const criteriaText =
      criteria.length > 0
        ? `Evaluation Criteria:\n- ${criteria.join("\n- ")}`
        : "Evaluate correctness, completeness, and consistency.";

    const prompt = `
You are a strict evaluator.

Task:
Verify the given output.

Input (optional):
${input}

Output to evaluate:
${output}

${criteriaText}

---

Return ONLY valid JSON:

{
  "is_valid": boolean,
  "score": number,
  "issues": ["string"],
  "suggestions": ["string"],
  "improved_output": "string"
}
`;

    try {
      const response = await chatMessages(
        [
          {
            role: "system",
            content:
              "You are a strict and precise evaluator. Always respond in valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        zodResponseFormat(VerifySchema, "verify_schema"),
      );

      const raw = response.choices[0]?.message?.content || "{}";

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = {
          is_valid: false,
          score: 0,
          issues: ["Invalid JSON response"],
          suggestions: [],
          improved_output: output,
        };
      }

      return {
        is_valid: parsed.is_valid ?? false,
        score: parsed.score ?? 0,
        issues: parsed.issues ?? [],
        suggestions: parsed.suggestions ?? [],
        improved_output: parsed.improved_output ?? output,
        confidence: 0.9,
      };
    } catch (error: any) {
      return {
        is_valid: false,
        score: 0,
        issues: [error.message],
        suggestions: [],
        improved_output: output,
        confidence: 0,
      };
    }
  },
};
