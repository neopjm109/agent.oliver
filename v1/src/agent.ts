import { readdirSync, existsSync, statSync, readFileSync, mkdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import type { Config } from "./config.js";
import type { LLM, ChatCompletionMessageParam, ChatCompletionToolChoiceOption } from "./llm.js";
import { renderSkillInstructions, type SkillRegistry, type Skill } from "./skills.js";
import { toOpenAITool, toToolResult, type Tool, type ToolContext, type PlanStep } from "./tools/types.js";
import { toolMap } from "./tools/index.js";
import { renderPlan } from "./tools/plan.js";
import { systemPrompt } from "./agent-prompt.js";
import {
  messageSize,
  splitHistory,
  truncateHistory,
  stableStringify,
  normalizeForCompare,
  looksLikeStall,
  stripTextToolCalls,
  isContextOverflow,
  summarizeArgs,
  interimPointer,
  interimPointerSaved,
  artifactFilename,
  pad2,
  maxArtifactSeq,
  topicSlug,
  claimedButMissing,
  extractFilenames,
  collectWorkspaceFiles,
} from "./agent-utils.js";

/** LLM 완성 호출의 반환 타입(assistant 메시지 + 선택적 tool_calls). */
type CompletionMessage = Awaited<ReturnType<LLM["complete"]>>;

export interface AgentDeps {
  llm: LLM;
  tools: Tool[];
  skills: SkillRegistry;
  config: Config;
  requestPermission: ToolContext["requestPermission"];
  log: (msg: string) => void;
  /** 이어서 진행할 이전 대화(시스템 메시지 제외). 영속화된 세션 복원 시 사용. */
  history?: ChatCompletionMessageParam[];
  /** 재귀 깊이 (서브에이전트가 증가). 최상위는 0. */
  depth?: number;
  /** 선택된 페르소나(SOUL) 본문. 없으면 일반 모드. 서브에이전트도 상속한다. */
  soul?: string | null;
  /** 복원된 누적 요약(압축된 오래된 맥락). 세션 복원 시 사용. */
  summary?: string;
  /** 복원된 작업 하위 폴더(change_dir). 세션 복원 시 마지막 작업 폴더로 시작. */
  workdir?: string;
}

/**
 * 이번 사용자 턴(run 1회) 동안만 유효한 임시 상태.
 * run() 시작마다 통째로 새로 만들어(resetRunState) 이전 턴 상태가 새는 것을 원천 차단한다.
 * (필드를 하나씩 초기화하다 빠뜨리면 초기상태 회귀·되묻기 반복 버그가 났었다.)
 */
class TurnState {
  /** 이번 턴에 발동한 스킬 이름들 (라우팅·invoke_skill 로 로드된 것) */
  usedSkills = new Set<string>();
  /** (도구+인자) 조합별 호출 횟수 — 동일 호출 반복(루프) 억제용 */
  toolCallCounts = new Map<string, number>();
  /** update_plan 만 연달아 호출한 턴 수 — 계획만 갱신하고 실제 작업을 안 하는 루프 억제용 */
  planOnlyStreak = 0;
  /** 이번 턴에 write_file 로 파일을 저장했는지 — 산출물 자동 저장 여부 판단용 */
  wroteFile = false;
  /** 자동 저장한 중간 산출물의 제목 키 — 중복 저장 방지용 */
  savedArtifacts = new Set<string>();
  /** 자동 저장 파일명 앞에 붙일 두 자리 순번(01,02…). 폴더의 기존 최대 번호에서 이어감 */
  artifactSeq = 0;
  /** 이번 턴의 계획(Todo). update_plan 도구로 갱신된다. */
  plan: PlanStep[] = [];
  /** 계획의 모든 단계 완료 후 '최종 답변 작성' 넛지를 이미 1회 주입했는지 — 완료 상태에서 매 스텝 반복 주입 방지 */
  finalizeNudged = false;
  /** 크로스턴/중도이탈 교정을 이미 1회 수행했는지 (무한 재시도 방지) */
  loopBroken = false;
  /** 산출물 검증(#2): 보고된 파일이 실제로 없어 재생성/정정을 이미 1회 지시했는지 (무한 재시도 방지) */
  groundingRetried = false;
  /** 메인 루프에서 도구를 한 번이라도 호출했는지 — '도구 쓰다 중도 종료'와 '순수 대화 종료' 구분용 */
  calledTool = false;
  /**
   * 컨텍스트 초과를 만나면 이번 턴 동안만 낮춰 잡는 실효 히스토리 예산(문자). null 이면 config 값 사용.
   * 매 run() 시작 시 새 TurnState 로 원복된다 — 일회성 초과가 세션 전체 맥락을 계속 굶기지 않도록.
   */
  budgetOverride: number | null = null;
}

/**
 * 대화 상태를 유지하는 에이전트.
 * run() 을 반복 호출하면 멀티턴 대화가 이어진다.
 */
export class Agent {
  // ── 턴을 넘어 유지되는 상태 ────────────────────────────────────────────────
  private messages: ChatCompletionMessageParam[];
  private tools: Map<string, Tool>;
  private openaiTools;
  private depth: number;
  /** 기본 시스템 프롬프트(요약 블록 제외) */
  private baseSystem: string;
  /** 압축된 오래된 대화의 누적 요약 */
  private summary: string;
  /** 루트(config.cwd) 기준 현재 작업 하위 폴더. change_dir 로 바뀌며 턴을 넘어 유지된다. "" = 루트. */
  private workdir: string;
  /** 직전 '턴'의 최종(무-도구) 응답 정규화본 — 턴을 넘어 같은 응답을 반복하는 루프 감지용 */
  private lastFinalResponse = "";

  // ── 이번 턴 한정 임시 상태 ─────────────────────────────────────────────────
  private turn = new TurnState();

  /** 작업 폴더 스냅샷 메시지의 표식 — 턴마다 최신 하나만 남기려 이전 것을 이 접두사로 찾아 제거한다. */
  private static readonly WD_SNAPSHOT = "【현재 작업 폴더 상태】";

  constructor(private deps: AgentDeps) {
    this.tools = toolMap(deps.tools);
    this.openaiTools = deps.tools.map(toOpenAITool);
    this.depth = deps.depth ?? 0;
    this.baseSystem = systemPrompt(deps.skills, deps.soul);
    this.summary = deps.summary ?? "";
    this.workdir = deps.workdir ?? "";
    // 시스템 메시지(요약 포함) + 복원된 대화
    this.messages = [{ role: "system", content: "" }, ...(deps.history ?? [])];
    this.applySystem();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 시스템 메시지 · 영속화 접근자
  // ───────────────────────────────────────────────────────────────────────────

  /** baseSystem + 누적 요약을 합쳐 messages[0](system)을 갱신한다 */
  private applySystem(): void {
    const block = this.summary
      ? `\n\n## 이전 대화 요약 (오래된 맥락을 압축한 것; 사실로 취급)\n${this.summary}`
      : "";
    this.messages[0] = { role: "system", content: this.baseSystem + block };
  }

  /** 누적 요약 (영속화용) */
  getSummary(): string {
    return this.summary;
  }

  /** 현재 작업 하위 폴더 (영속화용) */
  getWorkdir(): string {
    return this.workdir;
  }

  /** 시스템 메시지를 제외한 대화 내역 (영속화용). 일시적 작업폴더 스냅샷은 매 턴 새로 주입하므로 저장하지 않는다. */
  exportHistory(): ChatCompletionMessageParam[] {
    return this.messages.filter(
      (m) =>
        m.role !== "system" &&
        !(m.role === "user" && typeof m.content === "string" && m.content.startsWith(Agent.WD_SNAPSHOT)),
    );
  }

  /** 직전 run() 에서 발동한 스킬 이름 목록 */
  getUsedSkills(): string[] {
    return [...this.turn.usedSkills];
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 작업 폴더 (workdir) · 스냅샷
  // ───────────────────────────────────────────────────────────────────────────

  private ctx(): ToolContext {
    const root = this.deps.config.cwd;
    return {
      cwd: resolve(root, this.workdir), // 현재 작업 폴더 = 루트 + 하위 workdir
      root,
      workdir: this.workdir,
      setWorkdir: (sub) => this.setWorkdir(sub),
      skills: this.deps.skills,
      requestPermission: this.deps.requestPermission,
      log: this.deps.log,
      depth: this.depth,
      spawnAgent: (task) => this.spawnChild(task),
      setPlan: (steps) => {
        this.turn.plan = steps;
        this.deps.log(renderPlan(steps));
      },
      getPlan: () => this.turn.plan,
    };
  }

  /**
   * 이후 파일/셸 작업의 기준 하위 폴더(workdir)를 바꾼다. cd 와 달리 다음 호출에도 지속된다.
   * sub 는 현재 workdir 기준 상대경로. 워크스페이스 루트 밖이거나 없는 폴더면 예외.
   */
  private setWorkdir(sub: string): string {
    const root = this.deps.config.cwd;
    const target = resolve(root, this.workdir, sub);
    const rel = relative(root, target);
    if (rel.startsWith("..")) {
      throw new Error(`작업 폴더는 워크스페이스(${root}) 밖으로 나갈 수 없습니다.`);
    }
    if (rel && (!existsSync(target) || !statSync(target).isDirectory())) {
      throw new Error(`폴더가 없습니다: ${rel} (먼저 생성하거나 경로를 확인하세요)`);
    }
    this.workdir = rel; // "" 이면 루트
    this.deps.log(`  ↳ 작업 폴더: ${rel || "(루트)"}`);
    return rel || ".";
  }

  /**
   * 새 최상위 작업이 시작될 때, 세션 워크스페이스 루트 밑에 토픽 전용 하위폴더(`NN-slug`)를
   * 만들어 작업 폴더로 삼는다. 한 세션에서 여러 주제가 산출물을 한 폴더에 섞어 오염시키는 것을 막는다.
   * (이어가기 턴은 prepareTurn 초반에 이미 return 되므로 여기 도달하지 않아 기존 폴더를 유지한다.)
   * slug 는 매칭된 스킬명 또는 사용자 요청에서 뽑는다. 폴더 생성 실패 시 조용히 기존 workdir 를 유지한다.
   */
  private startTopicWorkdir(label: string): void {
    const root = this.deps.config.cwd;
    const name = `${pad2(maxArtifactSeq(root) + 1)}-${topicSlug(label)}`;
    try {
      mkdirSync(resolve(root, name), { recursive: true });
      this.workdir = name; // 루트 기준 안전한 단일 slug → 곧장 대입(경계 밖일 수 없음)
      this.deps.log(`  ↳ 새 작업 폴더: ${name}`);
      // 새 빈 폴더를 반영하도록 작업폴더 스냅샷을 갱신한다(이전 토픽 파일이 있다고 오인 방지).
      this.injectWorkdirSnapshot();
    } catch {
      /* 폴더 생성 실패 → 기존 workdir 유지 */
    }
  }

  /**
   * 현재 작업 폴더(root+workdir)의 얕은 목록과 감지된 프로젝트 유형을 요약한다.
   * 소형 모델이 "여기 이미 프로젝트가 있다"는 사실을 인지하지 못해 create-* 로
   * 새 프로젝트를 중첩 생성(myapp/myapp)하거나 엉뚱한 곳에 파일을 흩뿌리는 실수를
   * 막기 위한 선제적 맥락. 폴더가 비어 있으면 빈 문자열(주입 안 함).
   */
  private describeWorkdir(): string {
    const root = this.deps.config.cwd;
    const dir = resolve(root, this.workdir);
    const here = this.listSignals(dir);
    if (here === null) return ""; // 폴더가 아직 없음(첫 작업) → 스냅샷 없음

    // (1) 현재 폴더에 신호성 항목이 있음 → "이미 프로젝트가 있다"를 알려 중첩 스캐폴딩·파일 흩뿌림을 막는다.
    if (here.shown.length) {
      const project = this.detectProject(dir, here.raw);
      const loc = this.workdir ? `워크스페이스 루트 기준 '${this.workdir}'` : "워크스페이스 루트";
      const lines = [
        Agent.WD_SNAPSHOT,
        `현재 작업 폴더(${loc})에 이미 다음 항목들이 있습니다:`,
        "  " + here.shown.join("  ") + here.more,
      ];
      if (project) {
        lines.push(
          `이 폴더는 이미 **${project}** 프로젝트로 구성되어 있습니다.`,
          "→ 새 프로젝트를 스캐폴딩(create-next-app·npm init 등)하지 말고, **기존 구조를 그대로 활용해 파일을 수정/추가**하세요. " +
            "필요하면 먼저 관련 파일을 read_file 로 확인한 뒤 진행하세요.",
        );
      }
      return lines.join("\n");
    }

    // (2) 현재 폴더가 비어 있고 루트임 → 알릴 것 없음(기존 동작).
    if (!this.workdir) return "";

    // (3) 새로 만든 빈 토픽 하위폴더 → 상위(워크스페이스 루트) 내용을 알려, 사용자가 준 입력 파일을
    //     '../' 로 찾게 한다. 이 안내가 없으면 모델이 루트 기준 상대경로('prd/x.md')를 그대로 써서
    //     cwd(하위폴더) 밑에서 빗나가 실패한다(모든 도구·run_shell 공통). 예방적 컨텍스트.
    const head = `현재 작업 폴더는 새로 만든 빈 폴더 '${this.workdir}'(워크스페이스 루트 하위)입니다. 새 산출물은 이 폴더에 저장하세요.`;
    const parent = this.listSignals(root);
    if (!parent || !parent.shown.length) return [Agent.WD_SNAPSHOT, head].join("\n");
    return [
      Agent.WD_SNAPSHOT,
      head,
      `워크스페이스 루트(상위 '..')에는 다음이 있습니다:`,
      "  " + parent.shown.join("  ") + parent.more,
      "→ 사용자가 언급한 입력 파일이 현재 폴더에 없으면 상위 경로 '../' 를 붙여 참조하세요(예: '../prd/x.md'). " +
        "read_file·list_dir 은 경로가 빗나가도 워크스페이스에서 파일명으로 자동으로 찾아 실제 경로를 알려줍니다.",
    ].join("\n");
  }

  /**
   * dir 의 신호성 항목(노이즈 폴더·숨김파일 제외)을 폴더 우선·이름순으로 정렬해
   * 표시 문자열(shown)·잔여 표기(more)·원본 목록(raw, detectProject 용)으로 돌려준다.
   * dir 이 없으면 null. describeWorkdir 가 현재 폴더와 상위 루트에 공통으로 쓴다.
   */
  private listSignals(dir: string): { shown: string[]; more: string; raw: string[] } | null {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return null;
    }
    const IGNORE = new Set([".git", "node_modules", ".next", "dist", "build", ".turbo", ".cache"]);
    const items = entries
      .filter((e) => !IGNORE.has(e) && (!e.startsWith(".") || e === ".env"))
      .map((name) => {
        let isDir = false;
        try {
          isDir = statSync(resolve(dir, name)).isDirectory();
        } catch {
          /* 접근 불가 항목은 파일로 간주 */
        }
        return { name, isDir };
      })
      .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
    const CAP = 40;
    const shown = items.slice(0, CAP).map((i) => (i.isDir ? i.name + "/" : i.name));
    const more = items.length > CAP ? ` …외 ${items.length - CAP}개` : "";
    return { shown, more, raw: entries };
  }

  /** package.json 의존성·설정 파일·언어 마커로 프로젝트 유형을 추정한다. 못 찾으면 null. */
  private detectProject(dir: string, entries: string[]): string | null {
    const has = (n: string) => entries.includes(n);
    let pkg: any = null;
    if (has("package.json")) {
      try {
        pkg = JSON.parse(readFileSync(resolve(dir, "package.json"), "utf8"));
      } catch {
        /* 깨진 package.json 은 무시 */
      }
    }
    const deps: Record<string, string> = pkg
      ? { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
      : {};
    const nextCfg = entries.some((e) => /^next\.config\.(js|ts|mjs|cjs)$/.test(e));
    if (deps.next || nextCfg) return "Next.js";
    if (deps.nuxt) return "Nuxt";
    if (deps["@remix-run/react"]) return "Remix";
    if (deps["@angular/core"]) return "Angular";
    if (deps["react-native"] || deps.expo) return "React Native";
    if (deps["@nestjs/core"]) return "NestJS";
    if (deps.vue) return "Vue";
    if (deps.svelte) return "Svelte";
    if (deps.react) return "React";
    if (has("Cargo.toml")) return "Rust";
    if (has("go.mod")) return "Go";
    if (has("pom.xml") || has("build.gradle") || has("build.gradle.kts")) return "Java/Kotlin";
    if (has("pyproject.toml") || has("requirements.txt")) return "Python";
    if (pkg) return "Node.js";
    return null;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 서브에이전트 위임
  // ───────────────────────────────────────────────────────────────────────────

  /** 하위 작업을 처리할 서브에이전트를 생성해 실행하고 최종 텍스트를 반환 */
  private async spawnChild(task: string): Promise<string> {
    if (this.depth + 1 > this.deps.config.maxDepth) {
      return `서브에이전트 최대 깊이(${this.deps.config.maxDepth})를 초과해 위임할 수 없습니다. 직접 처리하세요.`;
    }
    // 서브에이전트는 새 대화로 시작(격리)하되, 상위 작업의 '목표·계획·요약'을 압축해 배경으로 넘겨
    // 완전히 눈먼 채로 돌지 않게 한다. (파일은 같은 cwd 를 공유하지만 대화 맥락은 공유되지 않으므로,
    // 모델이 task 에 문맥을 안 담아도 프레임워크가 큰 그림을 보장한다.)
    const child = new Agent({
      ...this.deps,
      history: undefined,
      // 설정에 따라 상위 맥락을 배경으로 넘기거나(소형 모델용) 순수 격리(Claude Code 식)로 둔다.
      summary: this.deps.config.subagentInheritContext ? this.childContext() : undefined,
      depth: this.depth + 1,
    });
    child.workdir = this.workdir; // 상위와 같은 작업 폴더에서 시작 (프로젝트 하위 폴더 이어받기)
    return child.run(task);
  }

  /** 서브에이전트에 넘길 상위 컨텍스트(원 요청 목표 + 현재 계획 + 누적 요약)를 압축한다. */
  private childContext(): string | undefined {
    const firstUser = this.messages.find(
      (m) => m.role === "user" && !(typeof m.content === "string" && m.content.startsWith(Agent.WD_SNAPSHOT)),
    );
    const goal = typeof firstUser?.content === "string" ? firstUser.content.slice(0, 500) : "";
    const plan = this.turn.plan.length ? renderPlan(this.turn.plan) : "";
    const ctx = [
      this.summary,
      goal && `상위 작업의 최초 요청/목표:\n${goal}`,
      plan && `상위 작업의 계획과 진행 상황:\n${plan}`,
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 1500);
    return ctx || undefined;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 컨텍스트 압축 (요약/절삭)
  // ───────────────────────────────────────────────────────────────────────────

  /** 실효 히스토리 예산(문자). 컨텍스트 초과로 낮춰졌으면 그 값을, 아니면 config 값을 쓴다. */
  private budgetChars(): number {
    return this.turn.budgetOverride ?? this.deps.config.contextMaxChars;
  }

  /** 시스템 메시지를 제외한 현재 히스토리의 대략적 문자 크기 — 5xx 가 실제 컨텍스트 초과인지 판단용. */
  private historyChars(): number {
    let n = 0;
    for (let i = 1; i < this.messages.length; i++) n += messageSize(this.messages[i]);
    return n;
  }

  /**
   * 컨텍스트 예산을 넘으면 오래된 히스토리를 처리한다.
   * contextSummarize=true 면 버릴 부분을 LLM 으로 요약해 누적 요약에 반영(세션 유지),
   * 아니면 그냥 잘라낸다. 요약 실패 시 절삭으로 폴백한다.
   */
  private async compact(): Promise<void> {
    const budget = this.budgetChars();
    const { dropped, kept } = splitHistory(this.messages, budget);
    if (dropped.length === 0) return; // 예산 내 — 할 일 없음

    if (this.deps.config.contextSummarize) {
      try {
        this.summary = await this.summarize(dropped);
        this.applySystem();
      } catch {
        /* 요약 실패 → 아래에서 그냥 절삭 */
      }
    }
    this.messages = [this.messages[0], ...kept];
  }

  /** 버려질 메시지들을 기존 요약과 합쳐 간결한 누적 요약으로 만든다 (도구 없는 LLM 호출) */
  private async summarize(dropped: ChatCompletionMessageParam[]): Promise<string> {
    const convo = dropped
      .map((m) => {
        const c = typeof m.content === "string" ? m.content : "";
        const tc = (m as any).tool_calls?.length ? " [도구호출]" : "";
        return `${m.role}: ${c}${tc}`;
      })
      .join("\n")
      .slice(0, 8000);
    const msg = await this.deps.llm.complete(
      [
        {
          role: "system",
          content:
            "너는 대화 요약기다. [기존 요약]과 [추가 대화]를 하나로 합쳐, 이후 대화에 필요한 " +
            "핵심 사실·사용자 선호·결정·미해결 과제만 담은 한국어 요약을 만들어라. " +
            "500자 이내, 불릿 형태, 군더더기 금지. 요약문만 출력한다.",
        },
        {
          role: "user",
          content: `[기존 요약]\n${this.summary || "(없음)"}\n\n[추가 대화]\n${convo}`,
        },
      ],
      [],
    );
    return (msg.content?.trim() || this.summary).slice(0, 2000);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 선처리 단일 분류 (스킬 라우팅 + 작업 여부를 한 번의 LLM 호출로)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * 스킬 라우팅·자동 계획을 건너뛰어야 하는 '자명한' 입력인지 판정한다(LLM 호출 없이 값싸게).
   * (1) 아주 짧은 입력, (2) 앞이 이어가기어로 시작, (3) 문장 어디든 '기존 작업 이어가기' 신호.
   * 이어가기는 새 스킬 로드·재계획 없이 현재 세션 맥락/파일로 이어가야 한다
   * (예: "sudoku-game 진행하던거 계속" 을 엉뚱한 스킬로 라우팅해 작업이 장악당하던 문제 방지).
   * Korean 은 \b 가 안 먹어 시작형은 뒤에 공백/끝/문장부호를 명시. 6자 임계로 짧은 정식 요청은 허용.
   */
  private isTrivialOrContinuation(input: string): boolean {
    const continuationStart =
      /^(진행|다음|계속|계속해|이어|이어서|이전|마저|아까|그다음|continue|go|ok|네|응|그래|yes|더)(\s|$|[.,!?])/i;
    const continuationRef = /(진행하던|하던\s?거|하던\s?것|이어서\s?(진행|해|만들|작업)|계속\s?(진행|해|만들|작업)|이어\s?진행)/;
    return input.length < 6 || continuationStart.test(input) || continuationRef.test(input);
  }

  /** '위 문서/방금 만든/누락됐다' 처럼, 방금 한 작업의 산출물을 가리키는(파일명 없이도) 후속 신호. */
  private static readonly PRIOR_WORK_CUE =
    /(이전|방금|아까|위\s?(문서|파일|내용|결과|산출물)|다시\s?(만들|생성|정리|작성|해)|아직|안\s?만들|못\s?만들|누락|빠[졌진]|안\s?(된|됨|보[이여]))/;

  /**
   * 직전 턴에서 만든 '현재 토픽 작업 폴더'의 산출물을 가리키는 후속 요청인지 판정한다(#5).
   * 참이면 새 토픽 폴더 발급·스킬 재라우팅을 건너뛰고 현재 폴더/맥락에서 이어간다 —
   * "api-spec.md 가 안 만들어졌다" 같은 교정 요청이 '새 작업'으로 오인돼 딴 스킬(docs-analyze 등)에
   * 장악되고 산출물이 다른 폴더로 흩어지던 문제를 막는다. 결정론적 신호만 쓴다(LLM 호출 없음).
   * 오탐 시 손해는 '새 폴더 대신 현재 폴더에서 이어감' 정도라, 폴더 오염 위험보다 맥락 상실 위험을 우선한다.
   */
  private continuesCurrentTopic(input: string): boolean {
    if (!this.workdir) return false; // 아직 토픽 폴더 없음(첫 작업) → 이어갈 대상 없음
    let present: Set<string>;
    try {
      present = collectWorkspaceFiles(resolve(this.deps.config.cwd, this.workdir));
    } catch {
      return false;
    }
    if (!present.size) return false; // 현재 폴더에 산출물이 없음 → 이어갈 것 없음
    const mentioned = extractFilenames(input);
    // (a) 언급한 파일이 현재 폴더에 이미 있음 → 그 산출물의 후속
    if (mentioned.some((f) => present.has(f.toLowerCase()))) return true;
    // (b) 언급한 파일이 현재 폴더 산출물과 같은 확장자 → 같은 산출물 계열의 후속(아직 안 만든 형제 파일 포함).
    //     단, 그 파일이 워크스페이스 다른 곳(예: prd/2-nestjs.md 같은 입력 파일)에 이미 존재하면,
    //     그건 '새 작업의 입력'이지 방금 만든 산출물의 형제가 아니므로 이어가기로 보지 않는다.
    //     ("prd/2-nestjs.md 를 읽고 산출물 만들어" 가 확장자(.md)만 겹쳐 blueprint 토픽의 후속으로 오인돼
    //      nestjs 산출물이 같은 폴더에 섞이고 스킬 재라우팅이 스킵되던 교차 오염 버그를 막는다.)
    const ext = (n: string) => n.slice(n.lastIndexOf(".")).toLowerCase();
    const presentExts = new Set([...present].map(ext));
    let elsewhere: Set<string> | null = null;
    try {
      elsewhere = collectWorkspaceFiles(this.deps.config.cwd); // 세션 전체(입력 파일 포함)
    } catch {
      /* 스캔 실패 시 입력 파일 판별 없이 진행 */
    }
    const isInputElsewhere = (f: string) =>
      elsewhere !== null && elsewhere.has(f.toLowerCase()) && !present.has(f.toLowerCase());
    if (mentioned.some((f) => f.includes(".") && presentExts.has(ext(f)) && !isInputElsewhere(f)))
      return true;
    // (c) 파일명이 없어도 '방금 한 작업'을 가리키는 교정/참조 신호가 있으면 후속으로 본다
    if (Agent.PRIOR_WORK_CUE.test(input)) return true;
    return false;
  }

  /**
   * 선처리 단일 분류: 한 번의 도구 없는 LLM 호출로 (1) 요청에 가장 맞는 스킬과
   * (2) 계획이 필요한 '실제 작업'인지를 동시에 판정한다.
   * 예전엔 classifySkill·needsPlan 두 번을 호출해 같은 입력을 중복 분류했다(SKILL_ROUTER+AUTO_PLAN
   * 동시 사용 시 왕복 2회) — 하나로 합쳐 왕복 1회로 줄였다.
   *
   * 번호 하나만 출력하게 해 소형 모델에서도 견고하게 파싱한다:
   *   0        = 어떤 스킬과도 무관한 대화(인사·잡담·단순 질문) → 작업 아님(계획 불필요)
   *   1..N     = 그 번호의 스킬이 요청에 맞음 → 작업(스킬 라우팅 + 계획)
   *   N+1      = 맞는 스킬은 없지만 계획이 필요한 실제 작업 → 라우팅 없이 계획
   * candidates 가 비면(라우팅 off) N=0 이라 '0=대화 / 1=작업' 의 순수 작업 판정기로 자연 축약된다.
   * 응답이 애매하거나 호출이 실패하면 안전하게 '작업'으로 본다(기존 needsPlan 폴백 — 소형 모델 이탈 억제).
   */
  private async classifyTurn(
    input: string,
    candidates: Skill[],
  ): Promise<{ skill: Skill | null; isTask: boolean }> {
    const N = candidates.length;
    const taskNum = N + 1;
    const hasSkills = N > 0;
    // 스킬은 이름 대신 '번호'로 답하게 한다 — 모델이 요청의 단어(예: "NextJS")를 그대로 뱉어
    // 파싱이 깨지는 것을 막고, 정수 하나만 뽑으면 되므로 견고하다.
    const skillLines = candidates.map((s, i) => `${i + 1}) ${s.name}: ${s.description}`).join("\n");
    const options = [
      "0) 인사·잡담·감사·단순 사실 질문·개념 설명처럼 한두 문장으로 바로 답할 수 있는 대화 (작업 아님)",
      hasSkills ? skillLines : "",
      `${taskNum}) ${hasSkills ? "위 스킬엔 없지만 " : ""}코드·문서·데이터·앱/웹 등을 만들거나 고치거나 분석·조사·설정하는 실제 작업`,
    ]
      .filter(Boolean)
      .join("\n");
    const skillGuidance = hasSkills
      ? "개발·설계·문서·데이터·웹/앱 제작 등 전문 작업이면 완벽히 일치하지 않아도 가장 근접한 스킬 번호를 고른다. " +
        "★ 코드·앱·웹사이트·게임을 '구현/개발/코딩/만들기' 하려는 요청이면 실제 코드를 만드는 구현 스킬" +
        "(web·mobile·desktop·각 백엔드 프레임워크·codegen)을 우선 골라라. game-master(TRPG 게임 진행)·" +
        "story-studio·quiz-forge 같은 콘텐츠 생성 스킬은 그 콘텐츠 자체를 원할 때만 고르고, '게임을 코드로 구현' 요청엔 고르지 마라. "
      : "";
    try {
      const msg = await this.deps.llm.complete(
        [
          {
            role: "system",
            content:
              "아래 번호 목록에서 사용자 요청에 가장 잘 맞는 항목의 '번호' 하나만 출력해라. " +
              skillGuidance +
              `여러 단계로 계획해 수행할 실제 작업인데 맞는 스킬이 없으면 ${taskNum} 을, ` +
              "인사·잡담·단순 질문이거나 이어가기처럼 어떤 작업과도 무관한 대화면 0 을 출력해라. 다른 말 없이 숫자 하나만.",
          },
          { role: "user", content: `요청:\n${input}\n\n${options}` },
        ],
        [],
      );
      const m = (msg.content ?? "").match(/\d+/); // 응답에서 첫 정수만 취함
      if (!m) return { skill: null, isTask: true }; // 애매 → 안전하게 작업(계획)
      const n = parseInt(m[0], 10);
      if (n >= 1 && n <= N) return { skill: candidates[n - 1], isTask: true }; // 스킬 매칭 → 작업
      return { skill: null, isTask: n !== 0 }; // 0=대화, 그 외(N+1·범위밖)=작업(안전)
    } catch {
      return { skill: null, isTask: true }; // 분류 호출 실패 → 라우팅 없이 안전하게 작업(계획)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 자동 계획 (Todo)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * 본격적인 작업 루프에 들어가기 전에, update_plan 만 노출한 별도 LLM 호출로
   * 할 일 목록(Todo)을 먼저 세운다. 도구를 하나만 제공하고 그 도구를 강제(tool_choice)해
   * 소형 모델도 계획을 확실히 만들도록 한다. 강제 tool_choice 미지원 서버를 대비해
   * "required" → "auto" 순으로 폴백하고, 끝내 실패하면 계획 없이 진행한다.
   */
  private async planFirst(): Promise<void> {
    const planTool = this.tools.get("update_plan");
    const planDef = this.openaiTools.find((t) => t.function.name === "update_plan");
    if (!planTool || !planDef) return; // update_plan 도구가 비활성화된 경우

    // planFirst 는 this.messages 전체를 LLM 에 보낸다 — 긴 히스토리(+방금 주입된 스킬 지침)가 예산을
    // 넘겨 이 계획 호출이 컨텍스트 초과로 실패하는 것을 막기 위해 호출 직전에 압축한다.
    // (선처리 진입부에서 미리 하던 compact 를 실제 필요 지점인 여기로 옮긴 것 — 중복 압축 제거.)
    await this.compact();

    this.deps.log("  ↳ 계획 수립 중…");
    // gemma 등 로컬 소형 모델은 강제 tool_choice 를 무시하고 계획 대신 질문을 늘어놓는 경우가 많다.
    // 계획을 못 만들면 더 단호한 지시로 1회 더 시도한다.
    const attempts = [
      "본격적으로 시작하기 전에, 바로 위 요청을 처리할 할 일 목록을 update_plan 도구로 세우세요. " +
        "각 단계는 짧고 검증 가능한 행동 단위(예: 파일 작성, 명령 실행)로 순서대로 나열하고, 첫 단계만 in_progress, 나머지는 pending 으로 두세요. " +
        "문서·코드 같은 산출물이 나오는 요청이면 write_file 로 저장하는 단계를 반드시 포함하세요. " +
        "정보가 부족해도 사용자에게 되묻지 말고 합리적으로 가정해 계획을 세우세요. 질문하지 말고 반드시 update_plan 을 호출하세요.",
      "지금 즉시 update_plan 도구만 호출해 할 일 목록을 만드세요. 설명·질문은 하지 말고 도구 호출만 하세요. " +
        "요청이 넓으면 스스로 합리적인 범위로 좁혀 3~6단계로 나누고, 첫 단계를 in_progress 로 두세요.",
    ];
    const choices: ChatCompletionToolChoiceOption[] = [
      { type: "function", function: { name: "update_plan" } },
      "required",
      "auto",
    ];

    for (const instrText of attempts) {
      const instr: ChatCompletionMessageParam = { role: "user", content: instrText };
      this.messages.push(instr);
      const instrIdx = this.messages.length - 1;

      let msg: ChatCompletionMessageParam | null = null;
      for (const choice of choices) {
        try {
          msg = (await this.deps.llm.complete([...this.messages], [planDef], choice)) as ChatCompletionMessageParam;
          break;
        } catch {
          /* 이 서버가 이 tool_choice 를 거부 → 다음 방식으로 폴백 */
        }
      }
      this.messages.splice(instrIdx, 1); // 계획 지침은 히스토리에 남기지 않음

      if (!msg) return; // LLM 호출 자체 실패 → 계획 없이 진행
      const calls = ((msg as any).tool_calls ?? []).filter(
        (c: any) => c.type === "function" && c.function.name === "update_plan",
      );
      if (!calls.length) continue; // 모델이 계획을 안 세움 → 더 단호한 지시로 재시도

      this.messages.push(msg); // assistant(tool_calls) 를 히스토리에 반영
      for (const call of calls) {
        let parsed: Record<string, any> = {};
        try {
          parsed = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          this.pushToolResult(call.id, "계획 인자 JSON 파싱 실패");
          continue;
        }
        let result: string;
        try {
          result = toToolResult(await planTool.run(parsed, this.ctx())).content;
        } catch (err: any) {
          result = `계획 도구 오류: ${err.message}`;
        }
        this.pushToolResult(call.id, result);
      }
      if (this.turn.plan.length) return; // 계획 수립 성공
    }
  }

  /**
   * 현재 계획을 다시 보여주고 다음 단계로 진행하도록 안내하는 리마인더 문자열.
   * 계획이 없으면 null. 매 스텝 임시로 주입해 소형 모델이 목록을 놓치거나 같은 도구를
   * 반복 호출하는 것을 막는다(반복 억제의 핵심).
   */
  private planReminder(): string | null {
    const steps = this.turn.plan;
    if (!steps.length) return null;
    const remaining = steps.filter((s) => s.status !== "completed");
    if (!remaining.length) {
      // 모든 단계 완료 → '최종 답변 작성' 넛지는 한 번이면 충분하다. 완료 상태에서 매 스텝 같은
      // 문구를 반복 주입하는 토큰 낭비를 없앤다(그래도 남는 루프는 동일-호출/강제 종료 가드가 잡는다).
      if (this.turn.finalizeNudged) return null;
      this.turn.finalizeNudged = true;
      return "계획의 모든 단계를 완료했습니다. 더 이상 도구를 호출하지 말고 사용자 요청에 대한 최종 답변을 작성하세요.";
    }
    // 아직 남은 단계가 있음 → 이후 다시 완료되면(계획 재개 대비) 넛지를 한 번 더 허용한다.
    this.turn.finalizeNudged = false;
    const next = steps.find((s) => s.status === "in_progress") ?? remaining[0];
    // 방금 계획만 갱신했다면(실제 작업 없이) 계획 갱신을 멈추고 작업하라고 더 단호히 안내한다.
    const churnWarning =
      this.turn.planOnlyStreak >= 1
        ? "⚠️ 방금 계획만 갱신했습니다. update_plan 을 또 호출하지 말고, 지금 이 단계를 write_file·run_shell 등 실제 도구로 수행하거나 최종 답변을 작성하세요."
        : null;
    return [
      renderPlan(steps),
      "",
      `지금 할 단계: ${next.content}`,
      churnWarning ??
        "지금 이 단계를 도구로 **실제로 수행**하세요. 사용자에게 되묻지 말고, 정보가 부족하면 합리적으로 가정하고 진행하세요.",
      "끝나면 update_plan 으로 그 단계를 completed 로, 다음 단계를 in_progress 로 갱신하세요.",
      "이미 끝낸 단계나 방금 호출한 도구를 같은 인자로 반복하지 마세요. 모든 단계가 끝나면 도구를 멈추고 최종 답변을 작성하세요.",
    ].join("\n");
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 산출물 자동 저장
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * 다음 자동 저장 파일에 붙일 순번. 이번 run 에서 이미 매긴 번호(artifactSeq)와
   * 폴더에 실제로 존재하는 NN- 파일의 최대치(모델이 직접 쓴 것 포함) 중 큰 값 +1 로 정해
   * 중복(덮어쓰기)·순서 역전을 막는다.
   */
  private nextArtifactSeq(): number {
    // 순번은 '현재 작업 폴더'(토픽 하위폴더일 수 있음) 기준으로 센다 — 토픽마다 01,02… 독립.
    return Math.max(this.turn.artifactSeq, maxArtifactSeq(this.ctx().cwd)) + 1;
  }

  /**
   * 최상위 요청이 긴 문서형 답변을 냈는데 이번 턴에 write_file 을 한 번도 쓰지 않았다면,
   * 그 답변을 작업 폴더에 .md 로 자동 저장한다(소형 모델이 산출물을 파일로 안 남기는 문제 보완).
   * 저장은 write_file 도구를 거치므로 승인 게이트/샌드박스를 그대로 탄다.
   * 저장하면 반환 텍스트 끝에 저장 경로 안내를 덧붙인다.
   */
  private async maybeAutoSave(text: string, msg?: ChatCompletionMessageParam): Promise<string> {
    if (!this.deps.config.autoSaveArtifacts || this.depth !== 0 || this.turn.wroteFile) return text;
    const body = text.trim();
    // 짧은 답변·일반 대화는 저장하지 않는다. 문서형(마크다운 헤더 또는 여러 줄)만 대상.
    if (body.length < 800) return text;
    const looksDoc = /(^|\n)#{1,6}\s/.test(body) || body.split("\n").length >= 8;
    if (!looksDoc) return text;
    const writeTool = this.tools.get("write_file");
    if (!writeTool) return text;

    const seq = this.nextArtifactSeq();
    const filename = `${pad2(seq)}-${artifactFilename(body)}`;
    try {
      const res = toToolResult(await writeTool.run({ path: filename, content: body }, this.ctx()));
      if (res.denied) return text; // 승인 거부 → 답변만 반환
      this.turn.artifactSeq = seq; // 저장 성공 시에만 순번 확정(거부/실패 시 번호 낭비 방지)
      this.turn.wroteFile = true;
      this.deps.log(`  ↳ (자동 저장) write_file(${filename})`);
      // 저장한 문서 원문을 히스토리 메시지에서 포인터로 치환 — 다음 턴 컨텍스트 비대/압축 트리거 방지.
      if (msg && typeof msg.content === "string") msg.content = interimPointer(filename, body);
      return `${text}\n\n---\n📄 산출물을 파일로 저장했습니다: ${filename}`;
    } catch {
      return text; // 저장 실패해도 답변은 그대로
    }
  }

  /**
   * 루프 도중 도구 호출(예: update_plan)과 함께 나온 어시스턴트 content 가 문서형 산출물이면
   * 개별 .md 로 자동 저장한다. maybeAutoSave 는 도구 없는 '최종' 텍스트만 포착하므로,
   * 단계별 산출물(DB 스키마·아키텍처 등)이 계획 갱신과 한 턴에 섞여 나오면 놓친다 — 이를 보완한다.
   * 같은 제목의 산출물은 한 번만 저장하고(중복 방지), 최종 응답의 자동 저장과 독립적으로 동작하도록
   * wroteFile 플래그는 건드리지 않는다.
   */
  private async maybeAutoSaveInterim(
    msg: ChatCompletionMessageParam,
    alreadyPersisted = false,
  ): Promise<void> {
    if (!this.deps.config.autoSaveArtifacts || this.depth !== 0) return;
    const body = (typeof msg.content === "string" ? msg.content : "").trim();
    if (body.length < 800) return; // 짧은 진행 코멘트는 저장하지 않음
    const looksDoc = /(^|\n)#{1,6}\s/.test(body) || body.split("\n").length >= 8;
    if (!looksDoc) return;

    // 모델이 이번 턴에 write_file 로 이미 저장했으면(alreadyPersisted) 재저장하지 않고
    // 원문만 포인터로 치환한다 — 히스토리 비대(→ 컨텍스트 초과)만 막고 파일 중복은 피한다.
    if (alreadyPersisted) {
      msg.content = interimPointerSaved(body);
      return;
    }

    const writeTool = this.tools.get("write_file");
    if (!writeTool) return;

    // 번호를 뗀 제목(타임스탬프 제외)을 중복 키로 사용 (같은 산출물이 여러 턴 반복돼도 1회만 저장).
    // 넘버링은 저장이 확정될 때만 붙이므로 dedup 은 번호와 무관하게 동작한다.
    const base = artifactFilename(body);
    const key = base.replace(/-\d{4}-\d{2}-\d{2}T[\d-]+\.md$/, "");
    if (this.turn.savedArtifacts.has(key)) {
      // 이미 같은 산출물을 저장했음 → 재저장 없이 원문만 치환(히스토리 비대 방지)
      msg.content = interimPointerSaved(body);
      return;
    }

    const seq = this.nextArtifactSeq();
    const filename = `${pad2(seq)}-${base}`;
    try {
      const res = toToolResult(await writeTool.run({ path: filename, content: body }, this.ctx()));
      if (res.denied) return; // 승인 거부 → 조용히 통과
      this.turn.artifactSeq = seq; // 저장 성공 시에만 순번 확정
      this.turn.savedArtifacts.add(key);
      this.deps.log(`  ↳ (중간 산출물 자동 저장) write_file(${filename})`);
      // 저장한 문서 원문을 히스토리에서 포인터로 치환한다. 원문은 파일에 보존되며,
      // 이렇게 해야 여러 Phase 문서가 히스토리에 누적돼 컨텍스트 예산을 넘기고 compact() 가
      // 작업 맥락을 통째로 버려(→ 초기 상태로 회귀) 버리는 문제를 막는다.
      msg.content = interimPointer(filename, body);
    } catch {
      /* 저장 실패해도 작업은 계속 진행 */
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 반복/이탈 감지
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * 이번 최종(무-도구) 응답이 직전 '턴'의 최종 응답과 사실상 동일한지 판정한다.
   * 소형 모델이 매 턴 똑같은 되묻기를 반복(사용자 답을 무시)하는 루프를 잡기 위한 것.
   * 정확히 같거나, 앞부분이 길게 겹치면(같은 상투구로 시작) 반복으로 본다.
   */
  private isRepeatOfLastFinal(text: string): boolean {
    const cur = normalizeForCompare(text);
    if (!cur || !this.lastFinalResponse || cur === "(응답 없음)") return false;
    if (cur === this.lastFinalResponse) return true;
    const n = 150;
    return (
      cur.length >= n &&
      this.lastFinalResponse.length >= n &&
      cur.slice(0, n) === this.lastFinalResponse.slice(0, n)
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 메인 실행 루프
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * 사용자 입력 한 건을 처리하고 최종 텍스트 응답을 반환한다.
   * onToken 이 주어지면 최종 응답 텍스트를 스트리밍한다.
   * skill 이 주어지면 LLM 의 스킬 선택(invoke_skill)을 건너뛰고
   * 해당 스킬 지침을 이번 턴에 강제로 주입한다 (CLI 의 '/스킬명' 직접 호출용).
   */
  async run(
    userInput: string,
    onToken?: (delta: string) => void,
    skill?: Skill,
  ): Promise<string> {
    this.turn = new TurnState(); // 이번 턴 임시 상태를 통째로 초기화 (이전 턴 상태 누수 차단)
    this.injectWorkdirSnapshot();
    this.pushUserTurn(userInput, skill);
    await this.prepareTurn(userInput, skill);

    for (let step = 0; step < this.deps.config.maxSteps; step++) {
      const msg = await this.callModel(onToken);
      this.messages.push(msg as ChatCompletionMessageParam);

      const toolCalls = msg.tool_calls ?? [];
      if (toolCalls.length === 0) {
        const final = await this.handleFinalResponse(msg);
        if (final === null) continue; // 이탈 교정 지시를 주입함 → 다음 스텝에서 재생성
        return final;
      }

      const forceFinal = await this.executeToolCalls(msg);
      if (forceFinal) return await this.forceFinalAnswer(onToken);
    }
    return `최대 반복 횟수(${this.deps.config.maxSteps})에 도달해 중단했습니다.`;
  }

  /**
   * 작업 폴더 상태 스냅샷을 사용자 메시지 '앞'에 선제 주입한다.
   * 소형 모델이 "이미 프로젝트가 있다"를 인지 못해 create-* 로 새 프로젝트를 중첩 생성하거나
   * 엉뚱한 경로에 파일을 흩뿌리는 실수를 막는다. 이전 턴의 오래된 스냅샷은 제거하고 최신 하나만 유지한다.
   * (사용자 메시지 앞에 두어, 라우팅·계획 단계가 참조하는 '바로 위 요청'은 여전히 사용자 요청이 되게 한다.)
   */
  private injectWorkdirSnapshot(): void {
    this.messages = this.messages.filter(
      (m) => !(m.role === "user" && typeof m.content === "string" && m.content.startsWith(Agent.WD_SNAPSHOT)),
    );
    const wdSnapshot = this.describeWorkdir();
    if (wdSnapshot) this.messages.push({ role: "user", content: wdSnapshot });
  }

  /** 사용자 입력(또는 CLI 직접 호출된 스킬 지침 + 입력)을 히스토리에 추가한다. */
  private pushUserTurn(userInput: string, skill?: Skill): void {
    if (skill) {
      this.deps.log(`  ↳ 스킬 로드: ${skill.name}`);
      this.turn.usedSkills.add(skill.name);
      const instructions = renderSkillInstructions(skill);
      const content = userInput.trim()
        ? `${instructions}\n\n----- 사용자 요청 -----\n${userInput}`
        : instructions;
      this.messages.push({ role: "user", content });
    } else {
      this.messages.push({ role: "user", content: userInput });
    }
  }

  /**
   * 최상위 요청이면 본격 작업 전에 (1) 요청에 맞는 스킬을 자동 로드하고(하이브리드 라우터),
   * (2) Todo 계획을 먼저 세운다(소형 모델의 반복·이탈 억제).
   * 스킬 매칭과 '작업 여부'는 classifyTurn 의 단일 LLM 분류 1회로 함께 판정한다(예전엔 두 번 호출).
   * 트리비얼·이어가기 입력은 분류 없이 건너뛰고, 이미 스킬이 로드됐으면 분류 없이 곧장 계획한다.
   *
   * compact 는 여기서 미리 하지 않는다. classifyTurn 은 자체 최소 메시지 배열로 호출해 this.messages
   * 크기와 무관하고, this.messages 전체를 보내는 건 planFirst 뿐이므로 compact 는 planFirst 안에서 한다.
   * (계획을 안 세우는 턴은 사전 compact 를 아예 건너뛰고 메인 루프의 compact 가 처리 — 중복 압축 제거.)
   */
  private async prepareTurn(userInput: string, skill?: Skill): Promise<void> {
    const willRoute = this.deps.config.skillRouter && !skill;
    const { autoPlan } = this.deps.config;
    if (this.depth !== 0 || !(willRoute || autoPlan)) return;

    // CLI '/스킬명' 등으로 스킬이 이미 로드된 경우: 명백한 작업 → 분류 없이 토픽 폴더 발급 + 계획.
    if (this.turn.usedSkills.size > 0) {
      this.startTopicWorkdir(skill?.name ?? userInput.trim());
      if (autoPlan) await this.planFirst();
      return;
    }

    // 트리비얼·이어가기 입력, 또는 방금 만든 산출물을 가리키는 후속(#5)은 라우팅·새 폴더·계획 불필요.
    // 후속을 새 작업으로 오인해 딴 스킬에 장악되고 산출물이 다른 폴더로 흩어지는 것을 막는다.
    const input = userInput.trim();
    if (this.isTrivialOrContinuation(input) || this.continuesCurrentTopic(input)) return;

    // 라우팅할 스킬 후보(라우팅 off 면 빈 목록). 후보도 없고 계획도 안 세울 거면 분류 자체가 무의미.
    const candidates = willRoute ? this.deps.skills.categoryEntries() : [];
    if (!candidates.length && !autoPlan) return;

    // 단일 분류 호출로 스킬 매칭 + 작업 여부를 함께 판정 (낭비1 제거: 예전엔 최대 두 번 호출).
    const { skill: chosen, isTask } = await this.classifyTurn(input, candidates);

    if (chosen) {
      this.deps.log(`  ↳ 스킬 라우팅: '${chosen.name}' 자동 로드 (요청에 맞는 스킬)`);
      this.turn.usedSkills.add(chosen.name);
      this.messages.push({
        role: "user",
        content:
          "이 요청에 맞는 스킬을 로드했습니다. 다른 작업을 시작하기 전에 아래 지침을 그대로 따르세요.\n\n" +
          renderSkillInstructions(chosen),
      });
    }

    // 새 작업(스킬 매칭 또는 실제 작업)으로 확정되면 토픽 전용 하위폴더를 발급한다.
    // (이어가기·단순 대화는 위에서 이미 return 되었거나 isTask=false 라 여기서 폴더를 만들지 않는다.)
    if (chosen !== null || isTask) this.startTopicWorkdir(chosen?.name ?? input);

    // 스킬이 매칭됐으면 명백한 작업. 아니면 분류의 작업 여부를 따른다.
    if (autoPlan && (chosen !== null || isTask)) await this.planFirst();
  }

  /**
   * 모델을 1회 호출해 응답 메시지를 받는다.
   * 서버가 컨텍스트 초과(또는 일시 5xx)를 반환하면 예산을 줄여 더 엄격히 compact 후 재시도한다.
   * 매 시도마다: compact → (autoPlan 이면) 계획 리마인더 임시 주입 → 호출 → 리마인더 제거.
   */
  private async callModel(onToken?: (delta: string) => void): Promise<CompletionMessage> {
    for (let attempt = 0; ; attempt++) {
      // 컨텍스트 초과 방지: 매 호출 전 오래된 히스토리를 요약/절삭으로 예산 내로
      await this.compact();
      // 계획이 있으면 현재 계획과 다음 단계를 다시 보여주는 임시 리마인더를 주입한다.
      // (히스토리에 남기지 않고 이번 호출에만 쓰고 제거 — 세션 비대·중복 방지)
      const reminder = this.deps.config.autoPlan ? this.planReminder() : null;
      let remIdx = -1;
      if (reminder) {
        this.messages.push({ role: "user", content: reminder });
        remIdx = this.messages.length - 1;
      }
      try {
        const msg = onToken
          ? await this.deps.llm.completeStream(this.messages, this.openaiTools, onToken)
          : await this.deps.llm.complete(this.messages, this.openaiTools);
        if (remIdx >= 0) this.messages.splice(remIdx, 1); // 임시 리마인더 제거
        return msg;
      } catch (err) {
        if (remIdx >= 0) this.messages.splice(remIdx, 1);
        this.handleModelError(err, attempt); // 재시도 가능하면 조용히 리턴, 아니면 throw
      }
    }
  }

  /**
   * callModel 의 호출 실패를 처리한다. 재시도 가능하면(그냥 리턴) 다음 attempt 로 넘어가고,
   * 회복 불가면 throw 해 루프를 끝낸다. 컨텍스트 초과가 의심되면 이번 턴 예산을 줄인다.
   */
  private handleModelError(err: unknown, attempt: number): void {
    const ctxByKeyword = isContextOverflow(err); // 본문에 '창 초과' 문구가 명시된 경우
    const serverErr = typeof (err as any)?.status === "number" && (err as any).status >= 500;
    if (attempt < 4 && (ctxByKeyword || serverErr)) {
      const cur = this.budgetChars();
      // 축소는 '실제로 히스토리가 예산에 근접'하거나 본문이 명시적 창 초과일 때만 의미가 있다.
      // 히스토리가 작은데 나는 5xx 는 컨텍스트 문제가 아니라 다른 원인(잘린 tool_call·일시 오류)이므로
      // 예산을 붕괴시키지 말고 그대로 재시도한다(과잉 축소로 이후 턴 맥락이 굶는 것을 방지).
      const historyIsLarge = this.historyChars() > cur * 0.6;
      if ((ctxByKeyword || historyIsLarge) && cur > 3000) {
        this.turn.budgetOverride = Math.max(2500, Math.floor(cur / 2));
        this.deps.log(`  ↳ (컨텍스트 초과 → 히스토리 예산 ${cur}→${this.turn.budgetOverride}자로 줄여 재시도)`);
      } else {
        this.deps.log(`  ↳ (서버 5xx·히스토리 여유 있음 → 예산 유지하고 재시도 ${attempt + 1}/4)`);
      }
      return; // 재시도
    }
    if (ctxByKeyword) {
      // 명시적 창 초과인데 더는 줄일 수 없음 → 실행 가능한 안내로 종료.
      throw new Error(
        "모델의 컨텍스트 창이 너무 작아 요청을 처리할 수 없습니다. " +
          "LM Studio 등에서 모델을 더 큰 Context Length(예: 16384/32768)로 다시 로드하거나, " +
          ".env 의 CONTEXT_MAX_CHARS 를 창 크기에 맞게 낮추세요. " +
          `(원본 오류: ${(err as any)?.message ?? err})`,
      );
    }
    throw err; // 재시도로도 안 풀린 그 밖의 오류는 그대로 전파(원인 표면화)
  }

  /**
   * 도구 호출 없는 '최종' 응답을 처리한다.
   * 이탈(derailment) 신호가 있으면 run 당 1회 교정 지시를 주입하고 null 을 반환해 재생성을 유도한다.
   * 정상 종료면 최종 텍스트(자동 저장 포함)를 반환한다. 두 이탈 신호를 본다:
   *  (a) 크로스턴 반복: 직전 '턴'의 최종 응답과 사실상 동일 (같은 되묻기 무한 반복).
   *  (b) 계획 미완 중도 종료: 계획에 남은 단계가 있는데(이번 턴에 도구는 썼으나) 무-도구 텍스트로
   *      끝내려 함. 특히 "~하겠습니다"처럼 '할 것'이라 서술만 하고 정작 그 도구를 호출하지 않은 채
   *      턴을 끝내는 소형 모델의 대표적 중도 멈춤을 잡는다.
   *      (계획이 모두 완료됐거나 도구를 아예 안 쓴 순수 대화 턴은 제외 — 밀어붙이지 않음)
   */
  private async handleFinalResponse(msg: CompletionMessage): Promise<string | null> {
    // 텍스트로 뱉은 도구 호출 마크업([TOOL_REQUEST] 등)은 최종 답변에서 걷어낸다.
    const cleaned = stripTextToolCalls(msg.content ?? "");
    if (typeof msg.content === "string") msg.content = cleaned; // 히스토리도 정제본
    const finalText = cleaned || "(응답 없음)";

    const planRemaining = this.turn.plan.some((s) => s.status !== "completed");
    // 계획이 남았고(planRemaining) 도구를 쓰던 턴인데, 무-도구 텍스트가 '하겠다/되묻기' 같은
    // 중도 멈춤 신호일 때만 밀어붙인다. 작업을 다 하고 완료 요약으로 끝냈는데 단지 update_plan 으로
    // 완료 표시를 안 했을 뿐인 경우(looksLikeStall=false)는 밀어붙이지 않는다 — 이미 한 작업을
    // 다시 시켜 같은 동작을 반복하게 만드는 오작동을 막는다.
    const bailedOnPlan =
      this.turn.plan.length > 0 && planRemaining && this.turn.calledTool && looksLikeStall(finalText);
    if (!this.turn.loopBroken && (this.isRepeatOfLastFinal(finalText) || bailedOnPlan)) {
      this.turn.loopBroken = true;
      this.deps.log(
        bailedOnPlan
          ? "  ↳ (계획 미완·설명만 하고 종료 감지 → 다음 단계 수행 지시 후 재시도)"
          : "  ↳ (직전 턴과 동일한 응답 반복 감지 → 교정 지시 후 재시도)",
      );
      this.messages.push({
        role: "user",
        content:
          "아직 계획에 남은 단계가 있습니다. 작업을 '하겠다/하고 있다'고 설명만 하지 말고, " +
          "지금 그 도구(write_file·run_shell 등)를 실제로 호출해 다음 단계를 수행하세요. " +
          "**이미 끝낸 작업(작성한 파일·실행한 명령)은 다시 하지 말고, 아직 안 한 다음 단계만** 수행하세요. " +
          "처음부터 다시 안내하거나 되묻지 말고, list_skills 로 스킬을 새로 탐색하지도 마세요. " +
          "정보가 부족하면 합리적으로 가정해 진행하세요.",
      });
      return null; // 다음 스텝에서 교정 지시를 반영해 재생성
    }

    // 산출물 검증(#2): 요약이 '만들었다'고 제시한 파일이 작업 폴더에 실제로 없으면 거짓 성공 보고를 막는다.
    // 한 번은 실제 생성/정정을 지시해 재시도시키고(groundingRetried), 그래도 없으면 사용자에게 사실을 알리는
    // 정정 안내를 답변에 덧붙인다(모델이 계속 거짓 보고하는 경우의 최후 방어).
    let text = finalText;
    const missing = this.groundClaimedArtifacts(text);
    if (missing.length) {
      if (!this.turn.groundingRetried) {
        this.turn.groundingRetried = true;
        this.deps.log("  ↳ (산출물 검증: 보고된 파일이 실제로 없음 → 생성/정정 지시 후 재시도)");
        this.messages.push({
          role: "user",
          content:
            `요약에서 다음 파일을 만들었다고 했지만 작업 폴더에 **실제로 없습니다**: ${missing.join(", ")}. ` +
            "지금 write_file 로 그 파일을 실제로 만드세요. 정말 만들 수 없으면, 없는 파일을 '생성됨'으로 보고하지 말고 " +
            "요약에서 '생성하지 못함'으로 정직하게 정정하세요. 수용 기준 점검도 실제로 존재하는 파일 기준으로 다시 쓰세요.",
        });
        return null; // 다음 스텝에서 실제 생성 또는 정직한 정정을 반영해 재생성
      }
      text += `\n\n---\n⚠️ **자동 검증 안내:** 위 요약은 다음 파일을 산출물로 언급했으나 작업 폴더에서 확인되지 않았습니다: ${missing.join(", ")}. 실제로 생성되지 않았을 수 있습니다.`;
      if (typeof msg.content === "string") msg.content = text;
      this.deps.log("  ↳ (산출물 검증: 재시도 후에도 미확인 → 정정 안내 첨부)");
    }

    this.lastFinalResponse = normalizeForCompare(text);
    return await this.maybeAutoSave(text, msg as ChatCompletionMessageParam);
  }

  /** 최종 답변이 '생성했다'고 주장하지만 작업 폴더에 없는 산출물 파일명들. 파일시스템 오류 시 빈 배열. */
  private groundClaimedArtifacts(text: string): string[] {
    try {
      return claimedButMissing(text, this.deps.config.cwd);
    } catch {
      return [];
    }
  }

  /**
   * 이번 턴의 tool_call 들을 실행하고, 도구 없이 강제 종료해야 하면 true 를 반환한다.
   * - 빈/깨진 인자는 "{}" 로 정규화하고 실행을 건너뛴다(다음 요청 500 방지).
   * - 동일 (도구+인자) 반복은 실행을 억제하고, 3번째면 forceFinal.
   * - 도구와 함께 나온 문서형 content 는 중간 산출물로 자동 저장한다.
   * - update_plan 만 3턴 연속이면 forceFinal.
   */
  private async executeToolCalls(msg: CompletionMessage): Promise<boolean> {
    const toolCalls = msg.tool_calls ?? [];
    // 이번 턴에 write_file 로 문서가 실제로 저장됐는지(성공+유효 content) 추적 — 아래 중간
    // 산출물 처리에서 '재저장 없이 치환만' 할지 판단하는 데 쓴다.
    let wroteDocThisTurn = false;
    let forceFinal = false;

    for (const call of toolCalls) {
      if (call.type !== "function") continue;
      // 빈 문자열 인자(arguments="")를 가진 tool_call 을 히스토리에 그대로 두면 다음 요청에서
      // 서버(gemma/llama.cpp)가 500 을 낸다(실측 확인). 어느 분기로 빠지든 남지 않도록 먼저 정규화.
      const rawArgs = (call.function.arguments ?? "").trim();
      if (!rawArgs) call.function.arguments = "{}";
      const tool = this.tools.get(call.function.name);
      let result: string;
      if (!tool) {
        result = `알 수 없는 도구: ${call.function.name}`;
        this.pushToolResult(call.id, result);
        continue;
      }
      // 인자가 비었거나(모델이 인자 없이 호출·응답 토큰 한도로 잘림) 유효하지 않은 JSON 이면
      // 도구 실행은 건너뛰고, 위에서 정규화한 "{}" 만 히스토리에 남겨 다음 요청을 정상화한다.
      if (!rawArgs) {
        this.pushToolResult(
          call.id,
          "도구 인자가 비어 있습니다(응답 토큰 한도로 잘렸을 수 있음). " +
            "긴 산출물은 한 번에 다 쓰지 말고, write_file 을 여러 번에 나눠 호출하세요 " +
            '— 첫 조각은 그냥, 이후 조각은 같은 path 에 mode="append" 로 이어 쓰면 됩니다.',
        );
        continue;
      }
      let parsed: Record<string, any>;
      try {
        parsed = JSON.parse(rawArgs);
      } catch {
        call.function.arguments = "{}";
        this.pushToolResult(
          call.id,
          "도구 인자가 잘려(응답 토큰 한도 초과) 파싱에 실패했습니다. 긴 산출물은 write_file 을 " +
            `여러 번에 나눠(이후 조각은 같은 path 에 mode="append") 호출하세요. (잘린 인자 앞부분: ${rawArgs.slice(0, 80)})`,
        );
        continue;
      }

      // 동일 (도구+인자) 반복 호출 억제 — 소형 모델의 루프 방지
      const sig = `${tool.name}|${stableStringify(parsed)}`;
      const prior = this.turn.toolCallCounts.get(sig) ?? 0;
      this.turn.toolCallCounts.set(sig, prior + 1);
      if (prior >= 1) {
        this.deps.log(`  ↳ (반복 억제) ${tool.name}`);
        // 3번째 동일 호출 → 넛지를 무시하고 루프 중이므로, 도구 없이 강제 종료
        if (prior >= 2) forceFinal = true;
        this.pushToolResult(
          call.id,
          `'${tool.name}' 을(를) 동일한 인자로 이미 호출했고 결과는 위 대화에 있습니다. ` +
            `같은 호출을 반복하지 말고 지금까지의 정보로 최종 답변을 작성하세요.`,
        );
        continue;
      }

      this.deps.log(`  ↳ ${tool.name}(${summarizeArgs(parsed)})`);
      // 모델이 invoke_skill 로 실제 스킬을 로드하면 발동 기록
      if (tool.name === "invoke_skill" && parsed.name) {
        const resolved = this.deps.skills.get(String(parsed.name));
        if (resolved) this.turn.usedSkills.add(resolved.name);
      }
      try {
        const r = toToolResult(await tool.run(parsed, this.ctx()));
        result = r.content;
        this.turn.calledTool = true; // 메인 루프에서 도구를 호출함
        // 산출물을 파일로 남겼는지 추적 (자동 저장 폴백 판단용). 거부(denied)면 실제로 안 쓰였으므로 제외.
        if (tool.name === "write_file" && !r.denied) {
          this.turn.wroteFile = true;
          // 모델이 직접 긴 문서를 저장했으면 표시(아래 중간 산출물 재저장 방지용).
          // 예전엔 tool_call 인자의 문서 원문을 표식으로 치환했으나, 모델이 그 표식을 '내용'으로
          // 흉내 내 실제 파일에 써버리는 버그가 있어 제거했다. 히스토리 크기는 compact() 가 관리한다.
          if (typeof parsed.content === "string" && parsed.content.trim().length >= 800) {
            wroteDocThisTurn = true;
          }
        }
      } catch (err: any) {
        result = `도구 오류: ${err.message}`;
      }
      this.pushToolResult(call.id, result);
    }

    // 도구와 함께 나온 어시스턴트 content 가 문서형이면 파일로 남기고 히스토리에서는 포인터로 치환한다.
    // 모델이 이미 저장했으면(wroteDocThisTurn) 재저장 없이 치환만 — 유실 없이 히스토리만 줄인다.
    // 반대로 모델의 write_file 이 잘려 실패했으면(wroteDocThisTurn=false) 여기서 자동 저장해 문서를 보존한다.
    await this.maybeAutoSaveInterim(msg as ChatCompletionMessageParam, wroteDocThisTurn);

    // 이번 턴이 update_plan 만으로 이뤄졌는지 추적 — 계획만 갱신하고 실제 작업을 안 하는 루프 방지.
    const onlyPlan =
      toolCalls.length > 0 &&
      toolCalls.every((c: any) => c.type === "function" && c.function.name === "update_plan");
    this.turn.planOnlyStreak = onlyPlan ? this.turn.planOnlyStreak + 1 : 0;
    if (this.turn.planOnlyStreak >= 3) {
      this.deps.log("  ↳ (계획만 반복 → 도구 없이 최종 답변 강제)");
      forceFinal = true;
    }
    return forceFinal;
  }

  /**
   * 루프(같은 도구 반복·계획만 반복)가 감지됐을 때, 도구를 끈 호출로 최종 답변을 강제 생성한다.
   * 도구를 끄면 일부 모델(qwen 등)이 도구 호출을 '텍스트'([TOOL_REQUEST]…)로 뱉으므로,
   * 버퍼링(complete)으로 받은 뒤 텍스트형 도구호출 마크업을 제거하고 정제본만 출력·저장한다.
   *
   * 이 강제-최종 호출도 메인 루프처럼 compact + 컨텍스트 초과 재시도를 태운다. 루프가 길게 돌다
   * 감지됐을 땐 히스토리가 이미 예산에 근접해 있어, 이 마무리 호출마저 컨텍스트 초과로 실패하면
   * 턴 전체가 에러로 죽는다(가드가 오히려 크래시를 유발). compact 로 예산 내로 줄여 안전하게 마무리한다.
   */
  private async forceFinalAnswer(onToken?: (delta: string) => void): Promise<string> {
    this.deps.log("  ↳ (루프 감지 → 도구 없이 최종 답변 강제)");
    this.messages.push({
      role: "user",
      content:
        "도구를 반복 호출하고 있습니다. 더 이상 도구를 호출하지 마세요. " +
        "도구 호출 형식([TOOL_REQUEST]·<tool_call> 등)이나 JSON 을 출력하지 말고, " +
        "지금까지 한 작업을 한국어 문장으로만 간결히 요약해 최종 답변을 작성하세요.",
    });
    let finalMsg: CompletionMessage;
    for (let attempt = 0; ; attempt++) {
      await this.compact();
      try {
        finalMsg = await this.deps.llm.complete(this.messages, []);
        break;
      } catch (err) {
        this.handleModelError(err, attempt); // 재시도 가능하면 예산 줄여 리턴, 아니면 throw
      }
    }
    let forcedText = stripTextToolCalls(finalMsg.content ?? "");
    if (!forcedText)
      forcedText = "반복이 감지되어 작업을 중단했습니다. 지금까지 생성한 산출물은 작업 폴더에 저장돼 있습니다.";
    // 산출물 검증(#2): 강제 종료 경로는 재시도가 없으므로, 보고된 파일이 실제로 없으면 사실 정정만 덧붙인다.
    const missing = this.groundClaimedArtifacts(forcedText);
    if (missing.length) {
      forcedText += `\n\n---\n⚠️ **자동 검증 안내:** 위 요약은 다음 파일을 산출물로 언급했으나 작업 폴더에서 확인되지 않았습니다: ${missing.join(", ")}. 실제로 생성되지 않았을 수 있습니다.`;
      this.deps.log("  ↳ (산출물 검증: 보고된 파일 미확인 → 정정 안내 첨부)");
    }
    (finalMsg as any).content = forcedText; // 히스토리에도 정제본만 남긴다
    this.messages.push(finalMsg as ChatCompletionMessageParam);
    if (onToken) onToken(forcedText); // 정제된 최종 텍스트를 사용자에게 출력
    this.lastFinalResponse = normalizeForCompare(forcedText);
    return await this.maybeAutoSave(forcedText, finalMsg as ChatCompletionMessageParam);
  }

  private pushToolResult(toolCallId: string, content: string): void {
    this.messages.push({ role: "tool", tool_call_id: toolCallId, content });
  }
}

// 하위 호환: 이전에 agent.ts 에서 직접 import 하던 심볼을 계속 노출한다.
export { systemPrompt };
export { splitHistory, truncateHistory, artifactFilename, pad2, maxArtifactSeq };
