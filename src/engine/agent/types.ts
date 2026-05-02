export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost?: number;
}

// 생각 의도
export type Intent = "search" | "analyze" | "compute" | "verify" | "finish";
