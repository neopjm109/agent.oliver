type Intent = "search" | "analyze" | "compute" | "verify" | "finish";

type Step = {
  thought?: string;
  action?: string;
  observation?: string;
};

type ThinkInput = {
  goal: string;
  currentTask?: string; // task의 description

  history: Step[];
  context: string;

  maxSteps?: number;
};

type Thought = {
  intent: Intent;
  reasoning: string;
};
