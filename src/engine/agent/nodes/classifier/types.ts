export type InputType = "simple_query" | "complex_spec";

export type Classification = {
  type: InputType;
  confidence: number;
  scores: {
    simple: number;
    complex: number;
  };
  reason?: string;
};

export type LLMClassification = {
  type: InputType;
  confidence: number;
};
