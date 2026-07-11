import type { Config } from "./config.js";
import type { LLM, ChatCompletionMessageParam } from "./llm.js";
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
  return [
    identity,
    "",
    "도구(tool)를 호출해 파일을 읽고 쓰고, 셸 명령을 실행하며 작업을 수행합니다.",
    "",
    "## 스킬 사용 규칙",
    "사용자의 요청에 맞는 스킬이 있으면, 다른 작업을 시작하기 전에 그 스킬을 사용하세요.",
    "1) 아래 카테고리 개요에서 관련 카테고리를 고르고, list_skills(category) 로 후보 스킬을 확인합니다.",
    "   (스킬 목록이 이미 전부 보이면 이 단계는 건너뜁니다.)",
    "2) 적합한 스킬을 invoke_skill(name) 으로 로드하고, 반환된 지침을 그대로 따릅니다.",
    "부합하는 스킬이 없으면 일반 도구로 직접 해결하세요.",
    "",
    "## 스킬 개요",
    skills.overview(),
    "",
    "## 행동 원칙",
    "- 추측하지 말고 도구로 사실을 확인하세요 (파일을 읽고, 명령을 실행).",
    "- 3단계 이상 걸리는 작업이면 시작할 때 update_plan 으로 할 일 목록을 세우고,",
    "  각 단계를 시작할 때 in_progress, 끝낼 때 completed 로 갱신하며 진행하세요.",
    "- 크고 자기완결적인 하위 작업은 spawn_agent 로 서브에이전트에게 위임할 수 있습니다.",
    hasSoul
      ? "- 모든 답변은 위 '정체성'의 이름·성격·말투를 유지한 채 간결한 한국어로 하세요. 절대 일반 어시스턴트 말투로 돌아가지 마세요."
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
  /** 기본 시스템 프롬프트(요약 블록 제외) */
  private baseSystem: string;
  /** 압축된 오래된 대화의 누적 요약 */
  private summary: string;

  constructor(private deps: AgentDeps) {
    this.tools = toolMap(deps.tools);
    this.openaiTools = deps.tools.map(toOpenAITool);
    this.depth = deps.depth ?? 0;
    this.baseSystem = systemPrompt(deps.skills, deps.soul);
    this.summary = deps.summary ?? "";
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

  /** 시스템 메시지를 제외한 대화 내역 (영속화용) */
  exportHistory(): ChatCompletionMessageParam[] {
    return this.messages.filter((m) => m.role !== "system");
  }

  /** 직전 run() 에서 발동한 스킬 이름 목록 */
  getUsedSkills(): string[] {
    return [...this.usedSkills];
  }

  private ctx(): ToolContext {
    return {
      cwd: this.deps.config.cwd,
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

  /** 하위 작업을 처리할 서브에이전트를 생성해 실행하고 최종 텍스트를 반환 */
  private async spawnChild(task: string): Promise<string> {
    if (this.depth + 1 > this.deps.config.maxDepth) {
      return `서브에이전트 최대 깊이(${this.deps.config.maxDepth})를 초과해 위임할 수 없습니다. 직접 처리하세요.`;
    }
    const child = new Agent({
      ...this.deps,
      history: undefined, // 서브에이전트는 새 대화로 시작
      summary: undefined,
      depth: this.depth + 1,
    });
    return child.run(task);
  }

  /**
   * 컨텍스트 예산을 넘으면 오래된 히스토리를 처리한다.
   * contextSummarize=true 면 버릴 부분을 LLM 으로 요약해 누적 요약에 반영(세션 유지),
   * 아니면 그냥 잘라낸다. 요약 실패 시 절삭으로 폴백한다.
   */
  private async compact(): Promise<void> {
    const budget = this.deps.config.contextMaxChars;
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

    for (let step = 0; step < this.deps.config.maxSteps; step++) {
      // 컨텍스트 초과 방지: 매 호출 전 오래된 히스토리를 요약/절삭으로 예산 내로
      await this.compact();
      const msg = onToken
        ? await this.deps.llm.completeStream(this.messages, this.openaiTools, onToken)
        : await this.deps.llm.complete(this.messages, this.openaiTools);
      this.messages.push(msg as ChatCompletionMessageParam);

      const toolCalls = msg.tool_calls ?? [];
      if (toolCalls.length === 0) {
        // 빈/공백 응답(소형 모델의 빈 턴)은 명시적으로 표기
        return msg.content?.trim() ? msg.content : "(응답 없음)";
      }

      let forceFinal = false;
      for (const call of toolCalls) {
        if (call.type !== "function") continue;
        const tool = this.tools.get(call.function.name);
        let result: string;
        if (!tool) {
          result = `알 수 없는 도구: ${call.function.name}`;
        } else {
          let parsed: Record<string, any> = {};
          try {
            parsed = call.function.arguments ? JSON.parse(call.function.arguments) : {};
          } catch {
            result = `도구 인자 JSON 파싱 실패: ${call.function.arguments}`;
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
          } catch (err: any) {
            result = `도구 오류: ${err.message}`;
          }
        }
        this.pushToolResult(call.id, result);
      }

      // 같은 도구를 반복 호출하는 루프가 감지되면, 도구 없이 강제로 최종 답변을 생성한다.
      if (forceFinal) {
        this.deps.log("  ↳ (루프 감지 → 도구 없이 최종 답변 강제)");
        this.messages.push({
          role: "user",
          content:
            "도구를 반복 호출하고 있습니다. 더 이상 도구를 호출하지 말고, 지금까지 모은 정보만으로 " +
            "사용자 요청에 대한 최종 답변을 지금 작성하세요.",
        });
        const finalMsg = onToken
          ? await this.deps.llm.completeStream(this.messages, [], onToken)
          : await this.deps.llm.complete(this.messages, []);
        this.messages.push(finalMsg as ChatCompletionMessageParam);
        return finalMsg.content?.trim() ? finalMsg.content : "(응답 없음)";
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

/** 로그에 찍을 도구 인자 요약 (길면 자름) */
function summarizeArgs(args: Record<string, any>): string {
  const s = Object.entries(args)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(", ");
  return s.length > 120 ? s.slice(0, 117) + "..." : s;
}

export { systemPrompt };
