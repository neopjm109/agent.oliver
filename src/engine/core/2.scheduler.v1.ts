import { ActionExecutor, ToolExecutor } from "./3.executor";

import { ActionEdge, ActionGraph, ActionNode, Condition } from "./types";

const START = "START";
const END = "END";

export class Scheduler {
  private edgeMap = new Map<string, ActionEdge[]>();
  private reverseEdgeMap = new Map<string, ActionEdge[]>();
  private actionExecutor: ActionExecutor;

  constructor(
    private graph: ActionGraph,
    private toolExecutor: ToolExecutor,
    private maxRetry = 2,
  ) {
    this.actionExecutor = new ActionExecutor(this.graph, this.toolExecutor);

    this.buildIndex();
  }

  /**
   * ---------------------------------------------------
   * Build Edge Index
   * ---------------------------------------------------
   */

  private buildIndex() {
    for (const edge of this.graph.edges) {
      /**
       * forward map
       */
      if (!this.edgeMap.has(edge.from)) {
        this.edgeMap.set(edge.from, []);
      }

      this.edgeMap.get(edge.from)!.push(edge);

      /**
       * reverse map
       */
      if (!this.reverseEdgeMap.has(edge.to)) {
        this.reverseEdgeMap.set(edge.to, []);
      }

      this.reverseEdgeMap.get(edge.to)!.push(edge);
    }
  }

  /**
   * ---------------------------------------------------
   * Runtime Context
   * ---------------------------------------------------
   */

  private buildRuntimeContext() {
    const nodeContext: Record<string, any> = {};

    for (const [id, node] of this.graph.nodes) {
      nodeContext[id] = {
        status: node.status,
        output: node.output,
        retryCount: node.retryCount ?? 0,
        error: node.error,
      };
    }

    return {
      input: this.graph.input,

      state: this.graph.state ?? {},

      node: nodeContext,
    };
  }

  /**
   * ---------------------------------------------------
   * Condition Evaluation
   * ---------------------------------------------------
   */

  private evaluateCondition(
    condition: Condition,
    context: Record<string, any>,
  ): boolean {
    switch (condition.type) {
      case "comparison":
        return this.evaluateComparison(condition, context);

      case "logical":
        return this.evaluateLogical(condition, context);

      default:
        return false;
    }
  }

  private evaluateComparison(
    condition: any,
    context: Record<string, any>,
  ): boolean {
    const leftValue = this.getPath(context, condition.left);

    const rightValue = condition.right;

    switch (condition.operator) {
      case "==":
        return leftValue == rightValue;

      case "!=":
        return leftValue != rightValue;

      case ">":
        return leftValue > rightValue;

      case "<":
        return leftValue < rightValue;

      case ">=":
        return leftValue >= rightValue;

      case "<=":
        return leftValue <= rightValue;

      default:
        return false;
    }
  }

  private evaluateLogical(
    condition: any,
    context: Record<string, any>,
  ): boolean {
    switch (condition.operator) {
      case "AND":
        return condition.conditions.every((c: Condition) =>
          this.evaluateCondition(c, context),
        );

      case "OR":
        return condition.conditions.some((c: Condition) =>
          this.evaluateCondition(c, context),
        );

      default:
        return false;
    }
  }

  /**
   * ---------------------------------------------------
   * Dependency Check
   * ---------------------------------------------------
   */

  private areDependenciesCompleted(nodeId: string): boolean {
    const incoming = this.reverseEdgeMap.get(nodeId) || [];

    /**
     * no incoming edge
     */
    if (incoming.length === 0) {
      return false;
    }

    return incoming.every((edge) => {
      /**
       * START node
       */
      if (edge.from === START) {
        return true;
      }

      const depNode = this.graph.nodes.get(edge.from);

      return depNode?.status === "completed";
    });
  }

  /**
   * ---------------------------------------------------
   * Node Condition Check
   * ---------------------------------------------------
   */

  private isConditionSatisfied(node: ActionNode): boolean {
    if (!node.condition) {
      return true;
    }

    return this.evaluateCondition(node.condition, this.buildRuntimeContext());
  }

