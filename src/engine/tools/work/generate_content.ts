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

export const GenerateContentSchema = z.object({
  title: z.string(),
  content: z.string(),
  outline: z.array(z.string()),
  confidence: z.number(),
  error: z.string().optional().nullable(),
});

export type GenerateContentData = z.infer<typeof GenerateContentSchema>;

export const generateContentName = "generateContentTool";

export const generateContentTool: Tool<GenerateContentData> = {
  definition: {
    name: generateContentName,
    description:
      "Generates structured written content such as documents, reports, articles, and creative writing.",
    category: ToolCategory.LLM,
    capabilities: [
      "content_generation",
      "document_writing",
      "article_generation",
      "creative_writing",
      "structured_text_generation",
    ],
    sideEffects: [SideEffect.NETWORK_CALL],
    retryable: true,
    timeoutMs: 60_000,
    version: "1.0.0",
    tags: ["content", "writing", "generation", "document", "article", "llm"],
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["document", "report", "article", "novel"],
          description: "Type of content to generate.",
        },
        topic: {
          type: "string",
          description: "Main subject or topic of the content.",
        },
        tone: {
          type: "string",
          enum: ["neutral", "formal", "casual", "storytelling"],
          description: "Writing tone and style.",
        },
        audience: {
          type: "string",
          description: "Target audience for the generated content.",
        },
        length: {
          type: "string",
          enum: ["short", "medium", "long"],
          description: "Desired output length.",
        },
        language: {
          type: "string",
          description: "Output language.",
        },
        constraints: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Optional content constraints or requirements.",
        },
      },
      required: ["type", "topic"],
    },
    outputSchema: {
      type: "object",
    },
  },

  async execute(
    context: ToolExecutionContext,
  ): Promise<ToolResult<GenerateContentData>> {
    try {
      /**
       * ------------------------------------------------------
       * Extract Input
       * ------------------------------------------------------
       */

      const nodeInput = context.node.input || {};
      const type = nodeInput.type;
      const topic = nodeInput.topic;
      const tone = nodeInput.tone || "neutral";
      const audience = nodeInput.audience || "General audience";
      const length = nodeInput.length || "medium";
      const language = nodeInput.language || "English";
      const constraints = nodeInput.constraints || [];

      if (!type) {
        return {
          success: false,
          error: "Missing required input: type",
          metadata: {
            tool: generateContentName,
          },
        };
      }

      if (!topic) {
        return {
          success: false,
          error: "Missing required input: topic",
          metadata: {
            tool: generateContentName,
          },
        };
      }

      /**
       * ------------------------------------------------------
       * Type Instructions
       * ------------------------------------------------------
       */

      const typeInstructionMap: Record<string, string> = {
        document:
          "Write a well-structured document with clear sections and logical organization.",

        report:
          "Write a professional report including introduction, analysis, findings, and conclusion.",

        article:
          "Write an engaging and informative article suitable for publication or blogging.",

        novel:
          "Write immersive narrative content with storytelling, pacing, and descriptive writing.",
      };

      const typeInstruction =
        typeInstructionMap[type] || "Write high-quality structured content.";

      /**
       * ------------------------------------------------------
       * Length Instructions
       * ------------------------------------------------------
       */

      const lengthGuideMap: Record<string, string> = {
        short: "Keep the content concise and compact.",

        medium: "Provide balanced detail and readability.",

        long: "Provide comprehensive, detailed, and in-depth content.",
      };

      const lengthGuide = lengthGuideMap[length] || lengthGuideMap.medium;

      /**
       * ------------------------------------------------------
       * Constraints
       * ------------------------------------------------------
       */

      const constraintText =
        constraints.length > 0
          ? `
Constraints:
- ${constraints.join("\n- ")}
`
          : "";

      /**
       * ------------------------------------------------------
       * Prompt
       * ------------------------------------------------------
       */

      const systemPrompt = `
You are a professional writer and content creator.

Responsibilities:
1. Generate high-quality written content.
2. Match requested tone and audience.
3. Structure content clearly and professionally.
4. Preserve clarity, readability, and coherence.

Return ONLY valid JSON.
        `;

      const userPrompt = `
Generate content based on the following request.

[CONTENT TYPE]
${type}

[TOPIC]
${topic}

[TONE]
${tone}

[AUDIENCE]
${audience}

[LENGTH]
${lengthGuide}

[LANGUAGE]
${language}

[INSTRUCTIONS]
${typeInstruction}

${constraintText}

---

Return JSON with:

- title
- content
- outline
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
        zodResponseFormat(GenerateContentSchema, "generate_content_schema"),
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
            tool: generateContentName,
          },
        };
      }

      let parsed: GenerateContentData;

      try {
        parsed = GenerateContentSchema.parse(JSON.parse(raw));
      } catch {
        parsed = {
          title: "",
          content: raw,
          outline: [],
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
          tool: generateContentName,
          model: response.model,
          contentType: type,
          tone,
          language,
          length,
          outlineCount: parsed.outline.length,
          contentLength: parsed.content.length,
          confidence: parsed.confidence,
          executionId: context.runtime.executionId,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Unknown content generation error",
        metadata: {
          tool: generateContentName,
          executionId: context.runtime.executionId,
        },
      };
    }
  },
};
