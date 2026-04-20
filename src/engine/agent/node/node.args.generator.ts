import { zodResponseFormat } from "openai/helpers/zod.js";
import Client from "../../client/client";
import { ArgsGenerator, Task } from "../types";
import { ArgsGeneratorSchema } from "../schemas";

const argsGeneratorNode = async (
  client: Client,
  task: Task,
  toolName: string,
): Promise<ArgsGenerator> => {
  const now = new Date();
  const response = await client.chat({
    messages: [
      { role: 'system', content: ""},
      { role: 'user', content: "" }
    ],
    format: zodResponseFormat(ArgsGeneratorSchema, "planner_schema")
  });

  console.log("----------");
  console.log(response.choices[0].message?.content);
  console.log("----------");

  const generator: any = JSON.parse(response.choices[0].message?.content!!);
  const usage = response.usage;

  return {
    taskId: generator.taskId,
    thought: generator.thoguth,
    args: generator.args,
    tokenUsage: {
      promptTokens: usage?.prompt_tokens || 0,
      completionTokens: usage?.completion_tokens || 0,
      totalTokens: usage?.total_tokens || 0,
      estimatedCost: usage?.total_tokens || 0 * 0.01,
    },
    duration: now.getTime() - new Date().getTime(),
    completedAt: new Date(),
  };
};

export default argsGeneratorNode;
