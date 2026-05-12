import { ActionExecutor, ToolExecutor } from "./3.executor";

import { ActionEdge, ActionGraph, ActionNode, Condition } from "./types";

const START = "START";
const END = "END";

export interface SchedulerOptions {
  concurrency?: number;
}

export class Scheduler {
  private nodeMap = new Map<string, ActionNode>();

  // from -> edges
  private edgeMap = new Map<string, ActionEdge[]>();

  // to -> dependency count
  private dependencyCount = new Map<string, number>();

  // to -> completed dependency count
  private completedDependencies = new Map<string, number>();

  constructor(
    private graph: ActionGraph,
    private toolExecutor: ToolExecutor,
    private options: SchedulerOptions = {},
  ) {
    this.buildMaps();
  }

  // -----------------------------------
  // Build Maps
  // -----------------------------------

  private buildMaps() {
    for (const node of this.graph.nodes) {
      this.nodeMap.set(node.id, node);

      this.dependencyCount.set(node.id, 0);

      this.completedDependencies.set(node.id, 0);
    }

    for (const edge of this.graph.edges) {
      const existing = this.edgeMap.get(edge.from) ?? [];

      existing.push(edge);

      this.edgeMap.set(edge.from, existing);

      // indegree 증가
      this.dependencyCount.set(
        edge.to,
        (this.dependencyCount.get(edge.to) ?? 0) + 1,
      );
    }
  }

  // -----------------------------------
  // Run
  // -----------------------------------

  async run() {
    const concurrency = this.options.concurrency ?? 3;

    // 시작 가능한 node 찾기
    let executableNodes = this.graph.nodes
      .filter((node) => (this.dependencyCount.get(node.id) ?? 0) === 0)
      .map((node) => node.id);

    while (executableNodes.length > 0) {
      const batch = executableNodes.splice(0, concurrency);

      const results = await Promise.all(
        batch.map((nodeId) => this.processNode(nodeId)),
      );

      const nextNodes = new Set<string>();

      for (const nodeId of results.flat()) {
        nextNodes.add(nodeId);
      }

      executableNodes.push(...nextNodes);
    }

    return this.graph;
  }

  // -----------------------------------
  // Process Node
  // -----------------------------------

  private async processNode(nodeId: string): Promise<string[]> {
    const node = this.nodeMap.get(nodeId);

    if (!node) {
      return [];
    }

    // 이미 완료된 경우
    if (node.status === "completed" || node.status === "running") {
      return [];
    }

    // 조건 실패
    if (!this.checkCondition(node)) {
      node.status = "skipped";

      return [];
    }

    // 실행
    await this.executeNode(node);

    // 실패
    if (node.status !== "completed") {
      return [];
    }

    // 다음 노드 처리
    const outgoingEdges = this.edgeMap.get(node.id) ?? [];

    const readyNodes: string[] = [];

    for (const edge of outgoingEdges) {
      const targetNodeId = edge.to;

      // dependency 완료 count 증가
      const completed = (this.completedDependencies.get(targetNodeId) ?? 0) + 1;

      this.completedDependencies.set(targetNodeId, completed);

      const required = this.dependencyCount.get(targetNodeId) ?? 0;

      // 모든 parent 완료 시 실행 가능
      if (completed >= required) {
        readyNodes.push(targetNodeId);
      }
    }

    return readyNodes;
  }

  // -----------------------------------
  // Execute Node
  // -----------------------------------

  private async executeNode(node: ActionNode) {
    const toolExecutor = this.tools[node.tool];

    if (!toolExecutor) {
      node.status = "failed";

      node.error = `Tool not found: ${node.tool}`;

      return;
    }

    try {
      node.status = "running";

      console.log(`[RUNNING] ${node.id}`);

      const result = await toolExecutor({
        node,
        graph: this.graph,
      });

      node.output = result;

      node.status = "completed";

      console.log(`[SUCCESS] ${node.id}`);
    } catch (error: any) {
      node.retryCount = (node.retryCount ?? 0) + 1;

      node.error = error?.message ?? "Unknown Error";

      // retry 가능 여부
      if ((node.retryCount ?? 0) < (node.maxRetries ?? 3)) {
        node.status = "pending";

        console.log(`[RETRY] ${node.id} (${node.retryCount})`);
      } else {
        node.status = "failed";

        console.error(`[FAILED] ${node.id}`, node.error);
      }
    }
  }

  // -----------------------------------
  // Condition
  // -----------------------------------

  private checkCondition(node: ActionNode): boolean {
    if (!node.condition) {
      return true;
    }

    switch (node.condition.type) {
      case "HAS_INPUT":
        return !!node.input;

      case "RETRY_LIMIT":
        return (node.retryCount ?? 0) < (node.condition.value ?? 3);

      default:
        return true;
    }
  }
}
