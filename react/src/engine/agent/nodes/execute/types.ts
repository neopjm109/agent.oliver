import z from "zod";
import { Intent, IntentSchema } from "../../types";
import { Goal, Task } from "../plan/types";

// Action 횟수
export type Step = {
  thought?: string;
  action?: string;
  observation?: string;
};

export type ThinkInput = {
  goal: Goal;
  currentTask?: string; // task의 description

  history: Step[];
  context: string;

  maxSteps?: number;
};

export type Thought = {
  intent: Intent;
  reasoning: string;
};

export const ThoughtSchema: z.ZodType<Thought> = z.object({
  intent: IntentSchema,
  reasoning: z.string(),
});

export type TaskState = {
  goal: Goal;
  currentTask?: Task;
  history: Step[];
  context: string;
  stepCount: number;
};

export type ObservationType = "info" | "error" | "partial";

export type ObservationSignals = {
  relevance: number; // context와 얼마나 관련 있는가
  reliability: number; // tool 신뢰도
  completeness: number; // 결과가 충분한가
};

export type Observation = {
  raw: string; // 원본 결과 (디버깅용)
  summary: string; // Think 입력용 요약

  success: boolean; // 실행 성공 여부
  type: ObservationType; // 결과 타입

  signals: ObservationSignals;

  retryHint?: string; // retry 시 힌트
};

export type ObservationInput = {
  tool: string;
  result: string;
  context: string;
};

export const ObservationSummarySchema = z.object({
  summary: z.string(),
});

export type Decision = "retry" | "replan" | "continue" | "finish" | "verify";

export type DecisionSignals = {
  success: boolean;
  observationType: "info" | "error" | "partial";
  relevance: number;
  reliability: number;
  completeness: number;
  stepCount: number;
};
