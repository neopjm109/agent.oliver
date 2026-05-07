import z from "zod";
import { Tool } from "../types";
import { chatMessages } from "../../../client/client";
import { zodResponseFormat } from "openai/helpers/zod.js";

const TranslateSchema = z.object({
  translation: z.string(),
  explanation: z.object({
    key_vocabulary: z.array(z.string()),
    grammar_points: z.array(z.string()),
    notes: z.array(z.string()),
  }),
  confidence: z.number(),
});

export type TranslateType = z.infer<z.ZodType<typeof TranslateSchema>>;

export const translateTool: Tool = {
  definition: {
    name: "translate_text",
    description:
      "Translates text into a target language. Can return either a simple translation or a detailed explanation including vocabulary and grammar breakdown.",
    intents: ["generate"],
    tags: ["translation", "language", "nlp", "education"],
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text to translate.",
        },
        target: {
          type: "string",
          description:
            "The target language to translate into (e.g., English, Korean, Japanese, Spanish).",
        },
        mode: {
          type: "string",
          enum: ["simple", "explain"],
          description:
            "'simple' returns only the translated sentence. 'explain' returns translation with detailed explanation.",
        },
        tone: {
          type: "string",
          enum: ["neutral", "formal", "casual"],
          description: "Optional tone/style of the translation.",
        },
      },
      required: ["text", "target"],
    },
  },

  execute: async (args: any) => {
    const { text, target, mode = "simple", tone = "neutral" } = args;

    const systemPrompt = `
You are a professional translator and language teacher.

Your task is to:
1. Accurately translate the given text into the target language.
2. Adapt tone if specified.
3. If explanation mode is enabled, provide clear and educational explanations of vocabulary and grammar.

You must respond ONLY in valid JSON format.
Do not include any extra text outside the JSON.
    `;

    const userPrompt = `
Translate the following text.

[TEXT]
${text}

[TARGET LANGUAGE]
${target}

[OPTIONS]
- mode: ${mode} (simple | explain)
- tone: ${tone} (neutral | formal | casual)

---

Return JSON with the following structure:

- translation: translated sentence

If mode is "explain", also include:

- explanation:
  - key_vocabulary: array of important words with meanings
  - grammar_points: array of key grammar explanations
  - notes: additional helpful notes

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
      zodResponseFormat(TranslateSchema, "translate_schema"),
    );

    return JSON.parse(result.choices[0].message?.content || "");
  },
};
