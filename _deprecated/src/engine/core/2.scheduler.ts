import { ActionExecutor, ToolExecutor } from "./3.executor";

import {
  ActionEdge,
  ActionGraph,
  ActionNode,
  ActionStatus,
  ComparisonCondition,
  Condition,
  LogicalCondition,
} from "./types";

const START = "START";

export interface SchedulerOptions {
  retryCount?: number;
  concurrency?: number;
}

export class Scheduler {
  private actionExecutor: ActionExecutor;
  private nodeMap = new Map<string, ActionNode>();
  private edgeMap = new Map<string, ActionEdge[]>(); // from -> edges
  private reverseEdgeMap = new Map<string, ActionEdge[]>(); // from -> edges

  constructor(
    private graph: ActionGraph,
    private toolExecutor: ToolExecutor,
    private options: SchedulerOptions = {},
  ) {
    this.actionExecutor = new ActionExecutor(this.graph, this.toolExecutor);
    this.buildMaps();
  }

  private buildMaps() {
    for (const node of this.graph.nodes) {
      this.nodeMap.set(node.id, node);
    }

    for (const edge of this.graph.edges) {
      const existing = this.edgeMap.get(edge.from) ?? [];
      existing.push(edge);
      this.edgeMap.set(edge.from, existing);

      const incoming = this.reverseEdgeMap.get(edge.to) ?? [];
      incoming.push(edge);
      this.reverseEdgeMap.set(edge.to, incoming);
    }
  }

  private getDepsOutputs(nodeId: string): any[] {
    const incoming = this.reverseEdgeMap.get(nodeId) || [];

    return incoming.reduce((acc: any[], edge) => {
      if (edge.from === START) {
        return acc;
      }

      const depNode = this.nodeMap.get(edge.from);

      if (depNode && depNode.output !== undefined) {
        acc.push({
          nodeId: depNode.id,
          output: depNode.output,
        });
      }

      return acc;
    }, []);
  }

  private getRunnableNodes(): ActionNode[] {
    const runnable: ActionNode[] = [];

    for (const node of this.graph.nodes) {
      // 이미 실행중/완료 상태 제외
      if (
        node.status === "running" ||
        node.status === "completed" ||
        node.status === "skipped" ||
        node.status === "failed"
      ) {
        continue;
      }

      // 현재 노드로 들어오는 dependency 검색
      const deps = this.reverseEdgeMap.get(node.id) ?? [];

      // 모든 deps가 진행이 되었는지
      const allDepsResolved = deps.every((edge) => {
        // START 에 연결된 노드는 바로 실행 가능
        if (edge.from === START) {
          return true;
        }

        const depNode = this.nodeMap.get(edge.from);

        return (
          depNode?.status === "completed" ||
          depNode?.status === "skipped" ||
          depNode?.status === "failed"
        );
      });

      if (!allDepsResolved) {
        continue;
      }

      // 진입 가능한 edge 존재 여부
      const reachable = deps.some((edge) => this.isEdgeSatisfied(edge));

      if (!reachable) {
        this.setNodeState(node.id, "skipped");
        continue;
      }

      const depsOutputs = this.getDepsOutputs(node.id);

      node.rawInput =
        depsOutputs.length > 0 ? JSON.stringify(depsOutputs) : this.graph.input;

      runnable.push(node);
    }

    return runnable;
  }

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
    condition: ComparisonCondition,
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
    condition: LogicalCondition,
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

  private isEdgeSatisfied(edge: ActionEdge): boolean {
    const fromNode = this.nodeMap.get(edge.from);

    // START는 항상 허용
    if (edge.from === START) {
      return true;
    }

    // 선행 노드 미완료
    if (
      fromNode?.status !== "completed" &&
      fromNode?.status !== "skipped" &&
      fromNode?.status !== "failed"
    ) {
      return false;
    }

    // edge condition 없음
    if (!edge.condition) {
      return true;
    }

    return this.evaluateCondition(
      edge.condition,
      this.buildRuntimeContext(fromNode!),
    );
  }

  private buildRuntimeContext(node: ActionNode): Record<string, any> {
    return {
      current: {
        id: node.id,
        status: node.status,
        retryCount: node.retryCount ?? 0,
      },

      graph: {
        results: this.graph.state.result,
      },

      nodes: this.graph.nodes.reduce(
        (acc, n) => {
          acc[n.id] = {
            status: n.status,
            output: this.graph.state.result[n.id],
          };

          return acc;
        },
        {} as Record<string, any>,
      ),
    };
  }

  async run() {
    let stepIndex = 0;
    while (true) {
      console.log("-----", stepIndex++);
      const runnables = this.getRunnableNodes();

      // END면 종료
      if (runnables.length === 0) {
        break;
      }
      console.log("runnables list: ", runnables);

      // 프로세스 진행
      await this.execute(runnables);
    }

    return this.graph;
  }

  private async execute(nodes: ActionNode[]) {
    const concurrency = this.options.concurrency ?? 5;
    let index = 0;

    const worker = async () => {
      while (index < nodes.length) {
        const currentIndex = index++;
        const node = nodes[currentIndex];

        try {
          this.setNodeState(node.id, "running");

          // 실제 실행
          const output = await this.actionExecutor.execute(node);
          this.graph.state.result[node.id] = {
            success: true,
            output,
          };

          // const ms = this.getRandom(1000, 5000);
          // console.log(`${node.id} wait for ${ms}ms`);
          // await this.sleep(ms);

          // // 결과 저장
          // this.graph.state.result[node.id] = {
          //   success: true,
          // };

          this.setNodeState(node.id, "completed");
          console.log(`${node.id} completed`);
        } catch (err: any) {
          this.setNodeState(node.id, "failed");

          this.graph.state.result[node.id] = {
            success: false,
            error: err?.message,
          };

          console.error(`${node.id} failed`, err);
        }
      }
    };

    // concurrency 만큼 worker 생성
    const workers = Array.from(
      { length: Math.min(concurrency, nodes.length) },
      () => worker(),
    );

    await Promise.all(workers);
  }

  private getPath(obj: any, path: string) {
    return path.split(".").reduce((acc, key) => acc?.[key], obj);
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getRandom(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  private setNodeState(nodeId: string, status: ActionStatus) {
    const node = this.nodeMap.get(nodeId);
    if (!node) return;
    node.status = status;
  }
}
