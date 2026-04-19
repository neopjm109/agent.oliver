import { ToolResult } from "../tool/types";
import { Observation } from "../types";

const observationNode = async (
  toolResult: ToolResult,
): Promise<Observation> => {
  return {
    taskId: "",
    thought: "",
    nextStep: "continue",
    tokenUsage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
    duration: 0,
    completedAt: new Date(),
  };
};

export default observationNode;
