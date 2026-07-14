import { readdirSync, existsSync, statSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import type { Config } from "./config.js";
import type { LLM, ChatCompletionMessageParam, ChatCompletionToolChoiceOption } from "./llm.js";
import { renderSkillInstructions, type SkillRegistry, type Skill } from "./skills.js";
import { toOpenAITool, type Tool, type ToolContext, type PlanStep } from "./tools/types.js";
import { toolMap } from "./tools/index.js";
import { renderPlan } from "./tools/plan.js";

function systemPrompt(skills: SkillRegistry, soul?: string | null): string {
  const hasSoul = !!soul?.trim();
  // SOUL 첫 줄의 따옴표 안 이름을 뽑아 자기 인식을 강제한다. (예: 당신은 "Oliver" 입니다 → Oliver)
  const soulName = hasSoul ? soul!.match(/["“”]([^"“”]+)["“”]/)?.[1] ?? null : null;
  // SOUL 이 있으면 그 인격을 강하게 각인시키고(자기 인식·말투 고정), 없으면 기본 어시스턴트.
  const identity = hasSoul
    ? [
        "## 정체성",
        "당신은 아래에 묘사된 인격 그 자체입니다. 이 인격으로 생각하고, 이 인격의 말투로 말합니다.",
        soulName
          ? `당신의 이름은 "${soulName}" 입니다. 이름이나 정체를 물으면 반드시 "${soulName}"(이)라고 이름부터 밝히세요. '조력자'·'AI'·'어시스턴트' 같은 일반 명칭으로만 얼버무리지 마세요.`
          : "이름이나 정체를 물으면 이 인격으로 답합니다.",
        "스스로를 'AI'·'언어 모델'이라고 부르지 마세요.",
        "이 성격과 말투는 도구를 쓰는 중에도, 결과를 요약할 때도 대화 내내 흔들림 없이 유지됩니다.",
        "",
        soul!.trim(),
      ].join("\n")
    : "당신은 스킬 기반 범용 AI 어시스턴트입니다.";
  // 스킬이 적어 아래 '스킬 개요'에 전부 나열되면 list_skills 탐색 단계를 뺀다.
  // (빈 카테고리를 뒤지다 되묻기로 이탈하는 소형 모델의 대표적 실패 경로를 원천 차단)
  const skillRules = skills.isFlatCatalog()
    ? [
        "## 스킬 사용 규칙",
        "사용 가능한 스킬은 아래 '스킬 개요'에 이름과 설명이 모두 나열돼 있습니다.",
        "요청에 딱 맞는 스킬이 보이면, 다른 작업을 시작하기 전에 invoke_skill(name) 으로 바로 로드하고 반환된 지침을 그대로 따르세요.",
        "맞는 스킬이 없으면 스킬을 더 찾지 말고(list_skills 호출 불필요) 일반 도구로 바로 해결하세요.",
      ]
    : [
        "## 스킬 사용 규칙",
        "사용자의 요청에 맞는 스킬이 있으면, 다른 작업을 시작하기 전에 그 스킬을 사용하세요.",
        "1) 아래 카테고리 개요에서 관련 카테고리를 고르고, list_skills(category) 로 후보 스킬을 확인합니다.",
        "2) 적합한 스킬을 invoke_skill(name) 으로 로드하고, 반환된 지침을 그대로 따릅니다.",
        "부합하는 스킬이 없으면 일반 도구로 직접 해결하세요.",
      ];
  return [
    identity,
    "",
    "도구(tool)를 호출해 파일을 읽고 쓰고, 셸 명령을 실행하며 작업을 수행합니다.",
    "",
    ...skillRules,
    "**이미 진행 중인 작업(계획에 완료된 단계가 있음)이라면 스킬을 새로 탐색하거나 처음부터 되묻지 말고, 계획의 다음 단계를 곧바로 이어서 수행하세요. 앞 턴과 같은 안내·질문을 반복하지 마세요.**",
    "",
    "## 스킬 개요",
    skills.overview(),
    "",
    "## 행동 원칙",
    "- 추측하지 말고 도구로 사실을 확인하세요 (파일을 읽고, 명령을 실행).",
    "- **작업을 시작하기 전에 현재 작업 폴더에 이미 있는 것을 먼저 파악하세요.** 폴더에 이미 프로젝트(package.json·next.config 등)가 " +
      "있으면 create-next-app·npm init 같은 스캐폴딩으로 새로 만들지 말고, **기존 구조를 그대로 이어받아 파일을 수정/추가**하세요. " +
      "새로 스캐폴딩하면 프로젝트가 중첩되어(예: myapp/myapp) 엉킵니다. 어떤 프레임워크·구조인지 불확실하면 read_file·list_files 로 확인한 뒤 진행하세요.",
    "- **요청을 받으면 사용자에게 스펙을 되묻기보다 도구(write_file·run_shell 등)로 직접 산출물을 만드세요.**",
    "  정보가 조금 부족해도 합리적으로 가정해 진행하고, 가정한 내용은 결과에 함께 밝히세요.",
    "  질문만 늘어놓고 턴을 끝내지 마세요 — 정말 진행이 불가능할 때만 딱 필요한 것 하나만 되물으세요.",
    "- **문서·코드·데이터 파일 같은 산출물은 답변 텍스트로만 내보내지 말고 write_file 로 작업 폴더에 저장한 뒤, 저장한 경로를 알려주세요.**",
    "  여러 파일(예: Phase/장/단계별)로 나눠 저장할 때는 파일명 앞에 01-, 02- 처럼 두 자리 순번을 붙여 순서가 섞이지 않게 하세요.",
    "- 3단계 이상 걸리는 작업이면 시작할 때 update_plan 으로 할 일 목록을 세우고,",
    "  각 단계를 시작할 때 in_progress, 끝낼 때 completed 로 갱신하며 진행하세요.",
    "  단, update_plan 은 실제 작업(파일 작성·명령 실행 등)과 번갈아 쓰세요 — 계획만 연달아 갱신하고 정작 작업을 안 하면 안 됩니다.",
    "- 크고 자기완결적인 하위 작업은 spawn_agent 로 서브에이전트에게 위임할 수 있습니다.",
    "- **셸 명령은 비대화형으로 실행하세요.** 프롬프트를 묻는 명령은 무인 플래그를 붙이고" +
      "(예: create-next-app 은 `--yes`, 패키지 설치는 `-y`, 필요시 `CI=1`), " +
      "`npm run dev`·`npm start`·`--watch` 처럼 **끝나지 않는(장기 실행) 명령은 실행하지 마세요** — 타임아웃으로 실패하고 진행이 막힙니다. " +
      "스캐폴딩·설치·빌드·테스트처럼 스스로 종료되는 명령만 쓰세요.",
    "- **생성된 프로젝트 하위 폴더에서 계속 작업하려면 `change_dir` 로 이동하세요.** run_shell 의 `cd` 는 그 명령 안에서만 " +
      "유효하고 다음 호출엔 유지되지 않습니다(매번 현재 작업 폴더에서 실행). 예: create-next-app 이 `myapp/` 를 만들면 " +
      "`change_dir(\"myapp\")` 후 그 안에서 write_file·npm 명령을 이어가세요. 파일이 엉뚱하게 상위 폴더에 흩어지는 것을 막습니다.",
    "- **도구 결과로 확인되지 않은 성공·완료를 단정하지 마세요.** '명령 실패'가 떴거나 출력이 불확실하면 사실대로 알리고, " +
      "완료를 보고할 땐 그 근거(명령 출력·생성된 파일 경로)를 들어 말하세요. 실행하지도 않은 결과를 지어내지 마세요.",
    "- **답변·계획·산출물은 한국어로만 작성하세요**(코드·식별자·기술 용어는 예외). 중국어 등 다른 언어를 섞지 마세요.",
    hasSoul
      ? "- 모든 답변은 위 '정체성'의 이름·성격·말투를 유지한 채 간결한 한국어로 하세요. 절대 일반 어시스턴트 말투로 돌아가지 마세요.\n" +
        "  다만 말투만 인격을 따를 뿐, 작업(도구 호출·산출물 생성)은 미루거나 되묻기로 회피하지 말고 실제로 수행하세요."
      : "- 작업이 끝나면 결과를 간결한 한국어로 요약해 사용자에게 답하세요.",
    "- 파일 쓰기/셸 실행 등 되돌리기 어려운 작업은 도구가 사용자 승인을 받습니다.",
  ].join("\n");
}

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
 * 대화 상태를 유지하는 에이전트.
 * run() 을 반복 호출하면 멀티턴 대화가 이어진다.
 */
export class Agent {
  private messages: ChatCompletionMessageParam[];
  private tools: Map<string, Tool>;
  private openaiTools;
  private depth: number;
  private plan: PlanStep[] = [];
  /** 직전 run() 에서 실제로 발동한 스킬 이름들 */
  private usedSkills = new Set<string>();
  /** 이번 run() 에서 (도구+인자) 조합별 호출 횟수 — 동일 호출 반복(루프) 억제용 */
  private toolCallCounts = new Map<string, number>();
  /** update_plan 만 연달아 호출한 턴 수 — 계획만 갱신하고 실제 작업을 안 하는 루프 억제용 */
  private planOnlyStreak = 0;
  /** 이번 run() 에서 write_file 로 파일을 저장했는지 — 산출물 자동 저장 여부 판단용 */
  private wroteFile = false;
  /** 이번 run() 에서 자동 저장한 중간 산출물의 제목 키 — 중복 저장 방지용 */
  private savedArtifacts = new Set<string>();
  /** 자동 저장 파일명 앞에 붙일 두 자리 순번(01,02…). run 시작 시 폴더의 기존 최대 번호에서 이어감 */
  private artifactSeq = 0;
  /** 작업 폴더 스냅샷 메시지의 표식 — 턴마다 최신 하나만 남기려 이전 것을 이 접두사로 찾아 제거한다. */
  private static readonly WD_SNAPSHOT = "【현재 작업 폴더 상태】";

  /** 기본 시스템 프롬프트(요약 블록 제외) */
  private baseSystem: string;
  /** 압축된 오래된 대화의 누적 요약 */
  private summary: string;
  /** 루트(config.cwd) 기준 현재 작업 하위 폴더. change_dir 로 바뀌며 턴을 넘어 유지된다. "" = 루트. */
  private workdir: string;
  /** 직전 '턴'의 최종(무-도구) 응답 정규화본 — 턴을 넘어 같은 응답을 반복하는 루프 감지용 */
  private lastFinalResponse = "";
  /** 이번 run 에서 크로스턴 반복 교정을 이미 1회 수행했는지 (무한 재시도 방지) */
  private loopBroken = false;
  /** 이번 run 의 메인 루프에서 도구를 한 번이라도 호출했는지 — '도구 쓰다 중도 종료'와 '순수 대화 종료' 구분용 */
  private calledToolThisRun = false;
  /**
   * 컨텍스트 초과를 만나면 이번 턴 동안만 낮춰 잡는 실효 히스토리 예산(문자). null 이면 config 값 사용.
   * 매 run() 시작 시 원복한다 — 일회성 초과가 세션 전체 맥락을 계속 굶기지 않도록.
   */
  private budgetOverride: number | null = null;

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

  /**
   * 현재 작업 폴더(root+workdir)의 얕은 목록과 감지된 프로젝트 유형을 요약한다.
   * 소형 모델이 "여기 이미 프로젝트가 있다"는 사실을 인지하지 못해 create-* 로
   * 새 프로젝트를 중첩 생성(myapp/myapp)하거나 엉뚱한 곳에 파일을 흩뿌리는 실수를
   * 막기 위한 선제적 맥락. 폴더가 비어 있으면 빈 문자열(주입 안 함).
   */
  private describeWorkdir(): string {
    const dir = resolve(this.deps.config.cwd, this.workdir);
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return ""; // 폴더가 아직 없음(첫 작업) → 스냅샷 없음
    }
    // 노이즈(빌드 산출물·VCS·의존성) 숨김 — 신호가 되는 항목만 남긴다.
    const IGNORE = new Set([".git", "node_modules", ".next", "dist", "build", ".turbo", ".cache"]);
    const visible = entries.filter((e) => !IGNORE.has(e) && (!e.startsWith(".") || e === ".env"));
    if (!visible.length) return ""; // 빈(또는 노이즈뿐인) 폴더 → 새로 만들어도 되므로 스냅샷 불필요

    const items = visible
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

    const project = this.detectProject(dir, entries);
    const loc = this.workdir ? `워크스페이스 루트 기준 '${this.workdir}'` : "워크스페이스 루트";
    const lines = [
      Agent.WD_SNAPSHOT,
      `현재 작업 폴더(${loc})에 이미 다음 항목들이 있습니다:`,
      "  " + shown.join("  ") + more,
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
    return [...this.usedSkills];
  }

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
        this.plan = steps;
        this.deps.log(renderPlan(steps));
      },
      getPlan: () => this.plan,
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
    const plan = this.plan.length ? renderPlan(this.plan) : "";
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

  /**
   * 컨텍스트 예산을 넘으면 오래된 히스토리를 처리한다.
   * contextSummarize=true 면 버릴 부분을 LLM 으로 요약해 누적 요약에 반영(세션 유지),
   * 아니면 그냥 잘라낸다. 요약 실패 시 절삭으로 폴백한다.
   */
  /** 실효 히스토리 예산(문자). 컨텍스트 초과로 낮춰졌으면 그 값을, 아니면 config 값을 쓴다. */
  private budgetChars(): number {
    return this.budgetOverride ?? this.deps.config.contextMaxChars;
  }

  /** 시스템 메시지를 제외한 현재 히스토리의 대략적 문자 크기 — 5xx 가 실제 컨텍스트 초과인지 판단용. */
  private historyChars(): number {
    let n = 0;
    for (let i = 1; i < this.messages.length; i++) n += messageSize(this.messages[i]);
    return n;
  }

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

  /**
   * 본격적인 작업 루프에 들어가기 전에, update_plan 만 노출한 별도 LLM 호출로
   * 할 일 목록(Todo)을 먼저 세운다. 도구를 하나만 제공하고 그 도구를 강제(tool_choice)해
   * 소형 모델도 계획을 확실히 만들도록 한다. 강제 tool_choice 미지원 서버를 대비해
   * "required" → "auto" 순으로 폴백하고, 끝내 실패하면 계획 없이 진행한다.
   */
  /**
   * 하이브리드 스킬 라우터: autoPlan 직전에, 요청을 스킬 카테고리 진입점과 매칭해 강하게 맞는
   * 스킬이 있으면 그 지침을 이번 턴에 주입한다. 소형 모델은 스킬을 자율적으로 못 고르므로(실측 확인),
   * 프레임워크가 LLM 분류 1회로 결정해 결정적으로 로드한다. 이어가기·짧은 입력·매칭 실패면 아무것도 안 한다.
   */
  private async maybeRouteSkill(userInput: string): Promise<void> {
    const input = userInput.trim();
    // 라우팅하지 않는 경우: (1) 아주 짧은 입력, (2) 앞이 이어가기어로 시작, (3) 문장 어디든
    // '기존 작업 이어가기' 신호. 이어가기는 새 스킬을 로드하지 않고 현재 세션 맥락/파일로 이어가야 한다
    // (예: "sudoku-game 진행하던거 계속" 을 엉뚱한 스킬로 라우팅해 작업이 장악당하던 문제 방지).
    // Korean 은 \b 가 안 먹어 시작형은 뒤에 공백/끝/문장부호를 명시. 6자 임계로 짧은 정식 요청은 허용.
    const continuationStart =
      /^(진행|다음|계속|계속해|이어|이어서|이전|마저|아까|그다음|continue|go|ok|네|응|그래|yes|더)(\s|$|[.,!?])/i;
    const continuationRef = /(진행하던|하던\s?거|하던\s?것|이어서\s?(진행|해|만들|작업)|계속\s?(진행|해|만들|작업)|이어\s?진행)/;
    if (input.length < 6 || continuationStart.test(input) || continuationRef.test(input)) return;
    const candidates = this.deps.skills.categoryEntries();
    if (!candidates.length) return;
    const chosen = await this.classifySkill(input, candidates);
    if (!chosen) return;
    this.deps.log(`  ↳ 스킬 라우팅: '${chosen.name}' 자동 로드 (요청에 맞는 스킬)`);
    this.usedSkills.add(chosen.name);
    this.messages.push({
      role: "user",
      content:
        "이 요청에 맞는 스킬을 로드했습니다. 다른 작업을 시작하기 전에 아래 지침을 그대로 따르세요.\n\n" +
        renderSkillInstructions(chosen),
    });
  }

  /**
   * 요청에 가장 알맞은 스킬 하나를 LLM 분류(도구 없는 단발 호출)로 고른다.
   * 한국어 요청 ↔ 영어 스킬 설명의 교차언어 매칭을 위해 키워드 대신 LLM 을 쓴다.
   * 이름/NONE 만 답하도록 강하게 제약하고, 답이 애매하면 null(로딩 안 함).
   */
  private async classifySkill(input: string, candidates: Skill[]): Promise<Skill | null> {
    // 이름 대신 '번호'로 답하게 한다 — 모델이 요청의 단어(예: "NextJS")를 그대로 뱉어 파싱이 깨지는
    // 것을 막고, 정수 하나만 뽑으면 되므로 견고하다. 0 = 해당 없음.
    const list = candidates.map((s, i) => `${i + 1}) ${s.name}: ${s.description}`).join("\n");
    try {
      const msg = await this.deps.llm.complete(
        [
          {
            role: "system",
            content:
              "아래 번호 목록에서 사용자 요청에 가장 잘 맞는 스킬의 '번호' 하나만 출력해라. " +
              "개발·설계·문서·데이터·웹/앱 제작 등 전문 작업이면 완벽히 일치하지 않아도 가장 근접한 번호를 고른다. " +
              "★ 코드·앱·웹사이트·게임을 '구현/개발/코딩/만들기' 하려는 요청이면 실제 코드를 만드는 구현 스킬" +
              "(web·mobile·desktop·각 백엔드 프레임워크·codegen)을 우선 골라라. game-master(TRPG 게임 진행)·" +
              "story-studio·quiz-forge 같은 콘텐츠 생성 스킬은 그 콘텐츠 자체를 원할 때만 고르고, '게임을 코드로 구현' 요청엔 고르지 마라. " +
              "인사·잡담·단순 사실 질문이거나 이어가기 요청처럼 어떤 스킬과도 무관할 때만 0 을 출력해라. 다른 말 없이 숫자 하나만.",
          },
          { role: "user", content: `요청:\n${input}\n\n0) 해당 없음\n${list}` },
        ],
        [],
      );
      const m = (msg.content ?? "").match(/\d+/); // 응답에서 첫 정수만 취함
      if (!m) return null;
      const n = parseInt(m[0], 10);
      return n >= 1 && n <= candidates.length ? candidates[n - 1] : null; // 0·범위밖 → 무라우팅
    } catch {
      return null; // 분류 호출 실패 → 라우팅 없이 진행
    }
  }

  private async planFirst(): Promise<void> {
    const planTool = this.tools.get("update_plan");
    const planDef = this.openaiTools.find((t) => t.function.name === "update_plan");
    if (!planTool || !planDef) return; // update_plan 도구가 비활성화된 경우

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
          result = await planTool.run(parsed, this.ctx());
        } catch (err: any) {
          result = `계획 도구 오류: ${err.message}`;
        }
        this.pushToolResult(call.id, result);
      }
      if (this.plan.length) return; // 계획 수립 성공
    }
  }

  /**
   * 현재 계획을 다시 보여주고 다음 단계로 진행하도록 안내하는 리마인더 문자열.
   * 계획이 없으면 null. 매 스텝 임시로 주입해 소형 모델이 목록을 놓치거나 같은 도구를
   * 반복 호출하는 것을 막는다(반복 억제의 핵심).
   */
  private planReminder(): string | null {
    const steps = this.plan;
    if (!steps.length) return null;
    const remaining = steps.filter((s) => s.status !== "completed");
    if (!remaining.length) {
      return "계획의 모든 단계를 완료했습니다. 더 이상 도구를 호출하지 말고 사용자 요청에 대한 최종 답변을 작성하세요.";
    }
    const next = steps.find((s) => s.status === "in_progress") ?? remaining[0];
    // 방금 계획만 갱신했다면(실제 작업 없이) 계획 갱신을 멈추고 작업하라고 더 단호히 안내한다.
    const churnWarning =
      this.planOnlyStreak >= 1
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

  /**
   * 다음 자동 저장 파일에 붙일 순번. 이번 run 에서 이미 매긴 번호(artifactSeq)와
   * 폴더에 실제로 존재하는 NN- 파일의 최대치(모델이 직접 쓴 것 포함) 중 큰 값 +1 로 정해
   * 중복(덮어쓰기)·순서 역전을 막는다.
   */
  private nextArtifactSeq(): number {
    return Math.max(this.artifactSeq, maxArtifactSeq(this.deps.config.cwd)) + 1;
  }

  /**
   * 최상위 요청이 긴 문서형 답변을 냈는데 이번 턴에 write_file 을 한 번도 쓰지 않았다면,
   * 그 답변을 작업 폴더에 .md 로 자동 저장한다(소형 모델이 산출물을 파일로 안 남기는 문제 보완).
   * 저장은 write_file 도구를 거치므로 승인 게이트/샌드박스를 그대로 탄다.
   * 저장하면 반환 텍스트 끝에 저장 경로 안내를 덧붙인다.
   */
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

  private async maybeAutoSave(text: string, msg?: ChatCompletionMessageParam): Promise<string> {
    if (!this.deps.config.autoSaveArtifacts || this.depth !== 0 || this.wroteFile) return text;
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
      const res = await writeTool.run({ path: filename, content: body }, this.ctx());
      if (res.startsWith("사용자가")) return text; // 승인 거부 → 답변만 반환
      this.artifactSeq = seq; // 저장 성공 시에만 순번 확정(거부/실패 시 번호 낭비 방지)
      this.wroteFile = true;
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
    if (this.savedArtifacts.has(key)) {
      // 이미 같은 산출물을 저장했음 → 재저장 없이 원문만 치환(히스토리 비대 방지)
      msg.content = interimPointerSaved(body);
      return;
    }

    const seq = this.nextArtifactSeq();
    const filename = `${pad2(seq)}-${base}`;
    try {
      const res = await writeTool.run({ path: filename, content: body }, this.ctx());
      if (res.startsWith("사용자가")) return; // 승인 거부 → 조용히 통과
      this.artifactSeq = seq; // 저장 성공 시에만 순번 확정
      this.savedArtifacts.add(key);
      this.deps.log(`  ↳ (중간 산출물 자동 저장) write_file(${filename})`);
      // 저장한 문서 원문을 히스토리에서 포인터로 치환한다. 원문은 파일에 보존되며,
      // 이렇게 해야 여러 Phase 문서가 히스토리에 누적돼 컨텍스트 예산을 넘기고 compact() 가
      // 작업 맥락을 통째로 버려(→ 초기 상태로 회귀) 버리는 문제를 막는다.
      msg.content = interimPointer(filename, body);
    } catch {
      /* 저장 실패해도 작업은 계속 진행 */
    }
  }

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
    this.usedSkills.clear(); // 이번 요청에 발동한 스킬만 추적
    this.toolCallCounts.clear(); // 반복 호출 카운터 초기화
    this.planOnlyStreak = 0; // 계획만 반복 카운터 초기화
    this.wroteFile = false; // 파일 저장 여부 초기화
    this.savedArtifacts.clear(); // 중간 산출물 자동 저장 기록 초기화
    this.artifactSeq = 0; // 자동 저장 순번 초기화(실제 순번은 저장 시 폴더 최대치와 함께 산정)
    this.plan = []; // 새 요청마다 계획 초기화
    this.loopBroken = false; // 크로스턴 반복 교정 플래그 초기화 (lastFinalResponse 는 턴을 넘어 유지)
    this.calledToolThisRun = false; // 메인 루프 도구 호출 여부 초기화
    this.budgetOverride = null; // 예산 축소는 매 사용자 턴마다 원복 — 일회성 초과가 세션을 계속 굶기지 않게

    // 현재 작업 폴더 상태를 선제적으로 주입 — 소형 모델이 "이미 프로젝트가 있다"를 인지 못해
    // create-* 로 새 프로젝트를 중첩 생성하거나 엉뚱한 경로에 파일을 흩뿌리는 실수를 막는다.
    // 이전 턴의 오래된 스냅샷은 제거하고(최신 하나만 유지) 사용자 메시지 '앞'에 넣어,
    // 라우팅·계획 단계가 참조하는 '바로 위 요청'은 여전히 사용자 요청이 되게 한다.
    this.messages = this.messages.filter(
      (m) => !(m.role === "user" && typeof m.content === "string" && m.content.startsWith(Agent.WD_SNAPSHOT)),
    );
    const wdSnapshot = this.describeWorkdir();
    if (wdSnapshot) this.messages.push({ role: "user", content: wdSnapshot });

    if (skill) {
      this.deps.log(`  ↳ 스킬 로드: ${skill.name}`);
      this.usedSkills.add(skill.name);
      const instructions = renderSkillInstructions(skill);
      const content = userInput.trim()
        ? `${instructions}\n\n----- 사용자 요청 -----\n${userInput}`
        : instructions;
      this.messages.push({ role: "user", content });
    } else {
      this.messages.push({ role: "user", content: userInput });
    }

    // 최상위 요청이면 본격 작업 전에 (1) 요청에 맞는 스킬을 자동 로드하고(하이브리드 라우터),
    // (2) Todo 계획을 먼저 세운다(소형 모델의 반복·이탈 억제).
    // 둘 중 하나라도 할 때만 미리 compact 한다(둘 다 아니면 아래 루프의 compact 가 처리).
    const willRoute = this.deps.config.skillRouter && !skill;
    if (this.depth === 0 && (willRoute || this.deps.config.autoPlan)) {
      await this.compact();
      if (willRoute) await this.maybeRouteSkill(userInput);
      if (this.deps.config.autoPlan) await this.planFirst();
    }

    for (let step = 0; step < this.deps.config.maxSteps; step++) {
      // 모델 호출. 서버가 컨텍스트 초과를 반환하면 예산을 줄여 더 엄격히 compact 후 재시도한다.
      // (매 시도마다 compact → 리마인더 주입 → 호출. 리마인더는 이번 호출에만 쓰고 곧바로 제거)
      let msg: Awaited<ReturnType<LLM["complete"]>> | null = null;
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
          msg = onToken
            ? await this.deps.llm.completeStream(this.messages, this.openaiTools, onToken)
            : await this.deps.llm.complete(this.messages, this.openaiTools);
          if (remIdx >= 0) this.messages.splice(remIdx, 1); // 임시 리마인더 제거
          break;
        } catch (err) {
          if (remIdx >= 0) this.messages.splice(remIdx, 1);
          const ctxByKeyword = isContextOverflow(err); // 본문에 '창 초과' 문구가 명시된 경우
          const serverErr = typeof (err as any)?.status === "number" && (err as any).status >= 500;
          if (attempt < 4 && (ctxByKeyword || serverErr)) {
            const cur = this.budgetChars();
            // 축소는 '실제로 히스토리가 예산에 근접'하거나 본문이 명시적 창 초과일 때만 의미가 있다.
            // 히스토리가 작은데 나는 5xx 는 컨텍스트 문제가 아니라 다른 원인(잘린 tool_call·일시 오류)이므로
            // 예산을 붕괴시키지 말고 그대로 재시도한다(과잉 축소로 이후 턴 맥락이 굶는 것을 방지).
            const historyIsLarge = this.historyChars() > cur * 0.6;
            if ((ctxByKeyword || historyIsLarge) && cur > 3000) {
              this.budgetOverride = Math.max(2500, Math.floor(cur / 2));
              this.deps.log(`  ↳ (컨텍스트 초과 → 히스토리 예산 ${cur}→${this.budgetOverride}자로 줄여 재시도)`);
            } else {
              this.deps.log(`  ↳ (서버 5xx·히스토리 여유 있음 → 예산 유지하고 재시도 ${attempt + 1}/4)`);
            }
            continue;
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
      }
      if (!msg) continue; // 도달 불가(루프는 성공 시에만 탈출) — 타입 안정용 가드
      this.messages.push(msg as ChatCompletionMessageParam);

      const toolCalls = msg.tool_calls ?? [];
      if (toolCalls.length === 0) {
        // 텍스트로 뱉은 도구 호출 마크업([TOOL_REQUEST] 등)은 최종 답변에서 걷어낸다.
        const cleaned = stripTextToolCalls(msg.content ?? "");
        if (typeof msg.content === "string") msg.content = cleaned; // 히스토리도 정제본
        const finalText = cleaned || "(응답 없음)";
        // 이탈(derailment)·중도 멈춤 감지 → run 당 1회 교정 지시 후 재생성. 두 신호를 본다:
        //  (a) 크로스턴 반복: 직전 '턴'의 최종 응답과 사실상 동일 (같은 되묻기 무한 반복).
        //  (b) 계획 미완 중도 종료: 계획에 남은 단계가 있는데(이번 턴에 도구는 썼으나) 무-도구 텍스트로
        //      끝내려 함. 특히 "~하겠습니다/하고 있습니다"처럼 '할 것'이라 서술만 하고 정작 그 도구를
        //      호출하지 않은 채 턴을 끝내는 소형 모델의 대표적 중도 멈춤을 잡는다.
        //      (계획이 모두 완료됐거나 도구를 아예 안 쓴 순수 대화 턴은 제외 — 밀어붙이지 않음)
        const planRemaining = this.plan.some((s) => s.status !== "completed");
        const bailedOnPlan = this.plan.length > 0 && planRemaining && this.calledToolThisRun;
        if (!this.loopBroken && (this.isRepeatOfLastFinal(finalText) || bailedOnPlan)) {
          this.loopBroken = true;
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
              "처음부터 다시 안내하거나 되묻지 말고, list_skills 로 스킬을 새로 탐색하지도 마세요. " +
              "정보가 부족하면 합리적으로 가정해 진행하세요.",
          });
          continue; // 다음 스텝에서 교정 지시를 반영해 재생성
        }
        this.lastFinalResponse = normalizeForCompare(finalText);
        // 빈/공백 응답(소형 모델의 빈 턴)은 명시적으로 표기
        return await this.maybeAutoSave(finalText, msg as ChatCompletionMessageParam);
      }

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
        } else {
          // 인자가 비었거나(모델이 인자 없이 호출·응답 토큰 한도로 잘림) 유효하지 않은 JSON 이면
          // 도구 실행은 건너뛰고, 위에서 정규화한 "{}" 만 히스토리에 남겨 다음 요청을 정상화한다.
          let parsed: Record<string, any> = {};
          if (!rawArgs) {
            result =
              "도구 인자가 비어 있습니다(응답 토큰 한도로 잘렸을 수 있음). " +
              "긴 산출물은 한 번에 다 쓰지 말고, write_file 을 여러 번에 나눠 호출하세요 " +
              "— 첫 조각은 그냥, 이후 조각은 같은 path 에 mode=\"append\" 로 이어 쓰면 됩니다.";
            this.pushToolResult(call.id, result);
            continue;
          }
          try {
            parsed = JSON.parse(rawArgs);
          } catch {
            call.function.arguments = "{}";
            result =
              "도구 인자가 잘려(응답 토큰 한도 초과) 파싱에 실패했습니다. 긴 산출물은 write_file 을 " +
              `여러 번에 나눠(이후 조각은 같은 path 에 mode="append") 호출하세요. (잘린 인자 앞부분: ${rawArgs.slice(0, 80)})`;
            this.pushToolResult(call.id, result);
            continue;
          }
          // 동일 (도구+인자) 반복 호출 억제 — 소형 모델의 루프 방지
          const sig = `${tool.name}|${stableStringify(parsed)}`;
          const prior = this.toolCallCounts.get(sig) ?? 0;
          this.toolCallCounts.set(sig, prior + 1);
          if (prior >= 1) {
            this.deps.log(`  ↳ (반복 억제) ${tool.name}`);
            // 3번째 동일 호출 → 넛지를 무시하고 루프 중이므로, 도구 없이 강제 종료
            if (prior >= 2) forceFinal = true;
            result =
              `'${tool.name}' 을(를) 동일한 인자로 이미 호출했고 결과는 위 대화에 있습니다. ` +
              `같은 호출을 반복하지 말고 지금까지의 정보로 최종 답변을 작성하세요.`;
            this.pushToolResult(call.id, result);
            continue;
          }

          this.deps.log(`  ↳ ${tool.name}(${summarizeArgs(parsed)})`);
          // 모델이 invoke_skill 로 실제 스킬을 로드하면 발동 기록
          if (tool.name === "invoke_skill" && parsed.name) {
            const resolved = this.deps.skills.get(String(parsed.name));
            if (resolved) this.usedSkills.add(resolved.name);
          }
          try {
            result = await tool.run(parsed, this.ctx());
            this.calledToolThisRun = true; // 메인 루프에서 도구를 호출함
            // 산출물을 파일로 남겼는지 추적 (자동 저장 폴백 판단용)
            if (tool.name === "write_file") {
              this.wroteFile = true;
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
        toolCalls.every((c) => c.type === "function" && c.function.name === "update_plan");
      this.planOnlyStreak = onlyPlan ? this.planOnlyStreak + 1 : 0;
      if (this.planOnlyStreak >= 3) {
        this.deps.log("  ↳ (계획만 반복 → 도구 없이 최종 답변 강제)");
        forceFinal = true;
      }

      // 같은 도구를 반복 호출하는 루프가 감지되면, 도구 없이 강제로 최종 답변을 생성한다.
      if (forceFinal) {
        this.deps.log("  ↳ (루프 감지 → 도구 없이 최종 답변 강제)");
        this.messages.push({
          role: "user",
          content:
            "도구를 반복 호출하고 있습니다. 더 이상 도구를 호출하지 마세요. " +
            "도구 호출 형식([TOOL_REQUEST]·<tool_call> 등)이나 JSON 을 출력하지 말고, " +
            "지금까지 한 작업을 한국어 문장으로만 간결히 요약해 최종 답변을 작성하세요.",
        });
        // 도구를 끈 호출이라 일부 모델(qwen 등)은 도구 호출을 '텍스트'([TOOL_REQUEST]…)로 뱉는다.
        // 스트리밍하면 그 날것이 그대로 사용자에게 노출되므로, 버퍼링(complete)으로 받은 뒤
        // 텍스트형 도구호출 마크업을 제거하고 정제본만 출력·저장한다.
        const finalMsg = await this.deps.llm.complete(this.messages, []);
        let forcedText = stripTextToolCalls(finalMsg.content ?? "");
        if (!forcedText)
          forcedText =
            "반복이 감지되어 작업을 중단했습니다. 지금까지 생성한 산출물은 작업 폴더에 저장돼 있습니다.";
        (finalMsg as any).content = forcedText; // 히스토리에도 정제본만 남긴다
        this.messages.push(finalMsg as ChatCompletionMessageParam);
        if (onToken) onToken(forcedText); // 정제된 최종 텍스트를 사용자에게 출력
        this.lastFinalResponse = normalizeForCompare(forcedText);
        return await this.maybeAutoSave(forcedText, finalMsg as ChatCompletionMessageParam);
      }
    }
    return `최대 반복 횟수(${this.deps.config.maxSteps})에 도달해 중단했습니다.`;
  }

  private pushToolResult(toolCallId: string, content: string): void {
    this.messages.push({ role: "tool", tool_call_id: toolCallId, content });
  }
}

