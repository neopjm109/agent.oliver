import { ArgsGenerator, Task } from "../types";

const argsGeneratorNode = async (
  task: Task,
  toolName: string,
): Promise<ArgsGenerator> => {
  return {
    taskId: "",
    thought: "",
    args: {},
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

export default argsGeneratorNode;
