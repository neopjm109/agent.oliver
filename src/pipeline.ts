// 파이프라인 — User → Router → Runtime → Skill → Response 를 조립.
import { resolve } from 'node:path';
import { loadSettings, activeProvider, loadIntents } from './core/config.js';
import { LLMClient } from './core/llmClient.js';
import { Router } from './core/router.js';
import { Runtime } from './core/runtime.js';
import { SkillRegistry } from './skills/registry.js';
import { statusFactsBlock } from './skills/agentStatus.js';
import { FallbackReply } from './skills/fallbackReply.js';
import { ChitchatReply } from './skills/chitchat.js';
import { PlanOrchestrator } from './skills/orchestrator.js';

/** 세션에 유지할 최근 대화 턴 수 (저사양 모델 컨텍스트 절약) */
const HISTORY_MAX = 4;
const trunc = (s: string, n: number): string => (s.length > n ? s.slice(0, n) + '…' : s);

/**
 * 상태 조회 결정론 매칭 — 발화 "전체"가 에이전트 상태 질의일 때만(앵커드). 도메인 요청("결제 상태
 * 확인해줘")·잡담("잘 지내?")은 매칭하지 않는다. 임베딩이 뭉개던 상태 vs 잡담 경계를 정규식이 가른다.
 */
const STATUS_QUERY =
  /^\s*(헬스\s?체크|(에이전트|봇|시스템|너)\s*상태|상태\s*(확인|점검)|(지금\s*)?정상\s*(작동|이야|이니|인가|가동)?|잘\s*(돌아가|작동)(고\s*있)?(어|나|니)?|잘\s*작동해)\s*[?!.]*$/;

/**
 * 능력/도움말 조회 결정론 매칭 — 발화 "전체"가 "이 에이전트가 뭘 할 수 있나/기능/도움말" 질의일 때만(앵커드).
 * status 와 같은 취지: 임베딩이 chitchat↔explain_code 사이에서 뭉개던 능력질문("뭘 할 수 있어?")을
 * 정규식이 가른다("뭐 하는거야"류 코드질문과 임베딩상 가까워 explain_code 로 오분류되던 문제).
 *  · 코드 대상 지시("이 코드/함수/파일 뭐 하는지")는 선두 lookahead 로 배제 → explain_code 로 보냄.
 *  · "X 기능 추가/넣어"(change_code)와 "기능 알려/소개/있어"(능력질문)는 동사로 가른다.
 */
const CAPABILITY_QUERY =
  /^\s*(?!.*(이|그|저|위|해당|아래|이런|저런|내|제|우리)\s*(코드|함수|클래스|파일|메서드|메소드|로직|부분|모듈|스크립트|프로젝트|앱|서비스))(?:(?:너|넌|네|니|당신|자네|봇|에이전트|여기서|여기)\S*\s+)?(?:\/?(?:도움말|help)|헬프|사용법|(?:뭐|뭘|무엇|무얼).*할\s*수\s*있|할\s*수\s*있는\s*(?:게|거|것|일|기능).*(?:뭐|무엇|있|어떤)|(?:무슨|어떤).*(?:기능|일|작업|것|거|걸|게).*(?:있|할\s*수|가능|해\s*줄)|기능.*(?:뭐|무엇|알려|소개|목록|정리|리스트|있)|(?:뭐|뭘|무엇).*도와).*$/i;

/** 결과물을 .md 파일로도 내보내는 문서형 intent. 이보다 짧은 출력은 텍스트만(파일 안 만듦). */
const DOC_FILE_INTENTS = new Set([
  'write_docs', 'design_system', 'write_proposal', 'research_topic', 'git_artifact', 'write_story', 'run_game_session', 'meeting_minutes',
]);
const OUTBOX_MIN_CHARS = 1500;

/** fallback·chitchat 안내에 쓰는 한 줄 기능 요약 (실제 동작 범위에 맞춰 정직하게) */
const CAPABILITIES =
  '프레임워크 프로젝트 생성·실행(Spring/NestJS/Django/Next.js/Flutter/Tauri), 아키텍처·DB 설계 초안, ' +
  '코드 리뷰·수정·기능 추가 코드 생성·보안/성능 점검(작업 폴더 경로만 주면 파일을 직접 읽어요), 문서화·커밋/PR 메시지(git 변경 자동 참조), ' +
  '텍스트/코드/마크다운/CSV + pdf·워드·엑셀·ppt 파일 분석(작업 폴더 경로만 주면 읽어요), 제안서·소설·게임 세션 작성, ' +
  '기술 개념 정리·비교(실시간 웹 검색은 못 하고 학습된 지식 기반)를 도와드려요. 여러 단계 작업은 계획을 세워 한 단계씩 확인받으며 진행해요.';
import { SessionStore, detectFramework, isAffirmative, isNegative, looksMultiStep, strongMultiStep } from './core/session.js';
import {
  safeProjectName, extractProjectName, extractFilePath, extractFilePaths,
  readReferencedAttachments, readAttachmentFiles, readGitContext, docTypeForPath,
} from './core/executor.js';
import {
  prepareScaffold, prepareEdit, prepareCodegen, commitStep, looksCapabilityAdd, type MutateCommit,
} from './core/step.js';
import { classifyIntent, isComplexRequest } from './core/classifier.js';
import { AuditLogger } from './core/audit.js';
import { saveOutbox } from './core/uploads.js';
import { resultFileName } from './core/naming.js';
import { detectConvertTarget, DEFAULT_TARGET, shapeContent, packageConversion } from './core/convert.js';
import { detectStack, buildInfo, renderBuildScript, renderBuildGuide } from './core/deploy.js';
import { detectTargetLang, autoTarget, translateText } from './core/translate.js';
import { detectTestTarget, generateTests } from './core/tests.js';
import { detectRunAction, resolveRunCommand } from './core/runner.js';
import { loadSoul, listSouls } from './core/soul.js';
import type { Context, Intent } from './core/types.js';

