import { randomUUID } from "node:crypto";
import { Tool, ToolDefinition } from "../tools/types";
import { ActionGraph, ActionNode, RuntimeContext } from "./types";
import { chatMessages } from "../client/client";
import { zodResponseFormat } from "openai/helpers/zod.js";
import { convertToZodSchema } from "../utils/convert.zod";

export class ActionExecutor {
  constructor(
    private graph: ActionGraph,
    private toolExecutor: ToolExecutor,
  ) {}

  async execute(node: ActionNode): Promise<any> {
    try {
      const runtime: RuntimeContext = {
        graphId: this.graph.id,
        executionId: randomUUID(),
        startedAt: new Date().getTime(),
      };

      const result = await this.toolExecutor.execute(node, this.graph, runtime);
      node.output = result;

      return result;
    } catch (err: any) {
      node.retryCount = (node.retryCount || 0) + 1;
      node.error = err?.message ?? String(err);

      node.status = node.retryCount > 2 ? "failed" : "pending";

      throw err;
    }
  }
}

export class ToolExecutor {
  constructor(private registry: ToolRegistry) {}

  async execute(
    node: ActionNode,
    graph: ActionGraph,
    runtime: RuntimeContext,
  ): Promise<any> {
    const tool = this.registry.get(node.tool)!!;
    const args = await this.resolveInputs(node, tool?.definition);
    console.log("---");
    console.log(args);
    console.log("---");
    node.input = args;

    if (!tool) {
      throw new Error(`Tool not found: ${node.tool}`);
    }

    return await tool.execute({ node, graph, runtime });
  }

  private async resolveInputs(node: ActionNode, tool: ToolDefinition) {
    const parameterSpec = tool.inputSchema?.properties
      ? this.buildParameterSpec(tool.inputSchema.properties)
      : "No parameters";

    const systemPrompt = `
You are a runtime input resolver for an AI Graph Engine.

Your task:
- Analyze the raw input
- Extract variables for the target tool
- Return ONLY valid JSON
- Never wrap with markdown
- Never explain outside JSON

Rules:
- Match parameter types strictly
- Fill missing values only if strongly inferable
- Use null when unknown
- Keep response deterministic
`;

    const userPrompt = `
[TOOL]
name: ${tool.name}

description:
${tool.description}

[PARAMETERS]
${parameterSpec}

[RAW INPUT]
${
  typeof node.rawInput === "string"
    ? node.rawInput
    : JSON.stringify(node.rawInput, null, 2)
}

Resolve tool input variables.
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
      zodResponseFormat(
        convertToZodSchema(tool.inputSchema?.properties),
        "arguments_schema",
      ),
    );

    const raw = response.choices[0]?.message?.content || "{}";
    console.log("args raw", raw);
    try {
      return JSON.parse(raw);
    } catch {
      return "";
    }
  }

  private buildParameterSpec(
    properties: Record<string, any>,
    depth = 0,
  ): string {
    const indent = "  ".repeat(depth);

    return Object.entries(properties)
      .map(([key, value]) => {
        let line = `${indent}- ${key}: ${value.type}`;

        if (value.required) {
          line += " (required)";
        }

        if (value.description) {
          line += ` - ${value.description}`;
        }

        if (value.enum?.length) {
          line += ` | enum: [${value.enum.join(", ")}]`;
        }

        if (value.type === "object" && value.properties) {
          line += `\n${this.buildParameterSpec(value.properties, depth + 1)}`;
        }

        return line;
      })
      .join("\n");
  }
}

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool) {
    this.tools.set(tool.definition.name, tool);
  }

  get(toolId: string): Tool | undefined {
    return this.tools.get(toolId);
  }

  has(toolId: string): boolean {
    return this.tools.has(toolId);
  }

  remove(toolId: string) {
    this.tools.delete(toolId);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }
}
