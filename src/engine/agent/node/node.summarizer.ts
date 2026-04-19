import { AgentState, Summarizer } from "../types";

const summarizerNode = async (state: AgentState): Promise<Summarizer> => {
  return {
    answer: "",
    tokenUsage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
  };
};

export default summarizerNode;