export interface PipelineResponse {
  text: string;
  intent: string;
  sim?: number;
  ambiguous?: boolean;
  /** 이 응답을 만드는 데 실제로 실행된 스킬 이름들 (중복 제거, 실행 순서) */
  skills?: string[];
  /** 문서형 결과물을 파일로 낸 경우 그 절대경로 — 봇은 첨부 업로드, CLI 는 경로 안내. */
  files?: string[];
}

export interface HandleOptions {
  /** CLI 를 실행한 위치. 미지정 시 서버 cwd. 세션 키 겸 FS 스킬의 작업 루트. */
  workspace?: string;
  /** 텔레그램 등에서 세션 키로 쓸 chat id (있으면 workspace 대신 이걸 세션 키로) */
  chatId?: string;
  /** (진단용) 라우팅 결정만 하고 스킬은 실행하지 않는다 — 라우팅 정확도 평가(eval:routing)에서 사용. */
  decideOnly?: boolean;
  /** 메신저(텔레그램·슬랙)에서 업로드돼 로컬에 저장된 첨부 파일들의 절대경로. 프롬프트에 실린다. */
  attachments?: string[];
  /** 스트리밍 콜백 — 전송(CLI/서버)이 제공하면 텍스트 생성 스킬이 토큰을 오는 대로 흘린다. */
  onToken?: (t: string) => void;
}

export interface PipelineInfo {
  intents: number;
  skills: number;
  profile: string;
  chatModel: string;
  embedModel: string;
  baseURL: string;
  /** 설정 기본 소울 이름 (비어 있으면 null = 기본 에이전트) */
  soul: string | null;
}

export interface Pipeline {
  handle(text: string, opts?: HandleOptions): Promise<PipelineResponse>;
  info(): PipelineInfo;
  /** 세션 대화 맥락 초기화 (opts 로 지정한 세션, 없으면 서버 cwd 기준). */
  reset(opts?: HandleOptions): void;
  /** 사용 모델(생성·라우터·임베딩)을 Ollama 에 미리 로드해 콜드스타트를 없앤다(상주 서버가 주기 호출). */
  warmup(): Promise<void>;
}

