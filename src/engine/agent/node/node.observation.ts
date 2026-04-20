import { zodResponseFormat } from "openai/helpers/zod.js";
import Client from "../../client/client";
import { ObservationSchema } from "../schemas";
import { ToolResult } from "../tool/types";
import { Observation } from "../types";

const observationNode = async (
  client: Client,
  toolResult: ToolResult,
): Promise<Observation> => {
  const now = new Date();
  const response = await client.chat({
    messages: [
      { role: 'system', content: ""},
      { role: 'user', content: "" }
    ],
    format: zodResponseFormat(ObservationSchema, "planner_schema")
  });

  console.log("----------");
  console.log(response.choices[0].message?.content);
  console.log("----------");

  const observation: any = JSON.parse(response.choices[0].message?.content!!);
  const usage = response.usage;

  return {
    taskId: observation.taskId,
    thought: observation.thought,
    nextStep: observation.nextStep || "continue",
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

export default observationNode;
