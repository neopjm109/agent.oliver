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

export const SummarizeSchema = z.object({
  summary: z.string(),
  key_points: z.array(z.string()),
  important_entities: z.array(z.string()),
  decisions: z.array(z.string()),
  open_questions: z.array(z.string()),
  compressed_context: z.string(),
  compression_ratio: z.number(),
  confidence: z.number(),
});

export type SummarizeData = z.infer<typeof SummarizeSchema>;

export const summarizeToolName = "summarizeTool";

/**
 * ------------------------------------------------------
 * Summarize Tool
 * ------------------------------------------------------
 */

export const summarizeTool: Tool<SummarizeData> = {
  definition: {
    name: summarizeToolName,
    description:
      "Summarizes long text or accumulated graph context into a concise structured representation optimized for downstream reasoning and memory compression.",
    category: ToolCategory.ANALYSIS,
    capabilities: [
      "summarization",
      "context_compression",
      "memory_optimization",
      "information_extraction",
    ],
    sideEffects: [SideEffect.NETWORK_CALL],
    retryable: true,
    timeoutMs: 45_000,
    version: "1.0.0",
    tags: ["summary", "compression", "memory", "analysis", "optimization"],
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Text content to summarize.",
        },
        maxLength: {
          type: "number",
          description:
            "Optional maximum summary length in approximate characters or tokens.",
        },
        format: {
          type: "string",
          enum: ["compact", "bullet", "structured"],
          description: "Summary output format.",
        },
        focus: {
          type: "string",
          description:
            "Optional summarization focus area such as requirements, decisions, risks, or errors.",
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
  ): Promise<ToolResult<SummarizeData>> {
    try {
      const nodeInput = context.node.input || {};
      const text = nodeInput.text;
      const maxLength = nodeInput.maxLength;
      const format = nodeInput.format || "structured";
      const focus = nodeInput.focus;

      if (!text) {
        return {
          success: false,
          error: "Missing required input: text",
          metadata: {
            tool: "summarize",
          },
        };
      }

      const systemPrompt = `
You are an expert AI system that summarizes long text into a compact and structured representation optimized for downstream graph reasoning and memory reuse.

Goals:
1. Preserve the most important information.
2. Remove redundancy and irrelevant noise.
3. Compress context efficiently.
4. Structure outputs for future orchestration.

Return ONLY valid JSON.
      `;

      const userPrompt = `
Summarize the following text.

[TEXT]
${text}

[OPTIONS]
- max_length: ${maxLength}
- format: ${format}
- focus: ${focus}

---

Return JSON with:

- summary
- key_points
- important_entities
- decisions
- open_questions
- compressed_context
- compression_ratio
- confidence
      `;

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

        zodResponseFormat(SummarizeSchema, "summarize_schema"),
      );

      const raw = response.choices[0]?.message?.content;

      if (!raw) {
        return {
          success: false,
          error: "Empty response from LLM",
          metadata: {
            tool: "summarize",
          },
        };
      }

      const parsed = SummarizeSchema.parse(JSON.parse(raw));

      return {
        success: true,
        data: parsed,
        metadata: {
          tool: "summarize",
          model: response.model,
          compressionRatio: parsed.compression_ratio,
          confidence: parsed.confidence,
          originalLength: text.length,
          compressedLength: parsed.compressed_context.length,
          executionId: context.runtime.executionId,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Unknown summarize error",
        metadata: {
          tool: "summarize",
          executionId: context.runtime.executionId,
        },
      };
    }
  },
};
