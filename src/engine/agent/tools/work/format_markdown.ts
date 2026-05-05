import z from "zod";
import { chatMessages } from "../../../client/client";
import { Tool } from "../types";
import { zodResponseFormat } from "openai/helpers/zod.js";

const FormatMarkdownSchema = z.object({
  markdown: z.string(),
  sections: z.array(z.string()),
  confidence: z.number(),
  error: z.string().optional(),
});

export type FormatMarkdownType = z.infer<
  z.ZodType<typeof FormatMarkdownSchema>
>;

export const formatMarkdownTool: Tool = {
  definition: {
    name: "format_markdown",
    description:
      "Formats raw text into clean, structured, and readable Markdown.",

    intents: ["generate"],

    tags: ["markdown", "formatting", "documentation"],

    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Raw text to format.",
        },
        style: {
          type: "string",
          enum: ["simple", "detailed", "documentation"],
        },
        include_toc: {
          type: "boolean",
          description: "Whether to include a table of contents.",
        },
      },
      required: ["text"],
    },
  },

  execute: async (args: any) => {
    const { text, style = "simple", include_toc = false } = args;

    // 🔹 1. 스타일 가이드
    const styleGuideMap: Record<string, string> = {
      simple:
        "Use minimal Markdown formatting. Keep it clean and easy to read.",
      detailed:
        "Use rich Markdown formatting including headings, lists, emphasis, and code blocks where appropriate.",
      documentation:
        "Format as professional documentation with clear sections, headings, code blocks, and structured layout.",
    };

    const styleGuide = styleGuideMap[style] || styleGuideMap.simple;

    // 🔹 2. TOC 옵션
    const tocInstruction = include_toc
      ? "Include a table of contents at the top."
      : "";

    // 🔹 3. Prompt 구성
    const prompt = `
You are a Markdown formatting expert.

Task:
Transform the given text into well-structured Markdown.

Instructions:
- ${styleGuide}
- Improve readability and structure.
- Use headings (#, ##, ###) appropriately.
- Format lists, paragraphs, and sections clearly.
- Use code blocks if needed.
- Do not change the original meaning.

${tocInstruction}

---

[TEXT]
${text}
`;

    try {
      const response = await chatMessages(
        [
          {
            role: "system",
            content:
              "You are an expert in formatting text into Markdown. Always respond in valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        zodResponseFormat(FormatMarkdownSchema, "format_markdown_schema"),
      );

      const raw = response.choices[0]?.message?.content || "{}";

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = {
          markdown: raw,
          sections: [],
        };
      }

      return {
        markdown: parsed.markdown || "",
        sections: parsed.sections || [],
        confidence: 0.92,
      };
    } catch (error: any) {
      return {
        markdown: "",
        sections: [],
        confidence: 0,
        error: error.message,
      };
    }
  },
};
