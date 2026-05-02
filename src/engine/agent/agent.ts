import { classify } from "./nodes/classifier/classifier";
import { Classification } from "./nodes/classifier/types";
import { runReAct } from "./nodes/execute/execute";
import { planner } from "./nodes/plan/planner";
import { Plan } from "./nodes/plan/types";
import SimpleResponse from "./tools/common/simple_response";
import { Tool } from "./tools/types";
import RedisClient from "./utils/redis";

class Agent {
  // private redis: RedisClient;
  //   private state: AgentState;
  private tools: Tool[] = [SimpleResponse];

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
      const classification: Classification = await classify(input);
      console.log(classification);

      // 2. 실행
      if (classification.type === "simple_query") {
        // 2-1. 만약 simple_query인 경우 바로 실행
        const result = await runReAct({
          type: classification.type,
          input,
          goal: input,
          tools: this.tools,
        });
        console.log(result);
        return result.result || "";
      } else {
        // 2-2. 만약 complex_spec인 경우, Plan을 작성
        const plan: Plan = await planner(input);
        let context = "";

        for (const task of plan.tasks) {
          const result = await runReAct({
            type: classification.type,
            input,
            goal: plan.goal,
            tools: this.tools,
            plan: plan,
            currentTask: task,
            prevContext: context,
          });
          context += "\n" + (result.result || "");
          console.log(result);
        }
        return context;
      }
    } catch (e) {
      console.log(e);
      return "응답할 수 없습니다.";
    }
  }
}

export default Agent;
