import { classify } from "./core/0.classifier";
import { GraphBuilder } from "./core/1.builder";
import { Scheduler } from "./core/2.scheduler";
import { IntentRegistry } from "./core/intent.registry";
import { ActionGraph } from "./core/types";
import { bootstrapIntentRegistry, bootstrapToolRouter } from "./bootstrap";
import { ToolExecutor } from "./core/3.executor";

export class ActionGraphEngine {
  private intentRegistry: IntentRegistry = bootstrapIntentRegistry();
  private toolExecutor: ToolExecutor = bootstrapToolRouter();
  constructor() {}

  async run(input: string) {
    // 1. Intent classification
    const intent = await classify(input);
    console.log(intent);

    // 2. Graph 생성
    const graphBuilder = new GraphBuilder(this.intentRegistry);
    const graph = graphBuilder.build(intent?.intent, input);
    console.log("graph", graph);

    // 3. System Loop 실행
    const scheduler = new Scheduler(graph, this.toolExecutor);
    const result = await scheduler.run();
    console.log("schedule graph", result);

    // 4. 최종 결과 추출
    return this.extractResult(result);
  }

  private extractResult(graph: ActionGraph) {
    // 가장 마지막 completed node 찾기
    const completedNodes = Array.from(graph.nodes.values()).filter(
      (n) => n.status === "completed",
    );

    // simple heuristic: 마지막 output
    return completedNodes.at(-1)?.output ?? null;
  }
}
