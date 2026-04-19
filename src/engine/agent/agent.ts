import argsGeneratorNode from "./node/node.args.generator";
import observationNode from "./node/node.observation";
import plannerNode from "./node/node.planner";
import summarizerNode from "./node/node.Summarizer";
import toolExecutorNode from "./node/node.tool.executor";
import toolSelectorNode from "./node/node.tool.selector";
import { Tool } from "./tool/types";
import { AgentState } from "./types";

class Agent {
  private state: AgentState;
  private tools: Tool[];

  constructor(tools: Tool[]) {
    this.state = {
      sessionId: new Date().getTime().toString(),
      status: "idle",
      tasks: [],
      results: [],
      currentStep: 0,
      messages: [],
      totalTokenUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      },
      startTime: new Date(),
    };
    this.tools = tools;
  }

  async run(input: string): Promise<string> {
    // Plan
    this.state.status = "planning";
    const planner = await plannerNode(input);
    this.state.tasks = planner.tasks;

    // Excute
    this.state.status = "executing";
    while (this.state.currentStep < this.state.tasks.length) {
      const currentTask = this.state.tasks[this.state.currentStep];

      // Tool Selector
      const selector = await toolSelectorNode(currentTask, this.tools);
      this.state.results.push(selector);

      // Args Generator
      const generator = await argsGeneratorNode(currentTask, selector.toolName);
      this.state.results.push(generator);

      // Tool Executor
      const executor = await toolExecutorNode(
        selector.toolName,
        generator.args,
      );
      this.state.results.push(executor);

      // Observation
      const observation = await observationNode(executor.result);
      this.state.results.push(observation);

      if (observation.nextStep === "break") {
        break;
      } else if (
        observation.nextStep === "add_task" &&
        observation.tasks != null
      ) {
        this.state.tasks.push(...observation.tasks);
      }
      this.state.currentStep++;
    }

    // Summarize
    this.state.status = "summarizing";
    const summarizer = await summarizerNode(this.state);
    this.state.results.push(summarizer);

    this.state.status = "completed";
    this.state.endTime = new Date();

    return summarizer.answer;
  }
}

export default Agent;
