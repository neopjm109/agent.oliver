// Plan 오케스트레이터 — human-in-the-loop 지휘자.
//
// 역할은 계획 수립 + 커서 유지 + 단계별 승인 게이트 + 산출물 체이닝 넷뿐이다. 실제 실행/생성은
// step.ts 의 prepareStep/commitStep(단일턴과 공유) 에 위임한다 — 과거 auto-loop(executePlan for 루프)와
// 자체 runScaffold/runCodeGen 을 폐기했다(생성 로직 이중화 = "역할 애매"의 근원이었다).
// (스펙: hitl-orchestrator-spec.md §3)
import type { Context, Intent, PlanStep, Skill, SkillResult, StagedPlan } from '../core/types.js';
import type { LLMClient } from '../core/llmClient.js';
import type { Runtime } from '../core/runtime.js';
import { detectFramework, isAffirmative, isNegative } from '../core/session.js';
import { join } from 'node:path';
import { artifactDir, writeArtifact } from '../core/executor.js';
import { resultFileName } from '../core/naming.js';
import { uniqueStamped } from '../core/uploads.js';
import { prepareStep, commitStep } from '../core/step.js';

/**
 * 계획 지시에서 모델이 흘린 JSON 구조 잔여물(끝/앞의 } , { " [ ] 등)을 제거한다.
 * 한국어 지시문은 이런 문자로 시작·종료하지 않으므로 앞뒤 절단은 안전하다.
 */
