import { randomUUID } from "crypto";

import { ActionGraph, ActionNode, ActionState } from "./types";

import { IntentRegistry } from "./intent.registry";

export class GraphBuilder {
  constructor(private registry: IntentRegistry) {}

  build(intent: string, input: unknown): ActionGraph {
    const template = this.registry.get(intent);

    const nodes: ActionNode[] = template.nodes.map((node) => ({
      ...node,
      status: "pending",
      retryCount: 0,
      startedAt: undefined,
      completedAt: undefined,
      durationMs: undefined,
      error: undefined,
      output: undefined,
    }));

    const state: ActionState = {
      phase: "planning",
      result: {},
      selectedFiles: [],
      loadedFiles: {},
      changedFiles: [],
      commandResults: [],
      diagnostics: [],
      summaries: {},
      observations: [],
      goals: [
        {
          id: randomUUID(),
          description: String(input),
          status: "pending",
          priority: 1,
        },
      ],
      artifacts: [],
      executionContext: {
        iteration: 0,
        maxIterations: 20,
        startedAt: Date.now(),
        lastExecutedAt: undefined,
        currentNodeId: undefined,
      },
    };

    const graph: ActionGraph = {
      id: randomUUID(),
      intent,
      input,
      nodes,
      edges: template.edges,
      state,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: "1.0.0",
        tags: [intent],
      },
    };

    return graph;
  }
}
