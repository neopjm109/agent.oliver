import z from "zod";

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost?: number;
}

// 생각 의도
export const IntentSchema = z.enum([
  "search",
  "analyze",
  "compute",
  "generate",
  "format",
  "execute",
  "verify",
  "finish",
]);

export type Intent = z.infer<typeof IntentSchema>;
