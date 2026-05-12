import { randomUUID } from "crypto";
import { ActionGraph, ActionNode } from "./types";
import { IntentRegistry } from "./intent.registry";

export class GraphBuilder {
  constructor(private registry: IntentRegistry) {}

  build(intent: string, input: any): ActionGraph {
    const { nodes, edges } = this.registry.get(intent);
    const graph: ActionGraph = {
      id: randomUUID(),
      intent,
      nodes,
      edges,
      input,
      state: {
        phase: "initial",
        result: {},
      },
    };

    return graph;
  }
}