/** 메시지 하나의 대략적 크기(문자 수) */
function messageSize(m: ChatCompletionMessageParam): number {
  let n = (typeof m.content === "string" ? m.content.length : 0) + 20;
  const tc = (m as any).tool_calls;
  if (Array.isArray(tc)) {
    for (const c of tc) n += (c.function?.name?.length ?? 0) + (c.function?.arguments?.length ?? 0) + 10;
  }
  return n;
}

/**
 * 히스토리를 예산 기준으로 { system, dropped, kept } 로 나눈다.
 * - system 메시지(messages[0])는 항상 유지.
 * - 최신부터 예산까지가 kept, 그보다 오래된 앞부분이 dropped.
 * - tool_call 짝을 깨지 않도록 kept 는 user 메시지에서 시작 (앞쪽 orphan 은 dropped 로).
 * (OpenAI 규칙: assistant(tool_calls) 뒤엔 반드시 대응 tool 메시지가 와야 함)
 */
export function splitHistory(
  messages: ChatCompletionMessageParam[],
  maxChars: number,
): {
  system: ChatCompletionMessageParam[];
  dropped: ChatCompletionMessageParam[];
  kept: ChatCompletionMessageParam[];
} {
  const system = messages[0]?.role === "system" ? [messages[0]] : [];
  const rest = messages.slice(system.length);
  const systemChars = system.reduce((s, m) => s + messageSize(m), 0);
  const budget = Math.max(0, maxChars - systemChars);

  let startIdx = rest.length; // kept = rest.slice(startIdx)
  let total = 0;
  for (let i = rest.length - 1; i >= 0; i--) {
    const size = messageSize(rest[i]);
    if (total + size > budget && startIdx <= rest.length - 1) break; // 최소 1개는 유지
    total += size;
    startIdx = i;
  }
  // 앞쪽 orphan(비 user)을 버려 user 경계에서 시작
  while (startIdx < rest.length && rest[startIdx].role !== "user") startIdx++;
  return { system, dropped: rest.slice(0, startIdx), kept: rest.slice(startIdx) };
}