  /**
   * ---------------------------------------------------
   * Ready Check
   * ---------------------------------------------------
   */

  private isReady(node: ActionNode): boolean {
    if (!this.areDependenciesCompleted(node.id)) {
      return false;
    }

    if (!this.isConditionSatisfied(node)) {
      return false;
    }

    return true;
  }

  /**
   * ---------------------------------------------------
   * Dependency Outputs
   * ---------------------------------------------------
   */

  private getDepsOutputs(nodeId: string): any[] {
    const incoming = this.reverseEdgeMap.get(nodeId) || [];

    return incoming.reduce((acc: any[], edge) => {
      if (edge.from === START) {
        return acc;
      }

      const depNode = this.graph.nodes.get(edge.from);

      if (depNode && depNode.output !== undefined) {
        acc.push({
          nodeId: depNode.id,
          output: depNode.output,
        });
      }

      return acc;
    }, []);
  }

  /**
   * ---------------------------------------------------
   * Runnable Nodes
   * ---------------------------------------------------
   */

  private getRunnableNodes(): ActionNode[] {
    const result: ActionNode[] = [];

    for (const node of this.graph.nodes.values()) {
      /**
       * skip terminal node
       */
      if (node.id === START || node.id === END) {
        continue;
      }

      /**
       * pending only
       */
      if (node.status !== "pending") {
        continue;
      }

      /**
       * ready check
       */
      if (!this.isReady(node)) {
        continue;
      }

      const depsOutputs = this.getDepsOutputs(node.id);

      node.rawInput =
        depsOutputs.length > 0 ? JSON.stringify(depsOutputs) : this.graph.input;

      result.push(node);
    }

    return result;
  }

  /**
   * ---------------------------------------------------
   * Execute Node
   * ---------------------------------------------------
   */

  private async executeNode(node: ActionNode): Promise<void> {
    node.status = "running";

    try {
      const result = await this.actionExecutor.execute(node);

      node.output = result;

      node.status = "completed";
    } catch (err: any) {
      node.retryCount = (node.retryCount || 0) + 1;

      node.error = err?.message ?? String(err);

      /**
       * retry available
       */
      if (node.retryCount <= this.maxRetry) {
        node.status = "pending";
      } else {
        node.status = "failed";
      }
    }
  }

  /**
   * ---------------------------------------------------
   * END Check
   * ---------------------------------------------------
   */

  private isEndReached(): boolean {
    const incoming = this.reverseEdgeMap.get(END) || [];

    if (incoming.length === 0) {
      return false;
    }

    return incoming.every((edge) => {
      const node = this.graph.nodes.get(edge.from);

      return node?.status === "completed";
    });
  }

  /**
   * ---------------------------------------------------
   * Deadlock Check
   * ---------------------------------------------------
   */

  private detectDeadlock() {
    const pending = Array.from(this.graph.nodes.values()).filter(
      (n) => n.id !== START && n.id !== END && n.status === "pending",
    );

    return pending.map((node) => ({
      nodeId: node.id,

      deps: this.reverseEdgeMap.get(node.id),

      condition: node.condition,
    }));
  }

  /**
   * ---------------------------------------------------
   * Main Loop
   * ---------------------------------------------------
   */

  async run(): Promise<ActionGraph> {
    while (true) {
      /**
       * workflow completed
       */
      if (this.isEndReached()) {
        break;
      }

      const runnable = this.getRunnableNodes();

      /**
       * no executable node
       */
      if (runnable.length === 0) {
        const active = Array.from(this.graph.nodes.values()).some(
          (n) => n.status === "running",
        );

        /**
         * deadlock
         */
        if (!active) {
          console.warn("[Scheduler] deadlock detected", this.detectDeadlock());

          break;
        }

        await this.sleep(300);

        continue;
      }

      /**
       * parallel execution
       */
      await Promise.all(runnable.map((node) => this.executeNode(node)));
    }

    return this.graph;
  }

  /**
   * ---------------------------------------------------
   * Utils
   * ---------------------------------------------------
   */

  private getPath(obj: any, path: string) {
    return path.split(".").reduce((acc, key) => acc?.[key], obj);
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
