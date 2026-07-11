import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * .env 파일을 로드해 process.env 에 주입한다. (경량 파서 — dotenv 의존성 없음)
 * 이미 환경변수로 설정된 값은 덮어쓰지 않는다.
 */
function loadDotEnv(path = resolve(process.cwd(), ".env")): void {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return; // .env 없으면 조용히 통과
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // 양쪽 따옴표 제거
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

export interface Config {
  baseURL: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  maxRetries: number;
  autoApprove: boolean;
  maxSteps: number;
  maxDepth: number;
  /** 대화 히스토리를 LLM 에 보내기 전 유지할 대략적 최대 문자 수 (컨텍스트 초과 방지) */
  contextMaxChars: number;
  /** true 면 절삭 대신 오래된 히스토리를 LLM 으로 압축 요약해 세션을 더 오래 유지 */
  contextSummarize: boolean;
  /** single = 오케스트레이터 숨기고 리프 스킬만 노출(소형 모델용), orchestrated = 전체 노출 */
  skillMode: "single" | "orchestrated";
  /** 비활성화할 도구 이름 목록. 공개/서버 배포 시 run_shell·write_file 제거 권장. */
  disabledTools: string[];
  cwd: string;
  skillsDir: string;
  soulsDir: string;
  sessionsDir: string;
  port: number;
  serverToken: string;
}

export const config: Config = {
  baseURL: process.env.LLM_BASE_URL ?? "http://localhost:11434/v1",
  apiKey: process.env.LLM_API_KEY ?? "local",
  model: process.env.LLM_MODEL ?? "qwen2.5:14b-instruct",
  temperature: Number(process.env.LLM_TEMPERATURE ?? "0"),
  // 소형 모델의 폭주(무한) 생성을 막는 응답 토큰 상한
  maxTokens: Number(process.env.LLM_MAX_TOKENS ?? "2048"),
  // 로컬 모델은 느릴 수 있으므로 기본 타임아웃을 넉넉히 (5분)
  timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? "300000"),
  maxRetries: Number(process.env.LLM_MAX_RETRIES ?? "2"),
  autoApprove: (process.env.AUTO_APPROVE ?? "false") === "true",
  maxSteps: Number(process.env.MAX_STEPS ?? "25"),
  // 서브에이전트 재귀 깊이 상한 (무한 위임 방지)
  maxDepth: Number(process.env.MAX_DEPTH ?? "3"),
  // 히스토리 절삭 예산(문자). 대략 char/4 ≈ 토큰. 기본 24000자(≈6k 토큰).
  contextMaxChars: Number(process.env.CONTEXT_MAX_CHARS ?? "24000"),
  // 절삭 대신 오래된 부분을 압축 요약(기본 켜짐). 끄려면 CONTEXT_SUMMARIZE=false
  contextSummarize: (process.env.CONTEXT_SUMMARIZE ?? "true") !== "false",
  // 소형 모델(4B급)은 오케스트레이터 자율 위임이 어려우므로 single 권장
  skillMode: process.env.SKILL_MODE === "single" ? "single" : "orchestrated",
  disabledTools: (process.env.DISABLED_TOOLS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  cwd: process.cwd(),
  skillsDir: resolve(process.cwd(), "skills"),
  soulsDir: resolve(process.cwd(), "souls"),
  sessionsDir: resolve(process.cwd(), ".sessions"),
  port: Number(process.env.PORT ?? "8787"),
  serverToken: process.env.AGENT_SERVER_TOKEN ?? "",
};
