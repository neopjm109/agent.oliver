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

export const FormatMarkdownSchema = z.object({
  markdown: z.string(),
  sections: z.array(z.string()),
  confidence: z.number(),
  error: z.string().optional().nullable(),
});

export type FormatMarkdownData = z.infer<
  typeof FormatMarkdownSchema
>;

/**
 * ------------------------------------------------------
 * Constants
 * ------------------------------------------------------
 */

export const formatMarkdownName = "formatMarkdownTool";

/**
 * ------------------------------------------------------
 * Tool
 * ------------------------------------------------------
 */

export const formatMarkdownTool: Tool<FormatMarkdownData> = {
  definition: {
    name: formatMarkdownName,
    description:
      "Formats raw text into clean, structured, and readable Markdown.",
    category: ToolCategory.ANALYSIS,
    capabilities: [
      "markdown_formatting",
      "documentation_generation",
      "text_structuring",
      "content_cleanup",
    ],
    sideEffects: [SideEffect.NETWORK_CALL],
    retryable: true,
    timeoutMs: 30_000,
    version: "1.0.0",
    tags: [
      "markdown",
      "formatting",
      "documentation",
      "text",
      "structure",
    ],
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Raw text content to format.",
        },
        style: {
          type: "string",
          enum: [
            "simple",
            "detailed",
            "documentation",
          ],
          description:
            "Markdown formatting style preset.",
        },
        include_toc: {
          type: "boolean",
          description:
            "Whether to include a table of contents.",
        },
      },
      required: ["text"],
    },
    outputSchema: {
      type: "object",
    },
  },

  async execute(
    context: ToolExecutionContext,
  ): Promise<ToolResult<FormatMarkdownData>> {
    try {
      /**
       * ------------------------------------------------------
       * Extract Input
       * ------------------------------------------------------
       */

      const nodeInput = context.node.input || {};
      const text = nodeInput.text;
      const style = nodeInput.style || "simple";
      const includeToc =
        nodeInput.include_toc || false;

      if (!text) {
        return {
          success: false,
          error: "Missing required input: text",
          metadata: {
            tool: formatMarkdownName,
          },
        };
      }

      /**
       * ------------------------------------------------------
       * Style Guides
       * ------------------------------------------------------
       */

      const styleGuideMap: Record<string, string> = {
        simple:
          "Use minimal Markdown formatting. Keep it concise and readable.",
        detailed:
          "Use rich Markdown formatting including headings, lists, emphasis, tables, and code blocks when appropriate.",
        documentation:
          "Format as professional technical documentation with clear sections, subsections, code blocks, notes, and structured hierarchy.",
      };

      const styleGuide =
        styleGuideMap[style] ||
        styleGuideMap.simple;

      /**
       * ------------------------------------------------------
       * TOC Instruction
       * ------------------------------------------------------
       */

      const tocInstruction = includeToc
        ? "Include a table of contents near the top."
        : "Do not include a table of contents.";

      /**
       * ------------------------------------------------------
       * Prompt
       * ------------------------------------------------------
       */

      const systemPrompt = `
You are an expert Markdown formatter.

Responsibilities:
1. Improve readability and structure.
2. Use proper Markdown syntax.
3. Preserve original meaning.
4. Organize content into logical sections.

Return ONLY valid JSON.
      `;

      const userPrompt = `
Format the following text into Markdown.

[STYLE]
${style}

[STYLE GUIDE]
${styleGuide}

[TOC]
${tocInstruction}

[TEXT]
${text}

---

Return JSON with:

- markdown
- sections
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
          FormatMarkdownSchema,
          "format_markdown_schema",
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
            tool: formatMarkdownName,
          },
        };
      }

      let parsed: FormatMarkdownData;

      try {
        parsed = FormatMarkdownSchema.parse(
          JSON.parse(raw),
        );
      } catch {
        parsed = {
          markdown: raw,
          sections: [],
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
          tool: formatMarkdownName,
          model: response.model,
          style,
          includeToc,
          sectionCount:
            parsed.sections.length,
          confidence: parsed.confidence,
          executionId:
            context.runtime.executionId,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error:
          error?.message ||
          "Unknown markdown formatting error",
        metadata: {
          tool: formatMarkdownName,
          executionId:
            context.runtime.executionId,
        },
      };
    }
  },
};