import { zodResponseFormat } from "openai/helpers/zod.js";
import z from "zod";
import { chatMessages } from "../../../client/client";
import { IntentSchema } from "../../types";
import { Tool } from "../types";

const AnalyzeSchema = z.object({
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

export type AnalyzeType = z.infer<z.ZodType<typeof AnalyzeSchema>>;

export const analyzeTool: Tool = {
  definition: {
    name: "analyze_input",
    description:
      "Analyzes user input and determines the most appropriate next action (intent). Extracts structured insights including user intent, requirements, constraints, risks, and ambiguities. This tool is used as the first step in the reasoning pipeline.",
    intents: ["analyze"],
    tags: ["analysis", "reasoning", "routing", "core"],
    parameters: {
      type: "object",
      properties: {
        input: {
          type: "string",
          description: "The original input text provided by the user.",
        },
        context: {
          type: "object",
          description:
            "Accumulated context from previous steps (optional). Used to refine analysis and maintain continuity.",
          additionalProperties: true,
        },
      },
      required: ["input"],
    },
  },

  execute: async (args: any) => {
    const { input, context } = args;

    const systemPrompt = `
You are an expert AI system that analyzes user input and extracts structured insights for downstream processing.

Your task is to:
1. Understand the user's true intent.
2. Extract key requirements, constraints, and assumptions.
3. Identify risks and ambiguities.
4. Determine the most appropriate next action (next_intent).

You must respond ONLY in valid JSON format.
Do not include any explanations or additional text outside the JSON.
    `;

    const userPrompt = `
Analyze the following user input and return structured insights.

[INPUT]
${input}

[CONTEXT] (optional)
${context}

---

Return JSON with the following fields:

- intent: one of ["search", "analyze", "compute", "generate", "execute", "verify", "finish"]
- next_intent: one of ["search", "analyze", "compute", "generate", "execute", "verify", "finish"]

- summary: short and concise summary

- requirements: array of explicit user requirements
- constraints: array of limitations or conditions
- assumptions: array of inferred assumptions

- risks: array of potential risks or failure points
- ambiguities: array of unclear or underspecified parts

- routing:
  - is_simple_query: boolean
  - should_search: boolean
  - should_compute: boolean
  - should_verify: boolean
  - confidence: number (0.0 ~ 1.0)

- suggested_actions: array of recommended next steps

- confidence: number (0.0 ~ 1.0)
    `;

    const result = await chatMessages(
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

    return JSON.parse(result.choices[0].message?.content || "");
  },
};
