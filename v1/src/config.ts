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
  /**
   * true(기본) 면 spawn_agent 서브에이전트에 상위 작업 맥락(최초 요청·계획·요약)을 배경으로 넘긴다.
   * 소형 모델이 자족적 task 프롬프트를 못 쓰는 것을 프레임워크가 보완. false 면 Claude Code 식
   * 순수 격리(task 문자열만 전달) — 자족 프롬프트를 잘 쓰는 큰 모델에 적합.
   */
  subagentInheritContext: boolean;
  /** 대화 히스토리를 LLM 에 보내기 전 유지할 대략적 최대 문자 수 (컨텍스트 초과 방지) */
  contextMaxChars: number;
  /** true 면 절삭 대신 오래된 히스토리를 LLM 으로 압축 요약해 세션을 더 오래 유지 */
  contextSummarize: boolean;
  /**
   * true(기본) 면 최상위 요청을 시작할 때 update_plan 만 노출한 별도 LLM 호출로
   * 할 일 목록(Todo)을 먼저 세우고, 이후 매 스텝 계획을 다시 보여주며 다음 단계로 넛지한다.
   * 소형(4B급) 모델의 도구 반복 호출·주제 이탈을 억제하기 위한 장치.
   */
  autoPlan: boolean;
  /**
   * true(기본) 면 최상위 요청이 긴 문서형 답변을 냈는데 이번 턴에 write_file 을 한 번도
   * 쓰지 않았을 때, 그 답변을 작업 폴더에 .md 로 자동 저장한다(소형 모델이 산출물을 파일로
   * 안 남기는 문제 보완). 저장은 write_file 도구를 거치므로 승인 게이트를 그대로 탄다.
   */
  autoSaveArtifacts: boolean;
  /** single = 오케스트레이터 숨기고 리프 스킬만 노출(소형 모델용), orchestrated = 전체 노출 */
  skillMode: "single" | "orchestrated";
  /**
   * true(기본) 면 최상위 요청 시작 시, 프레임워크가 LLM 분류 1회로 요청↔스킬 카테고리 진입점을
   * 매칭해 강하게 맞는 스킬이 있으면 그 지침을 자동 주입한다(하이브리드 스킬 라우터).
   * 소형 모델은 스킬을 자율적으로 못 고르므로, 모델 판단 대신 프레임워크가 결정적으로 로드한다.
   */
  skillRouter: boolean;
  /**
   * CLI 에서 '/<스킬명>' 으로 리프(비-카테고리) 스킬을 직접 호출하도록 허용할지. 기본 false.
   * false 면 CLI 에서는 카테고리 진입점만 직접 호출 가능. (LLM 의 invoke_skill 자율 호출과 무관)
   */
  cliAllowLeafSkill: boolean;
  /** 비활성화할 도구 이름 목록. 공개/서버 배포 시 run_shell·write_file 제거 권장. */
  disabledTools: string[];
  /**
   * 에이전트의 파일/셸 작업 기준 디렉터리(샌드박스 루트).
   * 기본은 실행 위치의 workspaces/ — 산출물이 여기 모이고, 이 밖으로는 접근 불가.
   * workspacePerSession=true 면 실제 작업 폴더는 이 밑의 세션별 하위폴더(cwd/<세션ID>)가 된다.
   */
  cwd: string;
  /** true(기본) 면 세션별로 cwd/<세션ID>/ 하위폴더를 만들어 산출물을 분리 저장한다. */
  workspacePerSession: boolean;
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
  // 0 이면 입력이 같을 때 출력이 글자단위로 동일해져, 소형 모델이 한번 잘못된 되묻기에
  // 빠지면 사용자가 답해도 같은 응답을 무한 반복한다. 약한 무작위성으로 그 고착을 푼다.
  temperature: Number(process.env.LLM_TEMPERATURE ?? "0.4"),
  // 소형 모델의 폭주(무한) 생성을 막는 응답 토큰 상한
  maxTokens: Number(process.env.LLM_MAX_TOKENS ?? "2048"),
  // 로컬 모델은 느릴 수 있으므로 기본 타임아웃을 넉넉히 (5분)
  timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? "300000"),
  maxRetries: Number(process.env.LLM_MAX_RETRIES ?? "2"),
  autoApprove: (process.env.AUTO_APPROVE ?? "false") === "true",
  maxSteps: Number(process.env.MAX_STEPS ?? "25"),
  // 서브에이전트 재귀 깊이 상한 (무한 위임 방지). 소형 모델은 자기완결 작업도 계속 재위임(순수 재위임 폭주)
  // 하므로 기본 2로 낮춰 두 단계까지만 허용한다 — 더 깊은 위임이 필요하면 MAX_DEPTH 로 올린다.
  maxDepth: Number(process.env.MAX_DEPTH ?? "2"),
  // 서브에이전트에 상위 맥락 주입(기본 켜짐, 소형 모델용). 순수 격리 원하면 SUBAGENT_INHERIT_CONTEXT=false
  subagentInheritContext: (process.env.SUBAGENT_INHERIT_CONTEXT ?? "true") !== "false",
  // 히스토리 절삭 예산(문자). 대략 char/4 ≈ 토큰. 기본 24000자(≈6k 토큰).
  contextMaxChars: Number(process.env.CONTEXT_MAX_CHARS ?? "24000"),
  // 절삭 대신 오래된 부분을 압축 요약(기본 켜짐). 끄려면 CONTEXT_SUMMARIZE=false
  contextSummarize: (process.env.CONTEXT_SUMMARIZE ?? "true") !== "false",
  // 시작 시 Todo 계획을 강제로 세우고 매 스텝 리마인드(기본 켜짐, 소형 모델용). 끄려면 AUTO_PLAN=false
  autoPlan: (process.env.AUTO_PLAN ?? "true") !== "false",
  // 긴 문서형 답변을 파일로 안 남기면 자동으로 .md 저장(기본 켜짐). 끄려면 AUTO_SAVE_ARTIFACTS=false
  autoSaveArtifacts: (process.env.AUTO_SAVE_ARTIFACTS ?? "true") !== "false",
  // 소형 모델(4B급)은 오케스트레이터 자율 위임이 어려우므로 single 권장
  skillMode: process.env.SKILL_MODE === "single" ? "single" : "orchestrated",
  // 시작 시 요청에 맞는 스킬을 LLM 분류로 자동 로드(기본 켜짐). 끄려면 SKILL_ROUTER=false
  skillRouter: (process.env.SKILL_ROUTER ?? "true") !== "false",
  // CLI 리프 스킬 직접 호출 — 기본 비활성(카테고리 진입점만). 켜려면 CLI_ALLOW_LEAF_SKILL=true
  cliAllowLeafSkill: (process.env.CLI_ALLOW_LEAF_SKILL ?? "false") === "true",
  disabledTools: (process.env.DISABLED_TOOLS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  // 작업 산출물 저장 위치 = 실행 위치의 workspaces/ (WORKSPACE_DIR 로 변경 가능, 절대경로도 허용).
  // skills·souls·.sessions 는 프로젝트 루트에 그대로 두고, 에이전트 작업만 이 안으로 격리한다.
  cwd: resolve(process.cwd(), process.env.WORKSPACE_DIR ?? "workspaces"),
  // 세션별 하위폴더로 산출물 분리(기본 켜짐). 끄면 모든 세션이 cwd 루트를 공유. WORKSPACE_PER_SESSION=false
  workspacePerSession: (process.env.WORKSPACE_PER_SESSION ?? "true") !== "false",
  skillsDir: resolve(process.cwd(), "skills"),
  soulsDir: resolve(process.cwd(), "souls"),
  sessionsDir: resolve(process.cwd(), ".sessions"),
  port: Number(process.env.PORT ?? "8787"),
  serverToken: process.env.AGENT_SERVER_TOKEN ?? "",
};
