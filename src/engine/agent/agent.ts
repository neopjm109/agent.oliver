import { classify } from "./nodes/classifier/classifier";
import { Classification } from "./nodes/classifier/types";
import { runReAct, runTool } from "./nodes/execute/execute";
import { planner } from "./nodes/plan/planner";
import { Plan, Task } from "./nodes/plan/types";
import { ToolList } from "./tools";
import { Tool } from "./tools/types";

class Agent {
  // private redis: RedisClient;
  //   private state: AgentState;
  private tools: Tool[] = ToolList;

  // constructor(redis: RedisClient, tools: Tool[]) {
  //   this.redis = redis;
  //   this.tools = tools.reduce((acc: any, cur: Tool) => {
  //     return { ...acc, [cur.definition.name]: cur };
  //   }, {});
  // }

  async run(input: string): Promise<string> {
    try {
      console.log("input", input);
      // 1. Classifier로 단일 쿼리인지, 복잡 쿼리인지 확인
      console.log("// Classification start ------------------------");
      const classification: Classification = await classify(input);
      console.log("Classification type: ", classification.type);
      console.log(JSON.stringify(classification));
      console.log("// Classification end ------------------------");

      // 2. 실행
      if (
        classification.type === "direct_answer" ||
        classification.type === "light_reasoning"
      ) {
        // 단답형이나 Tool만 실행하는 경우
        const toolName = classification.suggestedTool || "simple_llm_response";
        const tool: Tool = this.tools.filter(
          (t) => t.definition.name === toolName,
        )[0];
        const result = await runTool({
          type: classification.type,
          goal: {
            objective: input,
            scope: [],
          },
          tool,
          input,
        });
        return result.result;
      }

      console.log("// Planning start ------------------------");
      const plan: Plan = await planner(input);
      console.log("// Planning end ------------------------");

      let context = "";
      const tasks = flattenTasks(plan.tasks);
      console.log("// runReAct start ------------------------");
      for (const task of tasks) {
        console.log("currentTask: ", JSON.stringify(task));
        const result = await runReAct({
          input,
          tools: this.tools,
          plan: plan,
          currentTask: task,
          prevContext: context,
        });
        context += "\n" + (result.result || "");
        console.log(result);
      }
      console.log("// runReAct end------------------------");
      console.log("Context: ", context);
      return context;
    } catch (e) {
      console.log(e);
      return "응답할 수 없습니다.";
    }
  }
}

function flattenTasks(tasks: Task[]): Task[] {
  const result: Task[] = [];

  function walk(task: Task) {
    if (task.subtasks && task.subtasks.length > 0) {
      for (const sub of task.subtasks) {
        walk(sub);
      }
    } else {
      result.push(task);
    }
  }

  for (const t of tasks) {
    walk(t);
  }

  return result;
}

export default Agent;
