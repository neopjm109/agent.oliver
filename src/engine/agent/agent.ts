import { classify } from "./nodes/classifier/classifier";
import { Classification } from "./nodes/classifier/types";
import { runReAct } from "./nodes/execute/execute";
import { planner } from "./nodes/plan/planner";
import { Plan } from "./nodes/plan/types";
import { ToolList } from "./tools";
import simpleResponseTool from "./tools/common/simple_response";
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
      if (classification.type === "simple_query") {
        // 2-1. 만약 simple_query인 경우, 바로 simple_llm_response 응답
        console.log("// Simple query start ------------------------");
        const result = await simpleResponseTool.execute({
          input,
        });
        console.log("result: ", result.response);
        console.log("// Simple query end------------------------");
        return result.response || "";
      } else {
        // 2-2. 만약 complex_spec인 경우, Plan을 작성
        console.log("// Planning start ------------------------");
        const plan: Plan = await planner(input);
        console.log("// Planning end ------------------------");

        let context = "";
        console.log("// runReAct start ------------------------");
        for (const task of plan.tasks) {
          console.log("currentTask: ", JSON.stringify(task));
          const result = await runReAct({
            type: classification.type,
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
      }
    } catch (e) {
      console.log(e);
      return "응답할 수 없습니다.";
    }
  }
}

export default Agent;
