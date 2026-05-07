import { classify } from "./core/0.classifier";
import { GraphBuilder } from "./core/1.builder";
import { Scheduler } from "./core/2.scheduler";
import { ToolRouter } from "./core/3.executor";
import { IntentRegistry } from "./core/intent.registry";
import { ActionGraph } from "./core/types";
import { bootstrapIntentRegistry, bootstrapToolRouter } from "./bootstrap";

export class ActionGraphEngine {
  private intentRegistry: IntentRegistry = bootstrapIntentRegistry;
  private toolRouter: ToolRouter = bootstrapToolRouter;
  constructor() {}

  async run(input: string) {
    // 1. Intent classification
    const intent = await classify(input);

    // 2. Graph 생성
    const graphBuilder = new GraphBuilder(this.intentRegistry);
    const graph = graphBuilder.build(intent?.intent, input);

    // 3. System Loop 실행
    const scheduler = new Scheduler(graph, this.toolRouter);
    await scheduler.run();

    // 4. 최종 결과 추출
    return this.extractResult(graph);
  }

  private extractResult(graph: ActionGraph) {
    // 가장 마지막 completed node 찾기
    const completedNodes = Array.from(graph.nodes.values()).filter(
      (n) => n.status === "success",
    );

    // simple heuristic: 마지막 output
    return completedNodes.at(-1)?.output ?? null;
  }
}
