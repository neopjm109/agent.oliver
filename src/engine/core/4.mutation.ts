import { ActionGraph, ActionNode, MutationEvent } from "./types";

export class ReactiveGraphMutationEngine {
  constructor(
    private graph: ActionGraph,
    private scheduler?: any, // Scheduler reference (optional)
  ) {}

  /**
   * entry point: Executor에서 호출됨
   */
  onNodeCompleted(node: ActionNode) {
    const event = this.analyze(node);

    if (!event || event.type === "NOOP") return;

    this.apply(event);

    // 🔥 중요: scheduler 재활성화 (optional hook)
    this.notifyScheduler();
  }
  private analyze(node: ActionNode): MutationEvent {
    const output = node.output;

    // 1. 에러 기반 retry path
    if (node.status === "failed") {
      return {
        type: "REPLACE_NODE",
        oldId: node.id,
        newNode: {
          ...node,
          id: node.id + "_retry",
          retryCount: (node.retryCount || 0) + 1,
          status: "pending",
        },
      };
    }

    // 2. 추가 검색 필요
    if (output?.needMoreSearch) {
      return {
        type: "ADD_NODE",
        node: {
          id: `extra_search_${Date.now()}`,
          tool: "searchWebTool",
          status: "pending",
          input: output.query,
        },
        after: node.id,
      };
    }

    // 3. branching
    if (output?.branch === "report") {
      return {
        type: "ADD_NODE",
        node: {
          id: `report_${Date.now()}`,
          tool: "generateContentTool",
          status: "pending",
          input: output,
        },
        after: node.id,
      };
    }

    return { type: "NOOP" };
  }
  private apply(event: MutationEvent) {
    switch (event.type) {
      case "ADD_NODE":
        this.addNode(event.node, event.after);
        break;

      case "REMOVE_NODE":
        this.removeNode(event.nodeId);
        break;

      case "REPLACE_NODE":
        this.replaceNode(event.oldId, event.newNode);
        break;

      case "ADD_EDGE":
        this.addEdge(event.from, event.to);
        break;

      case "REWIRE":
        this.rewire(event.from, event.to);
        break;
    }
  }
  private addNode(node: ActionNode, after?: string) {
    this.graph.nodes.set(node.id, node);

    if (after) {
      this.graph.edges.push({
        from: after,
        to: node.id,
      });
    }
  }
  private removeNode(nodeId: string) {
    this.graph.nodes.delete(nodeId);

    this.graph.edges = this.graph.edges.filter(
      (e) => e.from !== nodeId && e.to !== nodeId,
    );
  }
  private replaceNode(oldId: string, newNode: ActionNode) {
    this.removeNode(oldId);
    this.graph.nodes.set(newNode.id, newNode);
  }
  private addEdge(from: string, to: string) {
    this.graph.edges.push({ from, to });
  }
  private rewire(from: string, to: string) {
    // remove existing outgoing edges
    this.graph.edges = this.graph.edges.filter((e) => e.from !== from);

    // create new flow
    this.graph.edges.push({ from, to });
  }
  private notifyScheduler() {
    // optional: Scheduler wake-up trigger
    if (this.scheduler?.wake) {
      this.scheduler.wake();
    }
  }
}