function cleanInstruction(s: string): string {
  return s.replace(/[\s"'`{}[\],]+$/g, '').replace(/^[\s"'`{}[\],]+/g, '').trim();
}

/** 계획 후보에서 제외할 메타/자기참조 intent (무한 재귀·잡음 방지). */
const EXCLUDE = new Set(['chitchat', 'unknown', 'plan_tasks', 'plan_and_run', 'convert_document', 'translate', 'write_tests', 'run_command']);
/** 저사양 안전장치 기본 스텝 상한. 설정(plan.maxSteps)·env(AGENT_MAX_STEPS)로 오버라이드. */
const DEFAULT_MAX_STEPS = 4;

export class PlanOrchestrator implements Skill {
  readonly name = 'plan-and-run';

  constructor(
    private llm: LLMClient,
    private intents: Intent[],
    /** runtime 은 이 스킬보다 늦게 생성되므로 지연 참조. 실제 호출은 요청 시점(초기화 후). */
    private getRuntime: () => Runtime,
    /** 계획 최대 단계. num_ctx 여유와 플래너 품질이 실질 천장(m2 보수, m4 여유). 기본 4. */
    private maxSteps: number = DEFAULT_MAX_STEPS,
  ) {}

  /** 계획 후보 = 메타/자기참조 제외 + 예시 있는(라우팅 가능한) intent. */
  private catalog(): Intent[] {
    return this.intents.filter((i) => !EXCLUDE.has(i.name) && i.examples.length > 0);
  }

  /**
   * 턴1(Skill.run): 계획을 세워 세션(pendingPlan)에 보관하고, 사람이 읽는 체크리스트를 반환한다.
   * 이후 사람이 한 단계씩 승인하며 진행 — pipeline 이 continuePlan 으로 이어받는다(자동 실행 안 함).
   */
  async run(ctx: Context): Promise<SkillResult> {
    const raw = await this.buildPlan(ctx.userText);
    if (!raw) {
      return { ok: false, text: '여러 단계로 나눠 실행할 만한 작업으로 보이지 않아요. 원하는 걸 조금 더 구체적으로 말씀해 주세요.' };
    }
    const plan: StagedPlan = { ...raw, cursor: 0, outputs: [], stage: 'awaiting_advance' };
    if (ctx.session) ctx.session.pendingPlan = plan;
    return { ok: true, text: this.renderPlan(plan), data: { plan } };
  }

  /** 계획을 사람이 읽는 체크리스트로(완료/대기 표시). 계획 편집 후 재확인에도 재사용. */
  renderPlan(plan: StagedPlan): string {
    const lines = plan.steps
      .map((s, i) => {
        const box = i < plan.cursor ? '[x]' : '[ ]';
        const tag = s.skill === 'scaffold_project' ? `${s.skill} · 실행` : s.skill;
        const cur = i === plan.cursor ? ' ◀ 다음' : '';
        return `${i + 1}. ${box} ${s.instruction}  (${tag})${cur}`;
      })
      .join('\n');
    return (
      `🎯 목표: ${plan.goal}\n\n할 일:\n${lines}\n\n` +
      `${plan.cursor + 1}번부터 시작할까요? (응 / "2번 빼줘"로 단계 제외 / 아니오)`
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Human-in-the-loop 상태기계 — pipeline 이 session.pendingPlan 이 있을 때 위임한다.
  // ───────────────────────────────────────────────────────────────────────────

  /** pendingPlan 이 있을 때 매 턴 진입. stage 에 따라 진행/커밋을 분기한다. 항상 문자열 응답. */
  async continuePlan(text: string, ctx: Context): Promise<string> {
    const plan = ctx.session!.pendingPlan!;
    return plan.stage === 'awaiting_commit'
      ? this.handleCommit(text, ctx, plan)
      : this.handleAdvance(text, ctx, plan);
  }

  /** stage=awaiting_advance — 다음 단계 진행 여부를 묻는 중. */
  private async handleAdvance(text: string, ctx: Context, plan: StagedPlan): Promise<string> {
    // 계획 편집: "2번 빼줘" — 단계 제외(1-based). 남으면 재확인, 비면 취소.
    if (/빼|제외|삭제|제거|말고|없이/.test(text)) {
      const drop = new Set(
        [...text.matchAll(/(\d+)/g)].map((m) => Number(m[1])).filter((n) => n >= 1 && n <= plan.steps.length),
      );
      if (drop.size) {
        plan.steps = plan.steps.filter((_, idx) => !drop.has(idx + 1));
        if (plan.steps.length === 0) {
          this.clear(ctx);
          return '모든 단계를 빼서 계획을 취소했어요.';
        }
        if (plan.cursor >= plan.steps.length) plan.cursor = 0;
        return this.renderPlan(plan);
      }
    }
    if (isNegative(text)) {
      this.clear(ctx);
      return plan.cursor > 0 ? `계획을 중단했어요. (${plan.cursor}/${plan.steps.length}단계까지 진행)` : '계획을 취소했어요.';
    }
    if (/건너뛰|스킵|skip|생략/i.test(text)) {
      plan.cursor++;
      return this.advanceOrFinish(ctx, plan, '이 단계를 건너뛰었어요.');
    }
    if (isAffirmative(text)) return this.runCurrent(ctx, plan);
    // 응/아니오/편집 아님 — 계획을 이탈하지 않고 재확인(스펙 §9).
    return `계획 진행 중이에요. ${this.advancePrompt(plan)}`;
  }

  /** stage=awaiting_commit — mutate 미리보기 후 커밋 대기. */
  private async handleCommit(text: string, ctx: Context, plan: StagedPlan): Promise<string> {
    if (/다시|재생성|다르게|수정/.test(text) && !isNegative(text)) {
      plan.stage = 'awaiting_advance';
      plan.preview = undefined;
      return this.runCurrent(ctx, plan); // 같은 단계 재생성
    }
    if (isAffirmative(text)) {
      const step = plan.steps[plan.cursor];
      const committed = await commitStep(plan.preview!.commit, ctx);
      plan.outputs.push({ skill: step.skill, text: committed.text });
      plan.preview = undefined;
      plan.stage = 'awaiting_advance';
      plan.cursor++;
      return committed.text + this.advanceOrFinishSuffix(ctx, plan);
    }
    if (isNegative(text) || /건너뛰|스킵|skip|생략/i.test(text)) {
      plan.preview = undefined;
      plan.stage = 'awaiting_advance';
      plan.cursor++;
      return this.advanceOrFinish(ctx, plan, '이 단계를 건너뛰었어요.');
    }
    return `이 단계를 적용할까요? (응 / 다시 / 건너뛰기)`;
  }

  /** 현재 커서 단계를 준비(prepareStep)한다. produce=즉시완료+전진, mutate=미리보기+커밋대기. */
  private async runCurrent(ctx: Context, plan: StagedPlan): Promise<string> {
    if (plan.cursor >= plan.steps.length) return this.finish(ctx, plan);
    const step = plan.steps[plan.cursor];
    const byName = new Map(this.intents.map((i) => [i.name, i]));
    const intent = byName.get(step.skill);
    if (!intent) {
      plan.cursor++;
      return this.advanceOrFinish(ctx, plan, `(등록되지 않은 단계 '${step.skill}' 건너뜀)`);
    }

    // 체이닝: 완료 단계 산출물을 ctx.outputs 로 실어 이번 단계가 이어받게 한다.
    const chained = plan.outputs.map((o) => ({ skill: o.skill, result: { ok: true, text: o.text } }));
    const stepCtx: Context = { ...ctx, outputs: chained };
    const baseDir = ctx.session?.lastProjectDir ?? `${artifactDir(plan.goal)}/code`;

    const prepared = await prepareStep({ llm: this.llm, runtime: this.getRuntime() }, intent, step.instruction, stepCtx, baseDir);
    const head = `## ${plan.cursor + 1}. ${step.instruction}\n\n`;

    if (prepared.kind === 'error') {
      // 생성 실패 — 커서 유지, 다시/건너뛰기 유도(정상 degrade).
      return `${head}${prepared.text}\n\n다시 시도할까요? (응=재시도 / 건너뛰기 / 아니오)`;
    }
    if (prepared.kind === 'produce') {
      // 텍스트 산출물 — 비파괴로 .md 저장하고 전진. 다음 단계 진행을 묻는다.
      let savedNote = '';
      try {
        const dir = artifactDir(plan.goal); // agent-output/<짧은 주제>
        const file = uniqueStamped(join(ctx.workspace, dir), resultFileName(step.skill, {}, prepared.text)); // 표준명_YYYYMMDD_NN
        const p = writeArtifact(ctx.workspace, `${dir}/${file}`, `# ${step.instruction}\n\n${prepared.text}\n`);
        savedNote = `\n\n💾 저장: ${p}`;
      } catch {
        /* 저장 실패해도 결과는 반환 */
      }
      plan.outputs.push({ skill: step.skill, text: prepared.text });
      plan.cursor++;
      return head + prepared.text + savedNote + this.advanceOrFinishSuffix(ctx, plan);
    }
    // mutate — 미리보기 보여주고 커밋 대기.
    plan.stage = 'awaiting_commit';
    plan.preview = { text: prepared.preview, commit: prepared.commit };
    return head + prepared.preview;
  }

  /** 커서가 끝을 지났으면 완료, 아니면 접두 메시지 + 다음 단계 진행 프롬프트. */
  private advanceOrFinish(ctx: Context, plan: StagedPlan, prefix: string): string {
    if (plan.cursor >= plan.steps.length) return `${prefix}\n\n` + this.finish(ctx, plan);
    return `${prefix}\n\n${this.advancePrompt(plan)}`;
  }

  /** 결과 뒤에 붙이는 "다음 단계 진행?" 꼬리말(또는 완료). */
  private advanceOrFinishSuffix(ctx: Context, plan: StagedPlan): string {
    if (plan.cursor >= plan.steps.length) return '\n\n' + this.finish(ctx, plan);
    return `\n\n${this.advancePrompt(plan)}`;
  }

  private advancePrompt(plan: StagedPlan): string {
    const s = plan.steps[plan.cursor];
    return `→ ${plan.cursor + 1}번(${s.instruction}) 진행할까요? (응 / 건너뛰기 / 아니오)`;
  }

  private finish(ctx: Context, plan: StagedPlan): string {
    const done = plan.cursor;
    this.clear(ctx);
    return `🎉 계획 완료 — ${done}/${plan.steps.length}단계 진행했어요.`;
  }

  private clear(ctx: Context): void {
    if (ctx.session) ctx.session.pendingPlan = undefined;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 계획 수립 (플래너) — 등록된 스킬 카탈로그에서 enum 선택.
  // ───────────────────────────────────────────────────────────────────────────

  private async buildPlan(userText: string): Promise<{ goal: string; steps: PlanStep[] } | null> {
    const cat = this.catalog();
    const names = cat.map((i) => i.name);
    const list = cat.map((i) => `- ${i.name}: ${i.description ?? i.examples.slice(0, 2).join(' / ')}`).join('\n');

    const schema = {
      type: 'object',
      properties: {
        goal: { type: 'string' },
        steps: {
          type: 'array',
          maxItems: this.maxSteps,
          items: {
            type: 'object',
            properties: {
              skill: { type: 'string', enum: names },
              instruction: { type: 'string' },
            },
            required: ['skill', 'instruction'],
            additionalProperties: false,
          },
        },
      },
      required: ['goal', 'steps'],
      additionalProperties: false,
    };

    const system =
      '너는 작업 플래너다. 사용자 요청을 아래 "등록된 기능" 중에서 골라 실행 순서대로 나열한다.\n' +
      '- 반드시 목록에 있는 기능 이름(enum)만 쓴다. 목록에 없는 일은 계획에 넣지 않는다.\n' +
      '- **요청에 나열된 서로 다른 작업은 각각 별도 단계로 나눈다. 여러 작업을 한 단계로 합치지 마라.** ' +
      "예: 'A 설계하고 B 문서 작성하고 C 리뷰해줘' → 3단계(설계 / 문서 / 리뷰). 'A하고 B까지' → 2단계.\n" +
      '- 동시에, **요청에 없는 작업을 친절을 이유로 덧붙이지 마라**(문서화·git·배포·검증·리뷰 등 임의 추가 금지). ' +
      '요청의 작업 수 = 계획의 단계 수.\n' +
      `- 논리적 의존 순서(예: 설계 → 생성)를 지킨다. 최대 ${this.maxSteps}단계.\n` +
      '- goal 은 스킬 이름이 아니라 이 요청으로 이루려는 바를 담은 사람이 읽는 한국어 목표 한 줄이다.\n' +
      '- 각 단계의 instruction 은 그 기능에 넘길 한국어 지시 한 문장.\n' +
      '- 한 작업만 있으면 1단계만 만든다. 억지로 늘리지 마라.\n' +
      '- 설명 없이 JSON 만 출력한다.';
    const user = `요청: "${userText}"\n\n등록된 기능:\n${list}`;

    // 계획 JSON 토큰 예산은 단계 수에 비례한다. 고정 256 이면 5~6단계 계획이 잘려(빈/무효 JSON)
    // heuristicPlan 폴백으로 떨어지고, 그 폴백은 모든 단계에 원문을 instruction 으로 넣어 분해가 무너진다.
    const planTokens = Math.max(256, 128 + this.maxSteps * 128); // 4→640, 6→896, 8→1152
    let raw: { goal?: string; steps?: PlanStep[] } | null = null;
    try {
      raw = await this.llm.chatJson(system, user, schema, undefined, planTokens);
    } catch {
      raw = null;
    }
    const valid = (raw?.steps ?? [])
      .filter((s) => s && names.includes(s.skill) && typeof s.instruction === 'string')
      .map((s) => ({ skill: s.skill, instruction: cleanInstruction(s.instruction) }))
      .filter((s) => s.instruction)
      .slice(0, this.maxSteps);
    if (valid.length === 0) return this.heuristicPlan(userText, names);
    return { goal: (raw!.goal ?? userText).trim() || userText, steps: valid };
  }

  /**
   * LLM 계획 실패 시 폴백 — 발화 키워드로 실행 순서를 결정론 조립(조사→설계→스캐폴드→코드→문서→제안/메일/
   * 회의록→검증→git→배포). 카탈로그에 있는 스킬만, 논리 순서 고정, 최대 MAX_STEPS. 신호 없으면 null.
   * (LLM 성공 경로엔 영향 없음 — 이 폴백은 LLM 이 빈/무효 계획을 낼 때만 발동한다.)
   */
  private heuristicPlan(userText: string, names: string[]): { goal: string; steps: PlanStep[] } | null {
    const t = userText;
    const hasFw = !!detectFramework(t);
    // [스킬, 매칭조건] 을 논리 실행 순서대로. 기존 5종의 정규식은 그대로 보존, 나머지는 좁게 추가.
    const rules: Array<[string, boolean]> = [
      ['research_topic', /조사|리서치|알아보|트렌드/.test(t)],
      ['design_system', /설계|아키텍처|스키마|모델링|엔티티|구조/.test(t)],
      ['scaffold_project', hasFw && /만들|생성|시작|세팅|스캐폴|뼈대|초기/.test(t)],
      ['change_code', /코드|구현|작성|리팩터|수정|함수|클래스|컴포넌트|crud|엔드포인트|추가|기능/i.test(t)],
      ['write_docs', /문서|readme|가이드|릴리즈|릴리스|adr/i.test(t)],
      ['write_proposal', /제안서|rfp|견적|제안/i.test(t)],
      ['write_message', /메일|이메일|메시지|슬랙|공지/.test(t)],
      ['meeting_minutes', /회의록|미팅\s?노트|녹취/.test(t)],
      ['review_code', /검증|점검|보안|취약|품질|리뷰/.test(t)],
      ['git_artifact', /커밋|풀리퀘|체인지로그|changelog|\bpr\b/i.test(t)],
      ['setup_deployment', /배포|deploy|릴리즈\s*빌드/i.test(t)],
    ];
    const picks = rules.filter(([name, ok]) => ok && names.includes(name)).map(([name]) => name);
    if (picks.length === 0) return null;
    return { goal: userText, steps: picks.slice(0, this.maxSteps).map((skill) => ({ skill, instruction: userText })) };
  }
}
