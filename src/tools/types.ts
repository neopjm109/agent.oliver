import type { SkillRegistry } from "../skills.js";

/** OpenAI function-calling 파라미터 스키마 (JSON Schema 부분집합) */
export interface JSONSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  // OpenAI SDK 의 FunctionParameters(Record<string, unknown>) 와 호환되도록 인덱스 시그니처 허용
  [key: string]: unknown;
}

/** 작업 계획의 한 단계 */
export interface PlanStep {
  content: string;
  status: "pending" | "in_progress" | "completed";
}

/** 도구 실행 시 주입되는 실행 문맥 */
export interface ToolContext {
  /** 현재 작업 디렉터리(루트 + 하위 workdir). 파일/셸 작업의 기준 경로. */
  cwd: string;
  /** 샌드박스 경계(워크스페이스 루트). cwd 는 이 안에서만 움직이며, 이 밖으로는 접근 불가. */
  root: string;
  /** root 기준 현재 하위 작업 폴더(표시용, 기본 ""=루트). */
  workdir: string;
  /** 이후 작업의 기준 폴더를 바꾼다(cd 처럼 지속). root 밖이거나 없는 폴더면 throw. 반환: 새 workdir. */
  setWorkdir(sub: string): string;
  skills: SkillRegistry;
  /** 위험한 작업에 대한 사용자 승인 요청. true 면 진행. */
  requestPermission(action: string, detail: string): Promise<boolean>;
  /** 진행 상황을 사용자에게 출력 */
  log(message: string): void;
  /** 현재 에이전트의 재귀 깊이 (0 = 최상위) */
  depth: number;
  /** 하위 작업을 처리할 서브에이전트를 실행하고 최종 결과를 반환 */
  spawnAgent(task: string): Promise<string>;
  /** 작업 계획(할 일 목록)을 통째로 갱신한다 */
  setPlan(steps: PlanStep[]): void;
  /** 현재 계획을 반환한다 */
  getPlan(): PlanStep[];
}

/**
 * 도구 실행 결과. 대부분의 도구는 문자열만 반환하면 되지만, 승인이 필요한 도구는
 * '거부됨'을 문자열 문구가 아니라 타입 있는 플래그로 알린다 — 호출부(자동 저장 등)가
 * 문구 매칭 대신 denied 로 판별하도록 해, 문구가 바뀌어도 깨지지 않게 한다.
 */
export interface ToolResult {
  /** LLM 히스토리에 들어갈 텍스트 (기존 문자열 반환과 동일한 내용) */
  content: string;
  /** 사용자가 승인을 거부해 실행되지 않았음 */
  denied?: boolean;
}

/** 에이전트가 호출할 수 있는 하나의 도구 */
export interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  /** 파일 쓰기/셸 실행처럼 승인이 필요한 도구 여부 */
  dangerous?: boolean;
  /** 문자열(대부분) 또는 구조화된 ToolResult(승인 거부 등을 알릴 때)를 반환한다. */
  run(args: Record<string, any>, ctx: ToolContext): Promise<string | ToolResult>;
}

/** 도구 반환값(문자열 | ToolResult)을 항상 ToolResult 로 정규화한다. */
export function toToolResult(r: string | ToolResult): ToolResult {
  return typeof r === "string" ? { content: r } : r;
}

/** OpenAI chat.completions 의 tools 배열 항목으로 직렬화 */
export function toOpenAITool(tool: Tool) {
  return {
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}
