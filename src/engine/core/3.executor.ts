import { randomUUID } from "node:crypto";
import { Tool, ToolDefinition } from "../tools/types";
import { ReactiveGraphMutationEngine } from "./4.mutation";
import { ActionGraph, ActionNode, RuntimeContext } from "./types";

export class ActionExecutor {
  constructor(
    private graph: ActionGraph,
    private toolExecutor: ToolExecutor,
    private mutationEngine?: ReactiveGraphMutationEngine,
  ) {}

  async execute(node: ActionNode): Promise<any> {
    try {
      const runtime: RuntimeContext = {
        graphId: this.graph.id,
        executionId: randomUUID(),
        startedAt: new Date().getTime()
      }
      node.status = "running";

      const result = await this.toolExecutor.execute(node, this.graph, runtime);

      node.output = result;
      node.status = "completed";

      // 🔥 핵심: mutation trigger
      this.mutationEngine?.onNodeCompleted(node);

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

  async execute(node: ActionNode, graph: ActionGraph, runtime: RuntimeContext): Promise<any> {
    const tool = this.registry.get(node.tool);

    if (!tool) {
      throw new Error(`Tool not found: ${node.tool}`);
    }

    return await tool.execute({ node, graph, runtime });
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
    return Array.from(this.tools.values())
      .map(t => t.definition);
  }
}
