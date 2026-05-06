export type InputType = "simple_query" | "complex_spec";

export type QueryType =
  | "direct_answer"
  | "light_reasoning"
  | "requires_planning";

export interface Classification {
  type: QueryType;
  confidence: number;
  reason: string;
  suggestedTool?: string;
  scores?: Record<string, number>;
}

export type LLMClassification = {
  type: QueryType;
  confidence: number;
  reason: string;
};
