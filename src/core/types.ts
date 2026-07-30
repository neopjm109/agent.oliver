// 공용 타입 정의

export interface ProviderConfig {
  baseURL: string;
  chatModel: string;
  embedModel: string;
  /** 코드 생성 전용 모델(선택). 지정 시 runCodeGen 등 코드 작성 경로만 이 모델을 쓴다. 비우면 chatModel. */
  coderModel?: string;
  /** 라우팅 분류 전용 모델(선택). intent 분류·복합판정만 이 경량 모델로(36% 턴의 지연 절감). 비우면 chatModel. */
  routerModel?: string;
  /** 자유생성(chatText/Stream) 출력 토큰 상한(선택). 장문 폭주로 인한 최악 지연을 묶는다. 비우면 무제한. */
  maxOutputTokens?: number;
  /**
   * 자유생성(chatText/Full/Stream)에서만 qwen3 사고(<think>)를 끈다. Ollama OpenAI호환(/v1)에
   * `reasoning_effort:'none'` 을 실어 사고 토큰 생성을 건너뛴다(실측 218→34토큰). 계획 분해·분류
   * (chatJson)는 사고를 유지 — 그쪽은 사고가 품질을 좌우하기 때문. qwen3 계열에서만 의미(gemma 는 끈다).
   */
  noThinkFreeGen?: boolean;
}

export interface Settings {
  /** 하드웨어 프로필 하나만 바꾸면 M4 ↔ M2 전환 (둘 다 로컬 Ollama). */
  profile: 'm4' | 'm2';
  m4: ProviderConfig;
  m2: ProviderConfig;
  router: { directThreshold: number; unknownThreshold: number; candidateK: number };
  response: { polishWithLlm: boolean; warmChitchat?: boolean };
  skills: { root: string };
  /** 기본 소울(페르소나) 이름 = souls/<이름>.md. 비우면 기본 어시스턴트. 런타임 전환은 세션별. */
  soul?: string;
  /** 감사 로그(JSONL, .cache/audit.jsonl). enabled 기본 true(명시적 false 만 끈다). */
  audit?: { enabled?: boolean };
  /** plan_and_run 계획 상한. maxSteps 미지정 시 4. num_ctx 여유 기준으로 프로필별 조정(m2 보수). */
  plan?: { maxSteps?: number };
}

export interface SlotSpec {
  enum: string[];
}

/** intents.yaml 의 intent 한 건. 1 intent → 1 skill → 1 LLM 호출. */
export interface Intent {
  name: string;
  /** (선택) LLM 분류기용 의미 설명. 없으면 examples 로 대체 */
  description?: string;
  examples: string[];
  /** 실행할 스킬. 리터럴 이름 또는 "{slot}"(슬롯값=스킬명으로 치환). */
  skill: string;
  slot?: Record<string, SlotSpec>;
  notes?: string;
}

/** 대화 한 턴 (사용자 발화 + 어시스턴트 응답) */
export interface Turn {
  user: string;
  assistant: string;
}

/**
 * 파괴적 부작용의 실체 — commitStep 이 실제로 실행/쓰기한다(step.ts). 세션에 담아 턴을 넘긴다.
 * (순환 import 회피: 데이터 타입만 여기 두고, 실행 로직은 step.ts.)
 */
export type MutateCommit =
  | {
      type: 'exec';
      argv: string[];
      cwd: string;
      label: string;
      framework: string;
      /** true 면 성공 시 lastProjectDir/framework 를 기억(scaffold 전용). run_command 등은 미기억. */
      remember?: boolean;
      /**
       * 스캐폴더가 실제로 만들 프로젝트 폴더명(workspace 기준). remember 시 lastProjectDir 로 기억한다.
       * argv 위치는 프레임워크마다 달라(이름이 마지막이 아닌 경우: nest/next/tauri) argv 역추론이 불가능해
       * 빌드 시점에 결정론으로 채워 넘긴다.
       */
      projectDir?: string;
      /** 실행 타임아웃(ms). 빌드·테스트는 길게. 미지정 시 runCommand 기본(120s). */
      timeoutMs?: number;
    }
  | { type: 'editFile'; path: string; content: string }
  | {
      type: 'codeFiles';
      baseDir: string;
      files: Array<{ path: string; content: string }>;
      structure: string[];
      isTs: boolean;
      skipped: string[];
      risky: string[];
    };

/** plan 한 단계 = 등록된 intent(enum) + 그 단계에 넘길 지시. */
export interface PlanStep {
  skill: string;
  instruction: string;
}

