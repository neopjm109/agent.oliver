import { TokenUsage } from "../types";

export const calculateTotalTokenUsage = (
  origin: TokenUsage,
  source: TokenUsage,
) => {
  const promptTokens = origin.promptTokens + source.promptTokens;
  const completionTokens = origin.completionTokens + source.completionTokens;
  const totalTokens = origin.totalTokens + source.totalTokens;
  const estimatedCost =
    origin.estimatedCost || 0 + (totalTokens / 1000000) * 0.01;
  return {
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCost,
  };
};
