import { chatInput } from "../../client/client";
import {
  Tool,
  ToolCategory,
  ToolExecutionContext,
  ToolResult,
  SideEffect,
} from "../types";

export interface SimpleResponseResult {
  response: string;
}

export const simpleResponseToolName = "simpleResponseTool";

export const simpleResponseTool: Tool<SimpleResponseResult> = {
  definition: {
    name: simpleResponseToolName,
    description:
      "Uses an LLM to generate a direct natural language response for a given input.",
    category: ToolCategory.LLM,
    capabilities: [
      "text_generation",
      "question_answering",
      "summarization",
      "general_reasoning",
    ],
    sideEffects: [SideEffect.NETWORK_CALL],
    retryable: true,
    timeoutMs: 30_000,
    version: "1.0.0",
    tags: ["llm", "response", "generation", "text"],
    inputSchema: {
      type: "object",
      properties: {
        input: {
          type: "string",
          description: "User input text.",
        },
        instruction: {
          type: "string",
          description:
            "Optional system-level instruction for controlling the response.",
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
  ): Promise<ToolResult<SimpleResponseResult>> {
    try {
      const nodeInput = context.node.input || {};
      const input = nodeInput.input;
      const instruction = nodeInput.instruction;

      if (!input) {
        return {
          success: false,
          error: "Missing required input: input",
          metadata: {
            tool: "simple_response",
          },
        };
      }

      const finalInput = instruction
        ? `
[INSTRUCTION]
${instruction}

[INPUT]
${input}
`
        : input;

      const result = await chatInput(finalInput, {
        type: "text",
      });

      const response = result?.choices?.[0]?.message?.content?.trim() || "";

      return {
        success: true,
        data: {
          response,
        },
        metadata: {
          tool: "simple_response",
          model: result.model,
          executionId: context.runtime.executionId,
          responseLength: response.length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Unknown simple response error",
        metadata: {
          tool: "simple_response",
          executionId: context.runtime.executionId,
        },
      };
    }
  },
};

export default simpleResponseTool;