/**
 * Human-in-the-loop 실행 계획 — 오케스트레이터가 드는 상태(계획+커서+산출물+게이트).
 * cursor = 다음 실행할 단계, stage = 진행 승인 대기 / 커밋 승인 대기, preview = mutate 커밋 대기분.
 */
export interface StagedPlan {
  goal: string;
  steps: PlanStep[];
  cursor: number;
  outputs: Array<{ skill: string; text: string }>; // 완료 단계 산출물(다음 단계 체이닝)
  stage: 'awaiting_advance' | 'awaiting_commit';
  preview?: { text: string; commit: MutateCommit };
}

/** 멀티턴 세션 상태 (chatId 단위, 짧게 유지) */
export interface SessionState {
  /** 마지막으로 생성/작업한 프로젝트 프레임워크 (spring|nestjs|django|nextjs|flutter|tauri) */
  framework?: string;
  /**
   * 단일턴 부작용 커밋 대기 — scaffold 명령·파일 편집·코드 생성의 미리보기를 보여준 뒤 다음 턴의
   * 응/아니오로 실행/취소한다. (구 pending + pendingEdit 통합)
   */
  pendingStepCommit?: { preview: string; commit: MutateCommit };
  /** 프로젝트명 대기 — 발화에 이름이 없어 되물은 상태. 다음 턴 입력을 이름으로 받는다. */
  awaitingScaffoldName?: { framework: string };
  /** 실행 계획 진행 대기 — human-in-the-loop 상태기계. 오케스트레이터가 단계별로 전진시킨다. */
  pendingPlan?: StagedPlan;
  /** 편집 대상 파일 경로 되묻는 중 — 다음 턴 입력에서 경로를 받는다(원 요청 보관). */
  awaitingEditPath?: { request: string };
  /** 계획 흐름에서 마지막으로 스캐폴드한 프로젝트 폴더(workspace 기준 상대). change_code 단계가 여기로 코드를 저장한다. */
  lastProjectDir?: string;
  /** 최근 대화 히스토리 (최근 N턴만 유지) */
  history?: Turn[];
  /** 런타임 전환된 소울 이름. '' = 명시적 없음(기본 에이전트), undefined = 설정 기본값 사용 */
  soul?: string;
}

/** 파이프라인 실행 컨텍스트 (한 요청 단위) */
export interface Context {
  userText: string;
  chatId?: string;
  /** 요청의 작업 디렉토리 = CLI 를 실행한 위치 (서버 cwd 와 별개). FS 스킬은 이걸 루트로 쓴다. */
  workspace: string;
  slots: Record<string, string>;
  /** 이 세션(workspace or chatId)의 누적 상태 (멀티턴) */
  session?: SessionState;
  /** 최근 대화 히스토리 (현재 턴 제외). 스킬이 문맥 참조에 사용 */
  history: Turn[];
  /** dag 노드들이 누적 산출물을 쌓는 곳 */
  outputs: Array<{ skill: string; result: SkillResult }>;
  /** 발화가 참조한 workspace 파일/컨텍스트(파일 인제스천). 스킬 프롬프트에 주입돼 "붙여넣기 없이" 분석·리뷰가 된다. */
  attachments?: Array<{ label: string; content: string; truncated?: boolean }>;
  /** 활성 소울 본문(페르소나). 대화 표면 스킬만 참조. 없으면 기본 어시스턴트 */
  soul?: string;
  /** 활성 소울 이름 (소울 없으면 undefined) */
  soulName?: string;
  /** 스트리밍 콜백 — 설정 시 텍스트 생성 스킬이 토큰을 오는 대로 흘린다(없으면 비스트리밍). */
  onToken?: (t: string) => void;
}

export interface SkillResult {
  ok: boolean;
  text?: string;
  data?: unknown;
}

/**
 * 전송 경계(서버 TCP·CLI 렌더러)를 오가는 느슨한 응답 형태.
 * 서버 응답(client)·터미널 렌더(tui)가 공유한다. (파이프라인 내부의 엄격한 PipelineResponse 와 별개.)
 */
export interface AgentReply {
  text?: string;
  intent?: string;
  sim?: number;
  ambiguous?: boolean;
  /** 응답 생성에 실행된 스킬 이름들 */
  skills?: string[];
  /** 결과물 파일 절대경로 — 봇은 첨부로 업로드, CLI 는 경로로 안내. */
  files?: string[];
  error?: string;
}

export interface Skill {
  name: string;
  run(ctx: Context): Promise<SkillResult>;
}
