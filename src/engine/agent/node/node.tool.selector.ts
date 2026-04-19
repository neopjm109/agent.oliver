import { Tool } from "../tool/types";
import { Task, ToolSelector } from "../types";

const toolSelectorNode = async (
  task: Task,
  tools: Tool[],
): Promise<ToolSelector> => {
  return {
    taskId: "",
    thought: "",
    toolName: "",
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

export default toolSelectorNode;