export async function createPipeline(): Promise<Pipeline> {
  const settings = loadSettings();
  const provider = activeProvider(settings);
  const llm = new LLMClient(provider);
  // 라우팅 분류(classifyIntent)·복합판정(isComplexRequest)은 판단이 쉬워 경량 모델로 충분하다
  //  — m2==m4 라우팅 정확도 동일(24/24) 실증. routerModel 지정 시 그 모델로, 아니면 chatModel.
  const routerLlm = provider.routerModel ? new LLMClient({ ...provider, chatModel: provider.routerModel }) : llm;
  const intents = loadIntents();
  const startedAt = Date.now();

  // 코드 스킬 주입. AgentStatus 는 런타임에 정보를 조회하는 지연 클로저를 받는다.
  let registryRef: SkillRegistry;
  const statusInfo = () => ({
    intents: intents.length,
    skills: registryRef.markdownCount + registryRef.codeCount,
    profile: settings.profile,
    chatModel: provider.chatModel,
    embedModel: provider.embedModel,
    startedAt,
  });
  // Plan-and-Execute 오케스트레이터. runtime 은 아래에서 생성되므로 지연 참조(요청 시점 호출).
  // 계획 상한: env(AGENT_MAX_STEPS) > 설정(plan.maxSteps) > 기본 4. num_ctx 여유로 프로필별 조정 가능.
  // 오설정(음수·과대·NaN) 방어로 [1,12] 클램프 — 음수면 maxItems 무효/slice 역절단, 과대면 planTokens 폭주.
  const maxSteps = Math.max(1, Math.min(12, Math.floor(Number(process.env.AGENT_MAX_STEPS) || settings.plan?.maxSteps || 4)));
  let runtimeRef: Runtime;
  const orchestrator = new PlanOrchestrator(llm, intents, () => runtimeRef, maxSteps);
  const codeSkills = [
    // agent_status 스킬 폐지 — status 는 결정론 인터셉트(/status + 명시적 상태 질문)가 handleInner 에서 직접 처리.
    new ChitchatReply(llm, CAPABILITIES, settings.response.warmChitchat !== false),
    new FallbackReply(llm, CAPABILITIES),
    orchestrator,
  ];

  // 기본 소울(페르소나). 비우면 기본 어시스턴트. 세션별로 /soul 명령으로 전환 가능.
  const defaultSoul = (settings.soul ?? '').trim().toLowerCase();

  const registry = new SkillRegistry(llm, settings.skills.root, codeSkills);
  registryRef = registry;
  const router = new Router(
    llm,
    intents,
    settings.router,
    provider.embedModel,
    resolve(process.cwd(), '.cache/centroids.json'),
  );
  await router.init(); // 예시 발화 임베딩 → centroid (캐시 히트 시 스킵)
  const runtime = new Runtime(registry, llm);
  runtimeRef = runtime; // 오케스트레이터의 지연 참조 확정
  const unknownIntent = intents.find((i) => i.name === 'unknown');
  const planIntent = intents.find((i) => i.name === 'plan_and_run');
  const scaffoldIntent = intents.find((i) => i.name === 'scaffold_project');
  const meetingIntent = intents.find((i) => i.name === 'meeting_minutes');
  // 복합 승격에서 제외 — 대화성/메타 및 계획 관련 intent (자기 자신·계획만 원하는 것).
  // 복합 승격 제외 — 자기완결(한 스킬로 끝) + 코드경로/메타 intent. meeting_minutes 는 "회의록+액션아이템"을
  // 한 번에 하는데 "정리하고 할일 뽑아" 같은 자연 표현이 -고 연결어미로 복합 오판돼 승격되던 것을 막는다.
  const PLAN_EXCLUDE = new Set([
    'chitchat', 'unknown', 'plan_and_run', 'plan_tasks', 'soul',
    'convert_document', 'translate', 'write_tests', 'run_command', 'meeting_minutes',
  ]);
  // 파일 인제스천 대상 — 발화가 참조한 workspace 파일을 읽어 프롬프트에 실어주는 intent(프롬프트-전용 스킬).
  // scaffold/change_code/plan_and_run 은 자체 파일 처리 경로가 있어 제외.
  const INGEST_INTENTS = new Set([
    'review_code', 'analyze_document', 'write_docs', 'design_system', 'research_topic', 'git_artifact', 'convert_document', 'translate', 'write_tests',
    'explain_code', 'write_message', 'meeting_minutes',
  ]);
  // 세션을 .cache/sessions.json 에 영속화 — 서버 재시작에도 pending·framework·history 복원.
  const sessions = new SessionStore(undefined, resolve(process.cwd(), '.cache/sessions.json'));
  // 감사 로그(JSONL) — 턴 단위 라우팅 결정·유사도·지연을 남긴다(어느 결정 경로/intent 가 약한지 데이터화).
  const audit = new AuditLogger(resolve(process.cwd(), '.cache/audit.jsonl'), settings.audit?.enabled !== false);

  /** /soul [이름|off] 처리 — 세션 소울을 바꾸고 안내만 반환 (라우팅/스킬 미실행). */
  function handleSoulCommand(arg: string, session: { soul?: string }): PipelineResponse {
    const available = listSouls();
    const current = session.soul !== undefined ? session.soul : defaultSoul;
    const currentLabel = current || '기본 에이전트';
    if (!arg) {
      const list = available.length ? available.join(', ') : '(souls/ 폴더가 비어 있어요)';
      return {
        text: `현재 소울: ${currentLabel}\n사용 가능: ${list}\n전환: /soul <이름>  ·  해제: /soul off`,
        intent: 'soul',
      };
    }
    const key = arg.toLowerCase();
    if (['off', 'none', '없음', '기본', 'default', 'reset', '해제'].includes(key)) {
      session.soul = '';
      return { text: '기본 에이전트로 전환했어요.', intent: 'soul' };
    }
    if (available.includes(key)) {
      session.soul = key;
      return { text: `소울을 '${key}'(으)로 전환했어요.`, intent: 'soul' };
    }
    return {
      text: `'${arg}' 소울을 찾을 수 없어요. 사용 가능: ${available.join(', ') || '(없음)'}`,
      intent: 'soul',
    };
  }

  async function handleInner(text: string, opts: HandleOptions = {}): Promise<PipelineResponse> {
    const workspace = opts.workspace ?? process.cwd();
    const sessionKey = opts.chatId ?? workspace; // 같은 디렉토리 = 같은 멀티턴 세션
    const session = sessions.get(sessionKey);
    const history = session.history ?? [];

    // 소울 메타명령: /soul [이름|off] — CLI·REPL·텔레그램 공통으로 여기서 세션 전환 처리
    const soulCmd = text.match(/^\/souls?\b\s*(.*)$/i);
    if (soulCmd) return handleSoulCommand(soulCmd[1].trim(), session);

    // 상태 조회 결정론 인터셉트 — status 는 인프라 조회라 LLM 라우터를 안 거친다(agent_status NL intent 폐지).
    //  · /status 명령 + 발화 전체가 상태 질의일 때만 매칭(앵커드 → "결제 상태 확인해줘" 같은 도메인 요청 보호).
    //  · 임베딩이 헷갈리던 "잘 돌아가?"(status) vs "잘 지내?"(chitchat)를 정규식이 정확히 가른다(오분류 근절).
    //  · /soul 과 동일하게 history·audit 미경유(대화 맥락 오염 방지). 결정론이라 decideOnly 진단에도 동일 반환.
    if (/^\/status\b/i.test(text) || STATUS_QUERY.test(text)) {
      return { text: statusFactsBlock(statusInfo()), intent: 'agent_status' };
    }

    // 능력/도움말 조회 결정론 인터셉트 — "뭘 할 수 있어?"·"기능 알려줘"·"도움말" 류는 라우터가
    //  임베딩상 explain_code 로 끌고 가 오분류된다(chitchat↔explain_code 모호성). status 와 동일하게
    //  정규식이 앵커드 매칭해 능력 요약을 직접 반환한다(라우팅·LLM·history·audit 미경유, 결정론).
    if (CAPABILITY_QUERY.test(text)) {
      return { text: `저는 로컬 LLM으로 동작하는 경량 에이전트예요. ${CAPABILITIES}`, intent: 'capabilities' };
    }

    // 활성 소울 결정: 세션 전환값(''=명시적 없음) 우선, 없으면 설정 기본값
    const activeSoulName = session.soul !== undefined ? session.soul : defaultSoul;
    const soul = activeSoulName ? loadSoul(activeSoulName) : undefined;

    const ctx: Context = {
      userText: text, chatId: opts.chatId, workspace, slots: {}, session, history, outputs: [],
      soul, soulName: soul ? activeSoulName : undefined,
    };

    // 스트리밍: 전송이 onToken 을 주면 텍스트 생성 스킬이 토큰을 흘린다. bodyStreamed 로
    // "본문이 실제로 스트리밍됐는지"를 추적해, 그 경우에만 꼬리말(ingestNote)도 이어 스트리밍한다.
    let bodyStreamed = false;
    if (opts.onToken) ctx.onToken = (t) => { bodyStreamed = true; opts.onToken!(t); };

    // 감사 로그용 턴 상태 — 결정 경로/승격 여부를 각 분기에서 채우고 respond() 에서 한 줄 남긴다.
    const turnStart = Date.now();
    const traceId = audit.newTraceId();
    let decidedBy = 'unknown';
    let promoted = false;

    // 응답을 히스토리에 기록하고 반환 (최근 HISTORY_MAX 턴만, 길이 절단)
    const respond = (r: PipelineResponse): PipelineResponse => {
      const turn = { user: trunc(text, 300), assistant: trunc(r.text, 700) };
      session.history = [...history, turn].slice(-HISTORY_MAX);
      sessions.persist(); // 매 턴 세션 상태를 디스크에 저장(재시작 복원)
      const skills = [...new Set(ctx.outputs.map((o) => o.skill))]; // 실행 순서, 중복 제거
      audit.log({
        trace_id: traceId, ts: new Date().toISOString(), session: sessionKey, text_len: text.length,
        intent: r.intent ?? 'unknown', sim: r.sim, decided_by: decidedBy, promoted,
        attachments: ctx.attachments?.map((a) => a.label), latency_ms: Date.now() - turnStart, skills,
      });
      return { ...r, skills };
    };

    const runFallback = async (sim?: number): Promise<PipelineResponse> => {
      if (opts.decideOnly) return respond({ text: '', intent: 'unknown', sim }); // 진단: 스킬 미실행
      const r = unknownIntent
        ? await runtime.execute(unknownIntent, ctx)
        : { ok: true, text: '무엇을 도와드릴까요?' };
      return respond({ text: r.text ?? '', intent: 'unknown', sim });
    };

    // mutate 미리보기를 pendingStepCommit 에 걸고 확인을 요청하는 공용 헬퍼(단일턴).
    const askCommit = (
      prepared: { kind: 'mutate'; preview: string; commit: MutateCommit },
      intentName: string,
      s?: number,
    ): PipelineResponse => {
      session.pendingStepCommit = { preview: prepared.preview, commit: prepared.commit };
      return respond({ text: prepared.preview, intent: intentName, sim: s });
    };
    const cancelCommitMsg = (c: MutateCommit): string => {
      if (c.type === 'exec') return `취소했어요. 직접 실행하려면:\n\`${c.label}\``;
      if (c.type === 'editFile') return `취소했어요. \`${c.path}\` 는 그대로예요.`;
      return '취소했어요. 파일을 만들지 않았어요.';
    };

    // 0) 부작용 커밋 대기(pendingStepCommit) — 직전 턴이 scaffold 실행·파일 편집·코드 생성을 물어본 상태.
    //    응/아니오는 라우팅 이전에 가로챈다(모든 전송 공통, 세션 단위). (구 pending + pendingEdit 통합)
    if (session.pendingStepCommit) {
      const pc = session.pendingStepCommit;
      decidedBy = 'pending-commit';
      if (isAffirmative(text)) {
        session.pendingStepCommit = undefined;
        const committed = await commitStep(pc.commit, ctx);
        return respond({ text: committed.text, intent: 'commit_exec' });
      }
      if (isNegative(text)) {
        session.pendingStepCommit = undefined;
        return respond({ text: cancelCommitMsg(pc.commit), intent: 'commit_exec' });
      }
      session.pendingStepCommit = undefined; // 응/아니오가 아니면 대기 해제하고 정상 처리로 진행
    }

    // 0.2) 실행 계획 진행 대기(pendingPlan) — human-in-the-loop 상태기계. 오케스트레이터가 단계별로
    //      전진시킨다(자동 실행 없음 — 매 단계 사람이 승인). 라우팅 이전에 가로챈다. 계획 이탈은
    //      "아니오/취소/그만"으로만(스펙 §9). continuePlan 이 진행/커밋/편집/취소를 모두 처리한다.
    if (session.pendingPlan) {
      decidedBy = 'plan-continue';
      const msg = await orchestrator.continuePlan(text, ctx);
      return respond({ text: msg, intent: 'plan_and_run' });
    }

    // 0.5) 프로젝트명 대기 — 직전 턴에 이름을 되물은 상태. 이번 입력을 이름으로 받는다.
    if (session.awaitingScaffoldName) {
      decidedBy = 'awaiting-name';
      const fw = session.awaitingScaffoldName.framework;
      if (isNegative(text)) {
        session.awaitingScaffoldName = undefined;
        return respond({ text: '취소했어요.', intent: 'scaffold_project' });
      }
      const raw = text.trim();
      const name = extractProjectName(raw) ?? (safeProjectName(raw) ? raw : null);
      if (!name) {
        return respond({ text: '영문 프로젝트 이름이 필요해요. (예: myapp) — 취소하려면 "아니오"', intent: 'scaffold_project' });
      }
      session.awaitingScaffoldName = undefined;
      const prepared = prepareScaffold(fw, name, workspace);
      if (prepared.kind === 'mutate') return askCommit(prepared, 'scaffold_project');
      return respond({ text: prepared.kind === 'error' ? prepared.text : '이름이 올바르지 않아요. 영문으로 다시 알려주세요.', intent: 'scaffold_project' });
    }

    // 0.6) 편집 대상 파일 경로 대기 — 직전 턴에 경로를 되물은 상태. 이번 입력에서 경로를 받는다.
    if (session.awaitingEditPath) {
      decidedBy = 'awaiting-path';
      const req = session.awaitingEditPath.request;
      if (isNegative(text)) {
        session.awaitingEditPath = undefined;
        return respond({ text: '취소했어요.', intent: 'change_code' });
      }
      const path = extractFilePath(text);
      if (!path) {
        return respond({ text: '작업 폴더 기준 파일 경로가 필요해요. (예: src/foo.ts) — 취소하려면 "아니오"', intent: 'change_code' });
      }
      session.awaitingEditPath = undefined;
      const prepared = await prepareEdit(llm, workspace, path, req);
      if (prepared.kind === 'mutate') return askCommit(prepared, 'change_code');
      return respond({ text: prepared.text, intent: 'change_code' }); // error(없음/과대/생성실패)
    }

    // 0.9) 실시간정보/범위밖 결정론 차단 — 분류기(특히 gemma)가 놓치는 명백한 OOS(날씨·시세 등)를
    //      fallback 으로 보낸다. 개발 맥락 단어가 하나라도 있으면 제외("환율 계산 코드" 같은 정상 요청 보호).
    if (
      /날씨|기온|미세먼지|시세|주가|환율|실시간|속보|경기\s*결과/.test(text) &&
      !/코드|구현|계산|함수|클래스|컴포넌트|api|개발|만들|작성|설계|스키마|리팩터|분석|문서/.test(text)
    ) {
      decidedBy = 'deterministic-oos';
      return runFallback();
    }

    // 1) 결정론적 스캐폴드 감지 — 프레임워크 키워드 + 생성 동사 + 단일 요청이면 저사양 LLM
    //    분류기의 모호-발화 오분류("넥스트 프로젝트 만들어줘"→plan/설정 등)를 우회해 확정한다.
    //    (기능 추가 동사면 change_code 코드생성이므로 제외. 다단계면 아래 복합 승격에 맡긴다.)
    let intent: Intent | undefined;
    let sim = 1;
    let scaffoldByRule = false; // 결정론 규칙으로 확정한 스캐폴드는 복합 승격에서 보호
    const scaffoldPhrase = /만들|생성|시작|세팅|스캐폴|뼈대|초기/.test(text) && !/추가|붙여|넣어|연동|적용/.test(text);
    if (scaffoldIntent && detectFramework(text) && scaffoldPhrase && !looksMultiStep(text)) {
      intent = scaffoldIntent;
      scaffoldByRule = true;
      decidedBy = 'deterministic-scaffold';
    }

    // 1.5) 회의록 결정론 — "회의록/녹취/미팅노트" 신호가 강하면 meeting_minutes 로 확정한다. 긴 회의
    //      본문을 붙이면 임베딩이 희석돼 "할 일 뽑아"가 plan_tasks 로 새던 것을 막는다. 메일/메시지 요청은 제외.
    if (
      !intent &&
      meetingIntent &&
      /회의록|미팅\s?노트|녹취|회의\s?메모|회의\s?내용\s*(정리|요약|정돈)/.test(text) &&
      !/메일|이메일|메시지|슬랙/.test(text)
    ) {
      intent = meetingIntent;
      decidedBy = 'deterministic-minutes';
    }

    // 2) 결정론이 안 잡으면 2단계 임베딩 라우팅. unknown/none 이어도 복합 신호가 있으면
    //    plan_and_run 으로 구제한다(단일 인텐트에 안 붙는 다단계 요청이 fallback 으로 새던 문제).
    //    강한 다중동사 신호(strongMultiStep)면 저사양 LLM 게이트 없이 결정론 승격한다
    //    (gemma 의 isComplexRequest 과소판정·분류 오분류를 구제).
    const promoteIfComplex = async (): Promise<Intent | undefined> =>
      planIntent && looksMultiStep(text) && (strongMultiStep(text) || (await isComplexRequest(routerLlm, text)))
        ? planIntent
        : undefined;
    if (!intent) {
      const rt = await router.route(text);
      sim = rt.sim;
      if (rt.kind === 'unknown') {
        intent = await promoteIfComplex();
        if (intent) {
          promoted = true;
          decidedBy = 'promote-complex';
        } else {
          decidedBy = 'fallback';
          return runFallback(rt.sim);
        }
      } else if (rt.kind === 'direct') {
        decidedBy = 'embedding-direct';
        intent = rt.intent;
      } else {
        const classified = await classifyIntent(routerLlm, text, rt.candidates);
        if (classified) {
          decidedBy = 'llm-classify';
          intent = classified;
        } else if ((intent = await promoteIfComplex())) {
          promoted = true;
          decidedBy = 'promote-complex';
        } else {
          decidedBy = 'fallback';
          return runFallback(rt.sim);
        }
      }
    }

    // 3) 복합 요청 승격 — 결정론 규칙으로 확정한 스캐폴드만 제외(분류기가 고른 스캐폴드는 승격 대상).
    //    경로가 명시된 change_code(예: "src/foo.ts 에 검증 추가")는 원자적 단일 편집이므로 승격 제외 —
    //    검증+추가 같은 동사 2개에 isComplexRequest(경량 LLM)가 과판정해 plan_and_run 으로 새던 것을 막는다.
    const pathEdit = intent.name === 'change_code' && extractFilePath(text) !== null;
    if (!scaffoldByRule && !pathEdit && !PLAN_EXCLUDE.has(intent.name) && (await promoteIfComplex())) {
      intent = planIntent!;
      promoted = true;
      decidedBy = 'promote-complex';
    }

    // 진단: 라우팅 결정만 필요하면 여기서 반환(스킬 실행·되묻기·인제스천 건너뜀). eval:routing 전용.
    if (opts.decideOnly) return respond({ text: '', intent: intent.name, sim });

    // 2) 멀티턴 보정: framework 슬롯을 쓰는 intent(scaffold_project)는 발화 명시 > 세션 기억
    //    순으로 슬롯을 미리 채운다(extractor 가 존중).
    if (intent.slot?.framework) {
      const fw = detectFramework(text) ?? session.framework;
      if (fw) ctx.slots.framework = fw;
    }

    // 2.5) scaffold_project 는 코드가 명령을 결정론적으로 조립해(오타·환각 0) 실행 확인을 요청한다.
    //      이름이 없으면 임의로 짓지 않고 되묻는다. 다음 턴에 "응" 하면 위 (0) 이 실제 실행한다.
    if (intent.name === 'scaffold_project') {
      const fw = ctx.slots.framework ?? 'spring';
      session.framework = fw;
      const name = extractProjectName(text);
      if (!name) {
        session.awaitingScaffoldName = { framework: fw };
        return respond({
          text: `새 ${fw} 프로젝트를 만들게요. 프로젝트 이름을 영문으로 알려주세요. (예: myapp)`,
          intent: intent.name,
          sim,
        });
      }
      const prepared = prepareScaffold(fw, name, workspace);
      if (prepared.kind === 'mutate') return askCommit(prepared, intent.name, sim);
      // 조립 실패(미지원 framework/이름)면 아래 안내 스킬로 폴백
    }

    // 2.6) change_code: (a) 파일 경로가 있으면 그 파일을 편집안으로, (b) 경로 없이 "기능 추가"
    //      신호면 실제 코드 파일을 생성(add_capability 흡수 — 안내가 아니라 생성), (c) 인라인 멀티라인
    //      코드면 code-editor 스킬 폴백, (d) 그 외엔 경로를 되묻는다. 모두 미리보기→승인 게이트.
    if (intent.name === 'change_code') {
      const path = extractFilePath(text);
      if (path) {
        const prepared = await prepareEdit(llm, workspace, path, text);
        if (prepared.kind === 'mutate') return askCommit(prepared, intent.name, sim);
        return respond({ text: prepared.text, intent: intent.name, sim }); // error(없음/과대/생성실패)
      }
      if (looksCapabilityAdd(text)) {
        const fw = detectFramework(text) ?? session.framework;
        if (fw) session.framework = fw; // 코드생성이 스택을 알도록(prepareCodegen 이 session.framework 참조)
        // "이 프로젝트에 추가"는 현재 프로젝트(workspace 루트)를 대상으로 한다 — 방금 스캐폴드한 게
        // 있으면 그 폴더, 없으면 루트('.')를 기준으로 기존 구조(TS·App Router 등)를 읽어 관례에 맞춰 생성.
        const baseDir = session.lastProjectDir ?? '.';
        const prepared = await prepareCodegen(llm, ctx, text, baseDir);
        if (prepared.kind === 'mutate') return askCommit(prepared, intent.name, sim);
        return respond({ text: prepared.text, intent: intent.name, sim }); // error(생성 실패/충돌)
      }
      // 순수 편집 요청인데 경로 없음: 인라인 멀티라인 코드면 아래 code-editor 폴백, 아니면 경로 되묻기.
      if (!/\n/.test(text)) {
        session.awaitingEditPath = { request: text };
        return respond({
          text: '어떤 파일을 고칠까요? 작업 폴더 기준 경로를 알려주세요. (예: src/foo.ts) — 코드를 직접 붙여넣어도 돼요.',
          intent: intent.name,
          sim,
        });
      }
    }

    // 2.65) setup_deployment: 프로젝트 스택을 감지해 "빌드 명령 + 산출물 경로 + 실행법"을 결정론
    //        템플릿으로 만들고 build.sh 를 첨부한다(Docker·CI 없음). 스택 감지 실패면 아래 deploy-advisor
    //        (LLM 안내)로 폴백(return 하지 않고 통과).
    if (intent.name === 'setup_deployment') {
      const stack = detectStack(workspace) ?? detectFramework(text) ?? session.framework ?? null;
      const info = stack ? buildInfo(stack, text) : null;
      if (info) {
        const p = saveOutbox(sessionKey, 'build.sh', renderBuildScript(info));
        return respond({ text: renderBuildGuide(info), intent: intent.name, sim, files: [p] });
      }
      // 감지 실패 → deploy-advisor SKILL.md(LLM 안내)로 폴백
    }

    // 2.66) 실행·검증 — 테스트/빌드/린트/타입체크를 화이트리스트로 조립해 확인 후 실제 실행(commitStep exec).
    //        사용자 발화의 임의 명령은 실행하지 않는다(액션만 뽑고 명령은 프로젝트에서 코드가 결정).
    if (intent.name === 'run_command') {
      const action = detectRunAction(text);
      if (!action) {
        return respond({ text: '무엇을 실행할까요? 테스트 · 빌드 · 린트 · 타입체크 중에 말씀해 주세요.', intent: intent.name, sim });
      }
      const r = resolveRunCommand(workspace, action);
      if ('error' in r) return respond({ text: r.error, intent: intent.name, sim });
      const preview =
        `아래 명령을 작업 폴더(\`${workspace}\`)에서 실행할까요?\n\n\`${r.label}\`\n\n실행하려면 "응", 취소하려면 "아니오".`;
      return askCommit(
        { kind: 'mutate', preview, commit: { type: 'exec', argv: r.argv, cwd: workspace, label: r.label, framework: '', timeoutMs: r.timeoutMs } },
        intent.name,
        sim,
      );
    }

    // 2.7) 파일 인제스천 — (a) 메신저 업로드 첨부(opts.attachments, 절대경로) + (b) 발화가 참조한
    //       workspace 파일을 읽어 프롬프트에 싣는다. "src/foo.ts 리뷰해줘"처럼 경로만 주거나, 텔레그램/
    //       슬랙에 파일을 올리면 붙여넣기 없이 그 파일을 대상으로 작업한다. git_artifact 는 diff 도 주입.
    let ingestNote = ''; // 무엇을 참고했고 무엇을 못 읽었는지 알리는 꼬리말(조용한 절단 방지)
    const uploaded = opts.attachments?.length
      ? await readAttachmentFiles(opts.attachments)
      : { attachments: [], unread: [] as string[] };
    if (INGEST_INTENTS.has(intent.name) || uploaded.attachments.length) {
      const referenced = INGEST_INTENTS.has(intent.name) ? await readReferencedAttachments(workspace, text) : [];
      const attachments = [...uploaded.attachments, ...referenced]; // 업로드 우선(사용자가 방금 올린 것)
      if (intent.name === 'git_artifact') {
        const git = await readGitContext(workspace);
        if (git) attachments.unshift(git);
      }
      // analyze_document: 참조/업로드 파일 확장자로 doc_type 을 결정론적으로 채운다(LLM 슬롯 추측 방지).
      if (intent.name === 'analyze_document') {
        const dt = docTypeForPath(text) ?? docTypeForPath(uploaded.attachments[0]?.label ?? '');
        if (dt) ctx.slots.doc_type = dt;
      }
      if (attachments.length) ctx.attachments = attachments;

      // 정직화: 참고한 자료와 못 읽은 파일을 명시한다(사용자가 "봤다"고 오해하지 않게).
      const attachedLabels = new Set(attachments.map((a) => a.label));
      const unreadRef = INGEST_INTENTS.has(intent.name)
        ? extractFilePaths(text).filter((p) => !attachedLabels.has(p))
        : [];
      const unread = [...uploaded.unread, ...unreadRef];
      const lines: string[] = [];
      if (attachments.length) {
        lines.push('📎 참고한 자료: ' + attachments.map((a) => (a.truncated ? `${a.label}(일부만)` : a.label)).join(', '));
      }
      if (unread.length) {
        lines.push(`⚠️ 못 읽은 파일: ${unread.join(', ')} (없거나 지원 안 되는 형식이에요)`);
      }
      if (lines.length) ingestNote = '\n\n' + lines.join('\n');
    }

    // 2.8) 문서 변환 — 입력 파일(+선택 샘플)을 목표 포맷으로 변환한다. 단순 변환 / 샘플 기반(구조 따라감)
    //      두 모드. 오피스(docx/pptx/pdf)는 pandoc, 텍스트형은 직접 저장. 결과는 파일 첨부(files).
    if (intent.name === 'convert_document') {
      const inputs = ctx.attachments ?? [];
      if (!inputs.length) {
        return respond({
          text: '변환할 파일을 첨부하거나 작업 폴더 기준 경로를 알려주세요. (예: "report.pdf 를 워드로 변환해줘")',
          intent: intent.name,
          sim,
        });
      }
      const target = detectConvertTarget(text) ?? DEFAULT_TARGET;
      // 샘플 기반: 첨부가 2개 이상 + 샘플/양식/템플릿 등의 신호가 있으면 2번째를 양식으로 삼는다.
      const sampleMode = inputs.length >= 2 && /샘플|양식|템플릿|틀에|처럼|맞춰|따라|기준으로/.test(text);
      const shaped = await shapeContent(llm, inputs[0].content, target, text, sampleMode ? inputs[1].content : undefined);
      const stem = (inputs[0].label.split('/').pop() ?? '변환결과').replace(/\.[^.]+$/, '') || '변환결과';
      const { files, note } = await packageConversion(sessionKey, stem, shaped, target);
      const modeNote = sampleMode ? `(샘플 «${inputs[1].label}» 의 구조를 따랐어요)\n` : '';
      return respond({ text: modeNote + note + ingestNote, intent: intent.name, sim, files });
    }

    // 2.9) 번역 — 첨부/발화 텍스트를 목표 언어로. 방향은 발화에서 감지, 없으면 원문 반대 언어로 자동.
    //       파일이거나 장문(≥1500자)이면 파일로 첨부, 짧으면 인라인 답변.
    if (intent.name === 'translate') {
      const att = ctx.attachments ?? [];
      const source = att.length ? att.map((a) => a.content).join('\n\n') : text;
      if (!source.trim()) {
        return respond({ text: '번역할 텍스트를 붙여넣거나 파일을 첨부(또는 경로)해 주세요.', intent: intent.name, sim });
      }
      const target = detectTargetLang(text) ?? autoTarget(source);
      const translated = await translateText(llm, source, target);
      if (att.length || translated.length >= OUTBOX_MIN_CHARS) {
        const fname = (att[0]?.label ?? '번역').split('/').pop() ?? '번역';
        const dot = fname.lastIndexOf('.');
        const stem = dot > 0 ? fname.slice(0, dot) : fname;
        const rawExt = dot > 0 ? fname.slice(dot + 1).toLowerCase() : 'md';
        const ext = ['txt', 'md', 'csv', 'html', 'json'].includes(rawExt) ? rawExt : 'md'; // 바이너리 원문은 md 로
        const p = saveOutbox(sessionKey, `${stem}_${target.code}.${ext}`, translated);
        return respond({ text: `✅ ${target.label}로 번역했어요: ${p.split('/').pop()}` + ingestNote, intent: intent.name, sim, files: [p] });
      }
      return respond({ text: translated + ingestNote, intent: intent.name, sim });
    }

    // 2.95) 테스트 생성 — 소스 파일에서 프레임워크·테스트경로를 결정론으로 정하고 테스트 코드를 생성,
    //        확인 후 프로젝트에 저장(editFile 게이트 재사용, 새 파일이라 비파괴).
    if (intent.name === 'write_tests') {
      const src = ctx.attachments?.[0];
      if (!src) {
        return respond({ text: '테스트를 만들 소스 파일 경로를 알려주거나 파일을 첨부해 주세요. (예: "src/foo.ts 테스트 짜줘")', intent: intent.name, sim });
      }
      const tgt = detectTestTarget(src.label, workspace);
      if (!tgt) {
        return respond({ text: `테스트 프레임워크를 정하지 못했어요(지원: ts·js·py·java·kt·go·dart). 파일: ${src.label}`, intent: intent.name, sim });
      }
      let code: string;
      try {
        code = await generateTests(llm, src.label, src.content, tgt);
      } catch (err) {
        return respond({ text: `테스트 생성 실패: ${err instanceof Error ? err.message : String(err)}`, intent: intent.name, sim });
      }
      const head = code.split('\n').slice(0, 16).join('\n');
      const preview =
        `\`${tgt.testPath}\` 에 ${tgt.framework} 테스트를 만들까요?${src.truncated ? ' (소스가 길어 일부만 참고)' : ''}\n\n` +
        `${head}\n…\n\n적용하려면 "응", 취소하려면 "아니오".`;
      return askCommit({ kind: 'mutate', preview, commit: { type: 'editFile', path: tgt.testPath, content: code } }, intent.name, sim);
    }

    // 3) 실행
    const r = await runtime.execute(intent, ctx);
    if (ctx.slots.framework) session.framework = ctx.slots.framework; // 최근 프로젝트 기억
    let out = r.text ?? '';

    // plan_and_run 은 체크리스트(줄바꿈·체크박스)를 반환하므로 "한두 문장" 다듬기를 건너뛴다.
    // 이미 스트리밍된 본문은 다듬지 않는다(스트리밍 표시와 최종 텍스트가 어긋나는 것 방지).
    if (settings.response.polishWithLlm && out && !bodyStreamed && intent.name !== 'plan_and_run') {
      const polishSys = soul
        ? soul + '\n\n위 인격을 유지한 채, 아래 답변을 사실은 바꾸지 말고 자연스러운 한국어 한두 문장으로 다듬어라.'
        : '아래 답변을 사실은 바꾸지 말고 자연스러운 한국어 한두 문장으로 다듬어라.';
      const polished = await llm.chatText(polishSys, out);
      if (polished.trim()) out = polished; // 다듬기 결과가 비면(모델 실패) 원문 유지 — 답변 소실 방지
    }

    // 문서형 결과물이 길면 .md 파일로도 낸다(봇: 첨부 업로드 / CLI: 경로 안내). 짧은 답은 텍스트만.
    let files: string[] | undefined;
    if (DOC_FILE_INTENTS.has(intent.name) && out.trim().length >= OUTBOX_MIN_CHARS) {
      try {
        files = [saveOutbox(sessionKey, resultFileName(intent.name, ctx.slots, out), out)];
      } catch {
        /* 저장 실패해도 텍스트로 응답한다 */
      }
    }
    // 본문이 스트리밍됐다면 꼬리말(참고자료 등)도 이어 흘려, 스트리밍 합계가 최종 텍스트와 정확히 일치하게 한다.
    if (bodyStreamed && ingestNote) ctx.onToken!(ingestNote);
    return respond({ text: out + ingestNote, intent: intent.name, sim, files });
  }

  // 상주 서버는 하나의 파이프라인으로 여러 요청을 동시에 받는다. 같은 세션(chatId/workspace)에 대한
  // 요청이 겹치면 pending 상태기계(pendingStepCommit·pendingPlan)와 세션 영속화가 인터리브돼 꼬일 수
  // 있으므로, 세션 키 단위로 직렬화한다(서로 다른 세션은 그대로 병렬 — 전역 병목 없음).
  const sessionLocks = new Map<string, Promise<unknown>>();
  const handle = (text: string, opts: HandleOptions = {}): Promise<PipelineResponse> => {
    const key = opts.chatId ?? opts.workspace ?? process.cwd(); // handleInner 의 sessionKey 규칙과 동일
    const prior = sessionLocks.get(key) ?? Promise.resolve();
    const result = prior.then(() => handleInner(text, opts), () => handleInner(text, opts));
    const tail = result.then(() => {}, () => {}); // 다음 요청이 기다릴 지점(성공/실패 무관)
    sessionLocks.set(key, tail);
    void tail.finally(() => {
      if (sessionLocks.get(key) === tail) sessionLocks.delete(key); // 마지막이면 잠금 정리(무한 증가 방지)
    });
    return result;
  };

  return {
    handle,
    info: () => ({
      intents: intents.length,
      skills: registry.markdownCount + registry.codeCount,
      profile: settings.profile,
      chatModel: provider.chatModel,
      embedModel: provider.embedModel,
      baseURL: provider.baseURL,
      soul: defaultSoul || null,
    }),
    reset: (opts = {}) => {
      const workspace = opts.workspace ?? process.cwd();
      sessions.clear(opts.chatId ?? workspace); // handle() 의 세션 키 규칙과 동일
      sessions.persist(); // 초기화도 디스크에 반영
    },
    // 생성·라우터·임베딩 모델을 각각 최소 호출(1토큰/짧은 임베딩)로 로드해 둔다. 실패는 무시(예열은 베스트에포트).
    async warmup() {
      const jobs: Array<Promise<unknown>> = [
        llm.chatTextFull('.', '.', 1).catch(() => {}), // 생성 모델(chatModel)
        llm.embed(['.']).catch(() => {}), // 임베딩(embedModel)
      ];
      if (provider.routerModel) jobs.push(llm.chatTextFull('.', '.', 1, provider.routerModel).catch(() => {})); // 라우터 모델
      await Promise.all(jobs);
    },
  };
}
