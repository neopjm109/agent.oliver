import { Message } from "../client/types";
import { ToolResult } from "./tool/types";

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface Task {
  taskId: string; // UUID 혹은 정적 ID
  goal: string; // LLM이 이해하기 위한 작업의 목적
  toolName: string; // 실행할 도구의 식별자
  args: Record<string, any>; // (Optional) Plan 단계에서 미리 정의된 인자
  status: "pending" | "running" | "success" | "failed";
  dependsOn: string[]; // 선행 태스크 ID (병렬 처리 설계 시 활용)
}

export interface Planner {
  tasks: Task[];
  thought: string;
  tokenUsage: TokenUsage;
  duration: number;
  completedAt: Date;
}

export interface ToolSelector {
  taskId: string;
  thought: string;
  toolName: string;
  tokenUsage: TokenUsage;
  duration: number;
  completedAt: Date;
}

export interface ArgsGenerator {
  taskId: string;
  thought: string;
  args: any;
  tokenUsage: TokenUsage;
  duration: number;
  completedAt: Date;
}

export interface ToolExecutor {
  taskId: string;
  result: ToolResult;
  tokenUsage: TokenUsage;
  duration: number;
  completedAt: Date;
}

export interface Observation {
  taskId: string;
  thought: string;
  nextStep: "continue" | "add_task" | "break";
  tokenUsage: TokenUsage;
  duration: number;
  completedAt: Date;
  tasks?: Task[];
}

export interface Summarizer {
  answer: string;
  thought: string;
  tokenUsage: TokenUsage;
  duration: number;
  completedAt: Date;
}

export type NodeResult =
  | Planner
  | ToolSelector
  | ArgsGenerator
  | ToolExecutor
  | Observation
  | Summarizer;

export interface AgentState {
  sessionId: string;
  status:
    | "idle"
    | "planning"
    | "executing"
    | "summarizing"
    | "completed"
    | "error"; // 에이전트의 현재 진행 상태
  tasks: Task[]; // Plan Node가 생성한 할 일 목록
  results: NodeResult[]; // Node들의 실행 결과 저장소
  currentStep: number; // 현재 진행 중인 태스크 인덱스
  messages: Message[]; // LLM과의 전체 대화 이력
  totalTokenUsage: TokenUsage; // 비용, 보안, 시간 등 부가 정보
  startTime: Date;
  endTime?: Date;
}
