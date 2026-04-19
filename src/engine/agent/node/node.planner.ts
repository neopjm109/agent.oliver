import { Planner } from "../types";

/**
 * PlannerNode
 * @description 요구사항을 보고 Task 계획을 세운다
 */
const plannerNode = async (input: string): Promise<Planner> => {
  return {
    tasks: [],
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

export default plannerNode;
