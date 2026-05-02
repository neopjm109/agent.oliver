import Client from "../client/client";
import argsGeneratorNode from "./node/node.args.generator";
import observationNode from "./node/node.observation";
import plannerNode from "./node/node.planner";
import summarizerNode from "./node/node.summarizer";
import toolExecutorNode from "./node/node.tool.executor";
import toolSelectorNode from "./node/node.tool.selector";
import { Tool } from "./tool/types";
import { AgentState } from "./types";
import RedisClient from "./utils/redis";
import { calculateTotalTokenUsage } from "./utils/utils";

class Agent {
  private client: Client;
  private redis: RedisClient;
  private state: AgentState;
  private tools: Map<string, Tool> = new Map();

  constructor(redis: RedisClient, tools: Tool[]) {
    this.client = new Client();
    this.redis = redis;
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
    this.tools = tools.reduce((acc: any, cur: Tool) => {
      return { ...acc, [cur.definition.name]: cur };
    }, {});
  }

  async run(input: string): Promise<string> {
    // Plan
    this.state.status = "planning";
    this.redis.saveState(this.state);
    const planner = await plannerNode(this.client, input);
    this.state.tasks = planner.tasks;
    this.state.results.push(planner);
    this.state.totalTokenUsage = calculateTotalTokenUsage(
      this.state.totalTokenUsage,
      planner.tokenUsage,
    );
    this.redis.saveState(this.state);

    // Excute
    this.state.status = "executing";
    this.redis.saveState(this.state);
    while (this.state.currentStep < this.state.tasks.length) {
      const currentTask = this.state.tasks[this.state.currentStep];

      // Tool Selector
      const selector = await toolSelectorNode(
        this.client,
        currentTask,
        this.tools,
      );
      this.state.results.push(selector);
      this.state.totalTokenUsage = calculateTotalTokenUsage(
        this.state.totalTokenUsage,
        selector.tokenUsage,
      );
      this.redis.saveState(this.state);
      const tool = this.tools.get(selector.toolName)!!;

      // Args Generator
      const generator = await argsGeneratorNode(this.client, currentTask, tool);
      this.state.results.push(generator);
      this.state.totalTokenUsage = calculateTotalTokenUsage(
        this.state.totalTokenUsage,
        generator.tokenUsage,
      );
      this.redis.saveState(this.state);

      // Tool Executor
      const executor = await toolExecutorNode(
        currentTask.taskId,
        tool,
        generator.args,
      );
      this.state.results.push(executor);
      this.state.totalTokenUsage = calculateTotalTokenUsage(
        this.state.totalTokenUsage,
        executor.tokenUsage,
      );
      this.redis.saveState(this.state);

      // Observation
      const observation = await observationNode(this.client, executor.result);
      this.state.results.push(observation);
      this.state.totalTokenUsage = calculateTotalTokenUsage(
        this.state.totalTokenUsage,
        observation.tokenUsage,
      );
      this.redis.saveState(this.state);

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
    this.redis.saveState(this.state);
    const summarizer = await summarizerNode(this.client, this.state);
    this.state.results.push(summarizer);
    this.state.totalTokenUsage = calculateTotalTokenUsage(
      this.state.totalTokenUsage,
      summarizer.tokenUsage,
    );
    this.redis.saveState(this.state);

    this.state.status = "completed";
    this.state.endTime = new Date();

    return summarizer.answer;
  }
}

export default Agent;
