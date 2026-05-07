import { ActionExecutor, ToolRouter } from "./3.executor";
import { ActionGraph, ActionNode } from "./types";

export class Scheduler {
  private edgeMap = new Map<string, string[]>();
  private reverseEdgeMap = new Map<string, string[]>();
  private actionExecutor: ActionExecutor;

  constructor(
    private graph: ActionGraph,
    private toolRouter: ToolRouter,
    private maxRetry = 2,
  ) {
    this.actionExecutor = new ActionExecutor(this.toolRouter);
    this.buildIndex();
  }

  /**
   * Build adjacency maps
   */
  private buildIndex() {
    for (const edge of this.graph.edges) {
      if (!this.edgeMap.has(edge.from)) {
        this.edgeMap.set(edge.from, []);
      }
      this.edgeMap.get(edge.from)!.push(edge.to);

      if (!this.reverseEdgeMap.has(edge.to)) {
        this.reverseEdgeMap.set(edge.to, []);
      }
      this.reverseEdgeMap.get(edge.to)!.push(edge.from);
    }
  }

  /**
   * Check if node is ready to execute
   */
  private isReady(nodeId: string): boolean {
    const deps = this.reverseEdgeMap.get(nodeId) || [];

    return deps.every((depId) => {
      const depNode = this.graph.nodes.get(depId);
      return depNode?.status === "success";
    });
  }

  /**
   * Get all runnable nodes
   */
  private getRunnableNodes(): ActionNode[] {
    const result: ActionNode[] = [];

    for (const node of this.graph.nodes.values()) {
      if (node.status === "pending" && this.isReady(node.id)) {
        result.push(node);
      }
    }

    return result;
  }

  /**
   * Execute single node with retry
   */
  private async executeNode(node: ActionNode): Promise<void> {
    node.status = "running";

    try {
      const result = await this.actionExecutor.execute(node);
      node.output = result;
      node.status = "success";
    } catch (err: any) {
      node.retryCount = (node.retryCount || 0) + 1;
      node.error = err?.message ?? String(err);

      if (node.retryCount <= this.maxRetry) {
        node.status = "pending"; // retry
      } else {
        node.status = "failed";
      }
    }
  }

  /**
   * Main execution loop
   */
  async run(): Promise<ActionGraph> {
    while (true) {
      const runnable = this.getRunnableNodes();

      // 종료 조건
      if (runnable.length === 0) {
        const remaining = Array.from(this.graph.nodes.values()).filter(
          (n) => n.status === "pending" || n.status === "running",
        );

        if (remaining.length === 0) {
          break; // all done
        }

        // deadlock or waiting state
        await this.sleep(50);
        continue;
      }

      // parallel execution
      await Promise.all(runnable.map((node) => this.executeNode(node)));
    }

    return this.graph;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
