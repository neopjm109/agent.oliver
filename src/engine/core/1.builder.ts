import { randomUUID } from "crypto";
import { ActionGraph, ActionNode } from "./types";
import { IntentRegistry } from "./intent.registry";

export class GraphBuilder {
  constructor(private registry: IntentRegistry) {}

  build(intent: string, input: any): ActionGraph {
    const { nodes, edges } = this.registry.get(intent);
    const nodeMap = new Map<string, ActionNode>();

    for (const node of nodes) {
      nodeMap.set(node.id, {
        ...node,
        status: "pending",
        retryCount: 0,
        input: this.resolveInput(node, input),
      });
    }

    // 2. graph 생성
    const graph: ActionGraph = {
      id: randomUUID(),
      intent,
      nodes: nodeMap,
      edges,
      input,
    };

    return graph;
  }
  private resolveInput(node: ActionNode, input: any) {
    if (node.id === "search") {
      return input.query;
    }

    if (node.id === "execute") {
      return input.code;
    }

    return input;
  }
}
