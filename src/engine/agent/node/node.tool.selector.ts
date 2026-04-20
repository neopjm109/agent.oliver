import { zodResponseFormat } from "openai/helpers/zod.js";
import Client from "../../client/client";
import { Tool } from "../tool/types";
import { Task, ToolSelector } from "../types";
import { ToolSelectorSchema } from "../schemas";

const toolSelectorNode = async (
  client: Client,
  task: Task,
  tools: Map<string, Tool>,
): Promise<ToolSelector> => {
  const now = new Date();
  const response = await client.chat({
    messages: [
      { role: "system", content: "" },
      { role: "user", content: "" },
    ],
    format: zodResponseFormat(ToolSelectorSchema, "selector_schema"),
  });

  console.log("----------");
  console.log(response.choices[0].message?.content);
  console.log("----------");

  const selector: any = JSON.parse(response.choices[0].message?.content!!);
  const usage = response.usage;

  return {
    taskId: selector.taskId,
    thought: selector.thought,
    toolName: selector.toolName,
    tokenUsage: {
      promptTokens: usage?.prompt_tokens || 0,
      completionTokens: usage?.completion_tokens || 0,
      totalTokens: usage?.total_tokens || 0,
    },
    duration: now.getTime() - new Date().getTime(),
    completedAt: new Date(),
  };
};

export default toolSelectorNode;
