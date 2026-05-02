import { TokenUsage } from "../types";

export interface ToolResult {
  taskId: string;
  toolName: string;
  args: any; // 실제 호출에 사용된 인자
  output: any; // 도구의 반환 값 (JSON; String 등)
  isError: boolean;
  errorMessage?: string;
  duration: number;
  completedAt: Date;
  tokenUsage?: TokenUsage;
}

export interface ToolCall {
  id: string; // OpenAI/Anthropic 표준 ID
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON String
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters?: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  };
}

// 실제 실행될 함수 타입
export type ToolFunction = (args: any) => Promise<any>;

export type Tool = { definition: ToolDefinition; execute: ToolFunction };