/** 히스토리가 예산을 넘으면 오래된 메시지를 잘라낸다 (요약 없이 버림). */
export function truncateHistory(
  messages: ChatCompletionMessageParam[],
  maxChars: number,
): ChatCompletionMessageParam[] {
  if (messages.length === 0) return messages;
  const { system, kept } = splitHistory(messages, maxChars);
  return [...system, ...kept];
}

/** 키 순서와 무관하게 안정적인 JSON 문자열 (반복 호출 시그니처용) */
function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj) ?? "null";
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(",")}]`;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

/**
 * 저장한 문서 원문을 대신해 히스토리에 남길 짧은 포인터. 원문은 파일에 보존되므로
 * 모델은 "무엇을 만들어 어디에 저장했는지"만 알면 되고, 히스토리는 가볍게 유지된다.
 */
function interimPointer(filename: string, body: string): string {
  const heading = body.match(/^#{1,6}\s+(.+)$/m)?.[1] ?? body.split("\n")[0] ?? "산출물";
  return `📄 [문서 「${heading.trim().slice(0, 60)}」 을(를) 파일로 저장함: ${filename}] (원문은 파일에 보존 — 히스토리에서는 생략)`;
}

/** 이미 파일로 저장된(파일명 불명) 문서 원문을 대신할 히스토리 포인터. */
function interimPointerSaved(body: string): string {
  const heading = body.match(/^#{1,6}\s+(.+)$/m)?.[1] ?? body.split("\n")[0] ?? "산출물";
  return `📄 [문서 「${heading.trim().slice(0, 60)}」 를 파일로 저장함] (원문은 파일에 보존 — 히스토리에서는 생략)`;
}

/** 크로스턴 반복 감지용 정규화 (공백 접기·소문자화). */
function normalizeForCompare(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * 모델이 도구 호출을 API(tool_calls) 가 아니라 '텍스트'로 뱉는 경우의 마크업을 제거한다.
 * 특히 도구를 끈 호출(forceFinal)에서 qwen/Hermes 계열이 [TOOL_REQUEST]…나 <tool_call>… 를
 * 본문에 그대로 흘리는데, 그게 사용자에게 노출·히스토리에 저장되지 않도록 걷어낸다.
 * (닫는 태그 없이 잘린 경우도 뒤까지 통째로 제거)
 */
function stripTextToolCalls(text: string): string {
  return text
    .replace(/\[TOOL_REQUEST\][\s\S]*?\[END_TOOL_REQUEST\]/g, "")
    .replace(/\[TOOL_REQUEST\][\s\S]*$/g, "")
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "")
    .replace(/<tool_call>[\s\S]*$/g, "")
    .replace(/<\|tool_call\|>[\s\S]*$/g, "")
    .replace(/```tool_code[\s\S]*?```/g, "")
    .trim();
}

/**
 * 컨텍스트 창 초과 계열 에러인지 판별한다. 서버·SDK 마다 문구가 달라(LM Studio·Ollama·vLLM 등)
 * 메시지와 파싱된 본문(err.error)을 폭넓게 매칭한다.
 */
function isContextOverflow(err: any): boolean {
  // 본문에 '창 초과'가 명시된 경우만 true (키워드 기반). 일반 5xx 는 호출부에서 히스토리 크기를
  // 함께 보고 축소 여부를 판단한다 — 키워드 없는 5xx 를 무조건 창 초과로 보면 예산이 과잉 붕괴한다.
  const body = err?.error ?? err?.response?.data ?? err?.response?.body ?? "";
  const s = `${err?.message ?? ""} ${typeof body === "string" ? body : JSON.stringify(body)}`.toLowerCase();
  return (
    s.includes("context length") ||
    s.includes("context window") ||
    s.includes("context size") ||
    s.includes("maximum context") ||
    s.includes("tokens to keep") ||
    s.includes("too many tokens") ||
    s.includes("exceeds") ||
    (s.includes("token") && (s.includes("maximum") || s.includes("limit") || s.includes("too long")))
  );
}

/** 자동 저장할 산출물의 파일명을 만든다 (첫 마크다운 헤더/첫 줄에서 유도 + 타임스탬프). */
export function artifactFilename(body: string, now: Date = new Date()): string {
  const heading = body.match(/^#{1,6}\s+(.+)$/m)?.[1] ?? body.split("\n")[0] ?? "산출물";
  let base = heading
    .replace(/[^\p{L}\p{N}\s-]/gu, "") // 문자·숫자·공백·하이픈만 남김(이모지·괄호·기호 제거)
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40)
    .replace(/^-+|-+$/g, "");
  if (!base) base = "산출물";
  const ts = now.toISOString().replace(/[:.]/g, "-").slice(0, 19); // YYYY-MM-DDTHH-MM-SS
  return `${base}-${ts}.md`;
}

/** 정수를 최소 두 자리로 0 채움 (01, 02 … 100). 자동 저장 파일 순번용. */
export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * 폴더 안의 자동 저장 파일(`NN-...`) 중 가장 큰 순번을 반환한다(없으면 0).
 * run 시작 시 이 값에서 이어 번호를 매겨, 여러 턴에 걸쳐도 순번이 겹치거나 되돌아가지 않게 한다.
 */
export function maxArtifactSeq(dir: string): number {
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return 0; // 폴더가 아직 없으면 0부터
  }
  let max = 0;
  for (const f of files) {
    const m = f.match(/^(\d{2,})-/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

/** 로그에 찍을 도구 인자 요약 (길면 자름) */
function summarizeArgs(args: Record<string, any>): string {
  const s = Object.entries(args)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(", ");
  return s.length > 120 ? s.slice(0, 117) + "..." : s;
}

export { systemPrompt };
