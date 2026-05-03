import z from "zod";
import { Tool } from "../types";
import { chatMessages } from "../../../client/client";
import { zodResponseFormat } from "openai/helpers/zod.js";

const SummarizeSchema = z.object({
  summary: z.string(),
  key_points: z.array(z.string()),
  important_entities: z.array(z.string()),
  decisions: z.array(z.string()),
  open_questions: z.array(z.string()),
  compressed_context: z.string(),
  compression_ratio: z.number(),
  confidence: z.number(),
});

export type SummarizeType = z.infer<z.ZodType<typeof SummarizeSchema>>;

export const summarizeTool: Tool = {
  definition: {
    name: "summarize_text",
    description:
      "Summarizes long text or accumulated context into a concise and structured format. Optimized for reducing token usage while preserving key information for further reasoning or processing.",
    intents: ["analyze"],
    tags: ["summarization", "context-management", "memory", "optimization"],
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text content to summarize.",
        },
        maxLength: {
          type: "number",
          description:
            "Maximum length of the summary (in tokens or approximate characters). Optional.",
        },
        format: {
          type: "string",
          enum: ["compact", "bullet", "structured"],
          description:
            "Output format of the summary. 'compact' = short paragraph, 'bullet' = key points, 'structured' = categorized summary.",
        },
        focus: {
          type: "string",
          description:
            "Optional focus area (e.g., requirements, decisions, errors). Helps guide summarization.",
        },
      },
      required: ["text"],
    },
  },

  execute: async (args: any) => {
    const { text, maxLength, format = "structured", focus } = args;

    const systemPrompt = `
You are an expert AI system that summarizes long text into a concise and structured format optimized for downstream reasoning.

Your goal is to:
1. Preserve the most important information.
2. Remove redundancy and noise.
3. Keep the summary compact but meaningful.
4. Structure the output for easy reuse in future processing.

You must respond ONLY in valid JSON format.
Do not include any explanations or additional text outside the JSON.
    `;

    const userPrompt = `
Summarize the following text.

[TEXT]
${text}

[OPTIONS]
- max_length: ${maxLength}
- format: ${format} (compact | bullet | structured)
- focus: ${focus}

---

Return JSON with the following fields:

- summary: concise summary of the text

- key_points: array of key points
- important_entities: array of important concepts, objects, or subjects

- decisions: array of decisions mentioned (if any)
- open_questions: array of unresolved questions (if any)

- compressed_context: a compact version of the text optimized for reuse as LLM input

- compression_ratio: number (0.0 ~ 1.0)
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
      zodResponseFormat(SummarizeSchema, "summarize_schema"),
    );

    return result;
  },
};
