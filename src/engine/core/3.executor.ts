import { ReactiveGraphMutationEngine } from "./4.mutation";
import { ActionNode } from "./types";

export class ActionExecutor {
  constructor(
    private toolRouter: ToolRouter,
    private mutationEngine?: ReactiveGraphMutationEngine,
  ) {}

  async execute(node: ActionNode): Promise<any> {
    try {
      node.status = "running";

      const result = await this.toolRouter.route(node);

      node.output = result;
      node.status = "success";

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

export class ToolRouter {
  constructor(private toolExecutor: ToolExecutor) {}

  async route(node: ActionNode): Promise<any> {
    const toolName = node.tool;

    // 1. 기본 routing
    const tool = this.selectTool(toolName, node);

    // 2. 실행
    return await this.toolExecutor.execute(tool, node.input);
  }

  private selectTool(toolName: string, node: ActionNode) {
    // future: fallback / variant selection / dynamic routing

    return toolName;
  }
}

export class ToolExecutor {
  constructor(private registry: ToolRegistry) {}

  async execute(toolName: string, input: any): Promise<any> {
    const tool = this.registry.get(toolName);

    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    return await tool.run(input);
  }
}

export class ToolRegistry {
  private tools = new Map<string, any>();

  register(name: string, tool: any) {
    this.tools.set(name, tool);
  }

  get(name: string) {
    return this.tools.get(name);
  }
}
