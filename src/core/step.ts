// executeStep 프리미티브 — 한 단계(=한 intent 실행)를 두 국면으로 나눈다.
//   prepareStep : 생성만 한다(파괴적 쓰기/실행 없음). produce(즉시완료) 또는 mutate(커밋대기)를 반환.
//   commitStep  : 승인 후 실제 쓰기/실행(exec/editFile/codeFiles).
// 단일턴(pipeline)과 plan 스텝(orchestrator)이 이 한 벌을 공유한다 — 생성 로직 이중화 제거.
// (스펙: hitl-orchestrator-spec.md §2)
import type { Context, Intent, SkillResult, MutateCommit } from './types.js';
import type { LLMClient } from './llmClient.js';
import {
  buildScaffold, runCommand, installHint, extractProjectName, extractFilePath,
  readArtifact, overwriteFile, backupBeforeOverwrite, listProjectFiles,
  scaffoldDirName, verifyGeneratedProject,
} from './executor.js';
import { detectFramework } from './session.js';
import { stripFence, priorOutputsBlock } from './text.js';

/** runtime 순환 import 를 피하기 위한 최소 인터페이스(Runtime 이 이 형태를 만족). */
export interface StepRuntime {
  execute(intent: Intent, ctx: Context): Promise<SkillResult>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 타입 (MutateCommit 은 순환 회피 위해 types.ts 에 정의, 여기선 재노출)
// ─────────────────────────────────────────────────────────────────────────────

export type { MutateCommit } from './types.js';

/** prepareStep 결과. produce=즉시완료, mutate=커밋대기, error=생성 실패/입력 부족. */
export type StepPrepared =
  | { kind: 'produce'; skill: string; text: string }
  | { kind: 'mutate'; skill: string; preview: string; commit: MutateCommit }
  | { kind: 'error'; skill: string; text: string };

export interface StepCommitted {
  text: string; // 사람이 읽는 결과
  artifacts: string[]; // 저장/실행된 경로 또는 라벨
}

// ─────────────────────────────────────────────────────────────────────────────
// 상수/헬퍼 (pipeline·orchestrator 에서 이식)
// ─────────────────────────────────────────────────────────────────────────────

/** 통째 편집 안전 상한 — 초과하면 저사양 모델 출력이 절단돼 원본 파괴 위험(거부). */
const MAX_EDIT_LINES = 600;
const MAX_EDIT_CHARS = 40_000;
export function tooLargeToEdit(s: string): boolean {
  return s.split('\n').length > MAX_EDIT_LINES || s.length > MAX_EDIT_CHARS;
}

/** 스캐폴더 설정/매니페스트 — 코드 생성 단계가 덮어쓰면 빌드가 깨진다(보호). */
const PROTECTED_CONFIG =
  /^(package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|[tj]sconfig\.json|next\.config\.[mc]?[jt]s|next-env\.d\.ts|eslint\.config\.[mc]?js|\.eslintrc.*|postcss\.config\.[mc]?js|tailwind\.config\.[mc]?[jt]s|vite\.config\.[jt]s)$/;

/** 생성 코드 위험 패턴 — child_process·eval·Function 생성자(regex.exec 오탐 제외). */
const RISKY_CODE = /\beval\s*\(|new\s+Function\s*\(|child_process/;

/** 부작용(mutate) intent — 미리보기→승인→커밋 게이트가 필요한 것. 그 외는 모두 produce. */
export const MUTATE_INTENTS = new Set(['scaffold_project', 'change_code']);

/** 발화가 "기능 추가"(코드 생성)를 요구하는가 — add_capability 를 흡수한 change_code 의 코드생성 모드 신호. */
export function looksCapabilityAdd(text: string): boolean {
  return /추가|붙여|넣어|연동|적용|구현|만들|작성|생성/.test(text);
}

/** 편집 확인 메시지 — 대상·줄수 변화 + 실제 변경 구간(공통 접두/접미 제외) 미리보기. */
export function renderEditConfirm(path: string, original: string, edited: string): string {
  const o = original.split('\n');
  const e = edited.split('\n');
  let pre = 0;
  while (pre < o.length && pre < e.length && o[pre] === e[pre]) pre++;
  let suf = 0;
  while (suf < o.length - pre && suf < e.length - pre && o[o.length - 1 - suf] === e[e.length - 1 - suf]) suf++;
  const oldMid = o.slice(pre, o.length - suf);
  const newMid = e.slice(pre, e.length - suf);
  const cap = (arr: string[], n: number): string[] => (arr.length > n ? [...arr.slice(0, n), `… (+${arr.length - n}줄)`] : arr);
  const removed = oldMid.length ? cap(oldMid, 12).map((l) => `- ${l}`).join('\n') : '(삭제 없음)';
  const added = newMid.length ? cap(newMid, 12).map((l) => `+ ${l}`).join('\n') : '(추가 없음)';
  const body = oldMid.length === 0 && newMid.length === 0 ? '(내용 변화 없음)' : `${removed}\n${added}`;
  return (
    `\`${path}\` 를 이렇게 바꿀까요? (${o.length}줄 → ${e.length}줄, 변경 구간 ${pre + 1}번째 줄 부근)\n\n` +
    `${body}\n\n적용하려면 "응", 취소하려면 "아니오".`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// prepareStep 진입점들 (focused builders) — pipeline·orchestrator 가 직접 호출
// ─────────────────────────────────────────────────────────────────────────────

/** produce 스텝 — 마크다운/코드 스킬을 runtime 으로 1회 실행해 텍스트 산출물을 낸다(게이트 없음). */
export async function prepareProduce(
  runtime: StepRuntime,
  intent: Intent,
  ctx: Context,
): Promise<StepPrepared> {
  const r = await runtime.execute(intent, ctx);
  return { kind: 'produce', skill: intent.name, text: (r.text ?? '').trim() || '(결과 없음)' };
}

/** scaffold 스텝 — CLI 명령을 결정론 조립해 미리보기+커밋(exec)을 만든다. 실행은 commitStep. */
export function prepareScaffold(framework: string, name: string, cwd: string): StepPrepared {
  const plan = buildScaffold(framework, name);
  if (!plan) {
    return { kind: 'error', skill: 'scaffold_project', text: `${framework} 스캐폴드 명령을 만들 수 없어요(이름/프레임워크 확인 필요).` };
  }
  const preview =
    `새 ${framework} 프로젝트를 만들까요? 아래 명령을 작업 폴더(\`${cwd}\`)에서 실행합니다:\n\n` +
    `\`${plan.label}\`\n\n실행하려면 "응", 취소하려면 "아니오". (직접 실행하려면 위 명령을 복사하세요.)`;
  // remember:true — 성공 시 생성 폴더를 세션에 기억(이후 change_code 가 이 프로젝트에 씀).
  // projectDir 은 스캐폴더가 실제로 만들 폴더명(대소문자 규칙 반영) — argv 역추론 금지(프레임워크마다 위치 다름).
  return {
    kind: 'mutate',
    skill: 'scaffold_project',
    preview,
    commit: { type: 'exec', argv: plan.argv, cwd, label: plan.label, framework, remember: true, projectDir: scaffoldDirName(framework, name) },
  };
}

/** 단일 파일 편집 스텝 — 파일 전체를 요청대로 고쳐 미리보기(diff)+커밋(editFile)을 만든다. */
export async function prepareEdit(
  llm: LLMClient,
  workspace: string,
  path: string,
  request: string,
): Promise<StepPrepared> {
  const original = readArtifact(workspace, path);
  if (original === null) {
    return { kind: 'error', skill: 'change_code', text: `\`${path}\` 파일을 작업 폴더에서 찾지 못했어요.` };
  }
  if (tooLargeToEdit(original)) {
    return {
      kind: 'error',
      skill: 'change_code',
      text: `\`${path}\` 는 통째로 안전하게 수정하기엔 너무 커요(${original.split('\n').length}줄). 수정할 범위를 좁혀 말씀해 주시거나, 해당 부분 코드를 직접 붙여넣어 주세요.`,
    };
  }
  const system =
    '너는 코드/텍스트 파일 편집기다. 아래 파일 전체를 요청대로 수정해 **수정된 파일 전체**만 출력한다.\n' +
    '- 설명·머리말·마크다운 코드펜스(```) 없이 파일 내용만.\n' +
    '- 요청과 무관한 부분은 원본 그대로 유지한다. 파일의 언어·스타일·들여쓰기를 지킨다.';
  const user = `파일 경로: ${path}\n수정 요청: ${request}\n\n[현재 파일 내용]\n${original}`;
  let text: string, truncated: boolean;
  try {
    ({ text, truncated } = await llm.chatTextFull(system, user, 8192));
  } catch (err) {
    return { kind: 'error', skill: 'change_code', text: `편집안을 만들지 못했어요: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (truncated) {
    return { kind: 'error', skill: 'change_code', text: '편집본이 모델 출력 한도에서 잘렸어요(파일이 너무 커요). 수정 범위를 좁혀 다시 시도해 주세요.' };
  }
  const edited = stripFence(text);
  return {
    kind: 'mutate',
    skill: 'change_code',
    preview: renderEditConfirm(path, original, edited),
    commit: { type: 'editFile', path, content: edited },
  };
}

/**
 * 코드 생성 스텝 — 요청·이전단계 설계를 반영해 실제 소스 파일들을 생성한다(add_capability 흡수 경로).
 * 생성 + 저장 가드(중복확장자·라우터혼용·설정보호·경로언랩)까지 prepareStep 에서 끝내고,
 * 실제 디스크 쓰기·import 스텁·tsc 검증은 commitStep(codeFiles)이 한다.
 */
export async function prepareCodegen(
  llm: LLMClient,
  ctx: Context,
  instruction: string,
  baseDir: string,
): Promise<StepPrepared> {
  const schema = {
    type: 'object',
    properties: {
      files: {
        type: 'array',
        maxItems: 6,
        items: {
          type: 'object',
          properties: { path: { type: 'string' }, content: { type: 'string' } },
          required: ['path', 'content'],
          additionalProperties: false,
        },
      },
      note: { type: 'string' },
    },
    required: ['files'],
    additionalProperties: false,
  };
  const prior = ctx.outputs.length
    ? '[이전 단계 산출물 — 이 설계를 반영해 구현하라]\n' + priorOutputsBlock(ctx.outputs) + '\n\n'
    : '';
  const fw = ctx.session?.framework ?? '';
  const structure = listProjectFiles(ctx.workspace, baseDir, 40);
  const isNext = fw === 'nextjs';
  const hasApp = structure.some((p) => p.startsWith('app/'));
  const hasPages = structure.some((p) => p.startsWith('pages/'));
  const isTs = structure.includes('tsconfig.json') || structure.some((p) => /\.tsx?$/.test(p));
  const structureBlock = structure.length
    ? '[기존 프로젝트 파일 — 이 구조·관례를 그대로 따르라]\n' + structure.map((p) => `- ${p}`).join('\n') + '\n\n'
    : '';
  const rules: string[] = [
    '- 위 [기존 프로젝트 파일]의 언어·폴더 구조·import 방식을 그대로 따른다. 새 방식을 도입하지 않는다.',
    '- 같은 역할의 파일이 이미 있으면 새로 만들지 말고 그 경로 그대로 전체 내용을 다시 써서 대체한다.',
    '- 이번에 함께 생성하지 않는 파일/모듈은 import 하지 않는다. 필요하면 그 파일도 만들거나 로직을 인라인한다.',
  ];
  if (isTs) rules.push('- TypeScript 프로젝트다. .ts/.tsx 로 만들고 .js/.jsx 를 새로 만들지 않는다.');
  if (isNext && hasApp) {
    rules.push('- Next.js App Router 다. 페이지는 app/page.tsx 를 수정해 구현하고 pages/ 디렉토리는 만들지 않는다.');
    rules.push('- app/layout.tsx 는 이미 있으니 새 레이아웃 파일을 만들지 않는다(필요하면 기존 파일을 수정).');
    rules.push(
      '- 로컬 import 는 반드시 "@/" 로 시작한다. 예: "@/lib/data", "@/app/components/Hero". ' +
        '"@lib"·"@components"·"@db" 처럼 슬래시 없는 별칭은 이 프로젝트에 없다(빌드 실패).',
    );
    rules.push('- DB·외부 라이브러리에 의존하지 말고, 랜딩 페이지 데이터는 파일 안에 상수로 인라인한다(가짜 모듈 import 금지).');
  }
  const system =
    '너는 숙련 개발자다. 요청과 설계를 반영해 실제로 동작하는 소스 파일을 만든다.\n' +
    '- 각 파일은 path(프로젝트 루트 기준 상대경로)와 content(파일 전체 내용)로 낸다.\n' +
    '- content 에는 설명·머리말·마크다운 코드펜스(```) 없이 순수 파일 내용만 담는다.\n' +
    rules.join('\n') +
    '\n- 최대 6개 파일. JSON 만 출력한다.';
  const user = prior + structureBlock + `요청: ${instruction}\n` + (fw ? `프레임워크: ${fw}\n` : '') + `저장 기준 폴더: ${baseDir}`;

  let gen: { files?: Array<{ path?: string; content?: string }>; note?: string };
  try {
    gen = await llm.chatJson(system, user, schema, llm.coderModel, 8192);
  } catch {
    return { kind: 'error', skill: 'change_code', text: '코드 파일 생성에 실패했어요(모델 JSON 출력 오류).' };
  }
  const rawFiles = (gen.files ?? []).filter(
    (f) => f && typeof f.path === 'string' && f.path.trim() && typeof f.content === 'string',
  );
  if (rawFiles.length === 0) return { kind: 'error', skill: 'change_code', text: '생성할 파일이 없었어요.' };

  // 저장 전 결정론 가드 — 프롬프트가 무시돼도 빌드를 깨는 구조 충돌을 막는다(경로 언랩 포함).
  const existing = new Set(structure);
  const existingNoExt = new Set(structure.map((p) => p.replace(/\.[^./]+$/, '')));
  const wrapper = new Set(baseDir.split('/').filter(Boolean));
  const resolved: Array<{ path: string; content: string }> = [];
  const skipped: string[] = [];
  const risky: string[] = [];
  for (const f of rawFiles) {
    let p = f.path!.replace(/^[/\\]+/, '');
    let segs = p.split('/');
    while (segs.length > 1 && (wrapper.has(segs[0]) || /^agent[-_]?out\w*$/i.test(segs[0]))) segs = segs.slice(1);
    p = segs.join('/');
    const pNoExt = p.replace(/\.[^./]+$/, '');
    if (!existing.has(p) && existingNoExt.has(pNoExt)) {
      skipped.push(`${p} (기존 파일과 확장자만 다른 중복)`);
      continue;
    }
    if (isNext && hasApp && p.startsWith('pages/')) {
      skipped.push(`${p} (App Router 프로젝트에 Pages Router 혼용)`);
      continue;
    }
    if (isNext && hasPages && !hasApp && p.startsWith('app/')) {
      skipped.push(`${p} (Pages Router 프로젝트에 App Router 혼용)`);
      continue;
    }
    const pBase = p.split('/').pop() ?? p;
    if (existing.has(p) && PROTECTED_CONFIG.test(pBase)) {
      skipped.push(`${p} (스캐폴드 설정 파일 보호)`);
      continue;
    }
    const clean = stripFence(f.content!);
    if (RISKY_CODE.test(clean)) risky.push(p);
    resolved.push({ path: p, content: clean });
  }
  if (resolved.length === 0) {
    const why = skipped.length ? `구조 충돌로 모두 건너뜀:\n- ${skipped.join('\n- ')}` : '유효한 파일이 없어요.';
    return { kind: 'error', skill: 'change_code', text: `저장할 파일이 없어요(${why}).` };
  }

  const noteLine = typeof gen.note === 'string' && gen.note.trim() ? `\n비고: ${gen.note.trim()}` : '';
  const skipLine = skipped.length ? `\n↷ 건너뜀(구조 충돌): ${skipped.length}개` : '';
  const preview =
    `아래 ${resolved.length}개 파일을 생성/수정합니다 (기준 폴더 \`${baseDir}\`):\n` +
    resolved.map((f) => `  + ${f.path}`).join('\n') +
    skipLine +
    (risky.length ? `\n🚨 위험 패턴 감지: ${risky.join(', ')}` : '') +
    noteLine +
    `\n\n적용하려면 "응", 취소하려면 "아니오".`;
  return {
    kind: 'mutate',
    skill: 'change_code',
    preview,
    commit: { type: 'codeFiles', baseDir, files: resolved, structure, isTs, skipped, risky },
  };
}

/**
 * 오케스트레이터용 상위 디스패처 — plan 스텝을 종류에 맞는 builder 로 보낸다.
 * scaffold: 이름은 사용자 원문(ctx.userText)에서만 찾는다(instruction 은 프레임워크 용어를 이름으로 오인).
 * change_code: 항상 코드 생성 모드(baseDir = 마지막 스캐폴드 폴더 ?? code/).
 */
export async function prepareStep(
  deps: { llm: LLMClient; runtime: StepRuntime },
  intent: Intent,
  instruction: string,
  ctx: Context,
  codegenBaseDir: string,
): Promise<StepPrepared> {
  if (intent.name === 'scaffold_project') {
    const fw = detectFramework(ctx.userText) ?? detectFramework(instruction) ?? ctx.session?.framework ?? 'spring';
    if (ctx.session) ctx.session.framework = fw;
    const name = extractProjectName(ctx.userText) ?? `${fw}-app`;
    return prepareScaffold(fw, name, ctx.workspace);
  }
  if (intent.name === 'change_code') {
    // plan 흐름은 코드 생성. 발화에 명시적 파일 경로가 있으면 그 파일 편집.
    const path = extractFilePath(instruction);
    if (path && readArtifact(ctx.workspace, path) !== null) {
      return prepareEdit(deps.llm, ctx.workspace, path, instruction);
    }
    return prepareCodegen(deps.llm, { ...ctx, userText: instruction }, instruction, codegenBaseDir);
  }
  return prepareProduce(deps.runtime, { ...intent }, { ...ctx, userText: instruction, slots: {} });
}

// ─────────────────────────────────────────────────────────────────────────────
// commitStep — 승인된 부작용을 실제로 실행/쓰기
// ─────────────────────────────────────────────────────────────────────────────

export async function commitStep(commit: MutateCommit, ctx: Context): Promise<StepCommitted> {
  switch (commit.type) {
    case 'exec':
      return commitExec(commit, ctx);
    case 'editFile':
      return commitEdit(commit, ctx);
    case 'codeFiles':
      return commitCodeFiles(commit, ctx);
  }
}

function commitExec(c: Extract<MutateCommit, { type: 'exec' }>, ctx: Context): Promise<StepCommitted> {
  return runCommand(c.argv, c.cwd, c.timeoutMs).then((r) => {
    if (r.notFound) {
      return { text: `명령을 찾을 수 없어요: \`${c.argv[0]}\`\n${installHint(c.framework)}\n\n직접 실행하려면:\n\`${c.label}\``, artifacts: [] };
    }
    if (r.timedOut) {
      return { text: `명령이 시간 초과(또는 프롬프트에서 멈춤)로 자동 실행하지 못했어요. 터미널에서 직접 실행해 주세요:\n\`${c.label}\``, artifacts: [] };
    }
    const tail = ((r.ok ? r.stdout || r.stderr : r.stderr || r.stdout).trim().split('\n').slice(-12).join('\n')) || '(출력 없음)';
    if (!r.ok) return { text: `⚠️ 실행 실패 (code ${r.code}) — \`${c.label}\`\n\n${tail}`, artifacts: [] };
    // scaffold 만: 생성된 폴더를 기억해 이후 change_code 가 이 프로젝트 안에 코드를 쓰게 한다.
    // 폴더명은 빌드 시점에 넣은 projectDir 을 쓴다(argv 마지막 원소는 nest/next/tauri 에서 이름이 아님).
    if (c.remember && ctx.session) {
      const dirName = c.projectDir ?? scaffoldDirName(c.framework, c.argv[c.argv.length - 1]);
      ctx.session.framework = c.framework;
      ctx.session.lastProjectDir = dirName;
      return { text: `✅ 실행 완료 — \`${c.cwd}\`\n\`${c.label}\`\n\n${tail}`, artifacts: [dirName] };
    }
    return { text: `✅ 실행 완료 — \`${c.label}\`\n\n${tail}`, artifacts: [] };
  });
}

function commitEdit(c: Extract<MutateCommit, { type: 'editFile' }>, ctx: Context): StepCommitted {
  try {
    const bak = backupBeforeOverwrite(ctx.workspace, c.path); // 덮어쓰기 전 원본 백업(.bak)
    const p = overwriteFile(ctx.workspace, c.path, c.content);
    const note = bak ? `\n(원본 백업: ${bak})` : '';
    return { text: `✅ 저장 완료: ${p}${note}`, artifacts: [p] };
  } catch (err) {
    return { text: `저장 실패: ${err instanceof Error ? err.message : String(err)}`, artifacts: [] };
  }
}

async function commitCodeFiles(c: Extract<MutateCommit, { type: 'codeFiles' }>, ctx: Context): Promise<StepCommitted> {
  const saved: string[] = [];
  const savedRel: string[] = [];
  const failed: string[] = [];
  for (const f of c.files) {
    try {
      saved.push(overwriteFile(ctx.workspace, `${c.baseDir}/${f.path}`, f.content));
      savedRel.push(f.path);
    } catch {
      failed.push(f.path);
    }
  }
  if (saved.length === 0) return { text: `저장한 파일이 없어요(저장 실패: ${failed.join(', ')}).`, artifacts: [] };

  const stubbed = repairImports(ctx, c.baseDir, savedRel, c.structure, c.isTs);
  const stub = stubbed.length ? `\n🩹 누락 import stub 생성:\n${stubbed.map((s) => `- ${s}`).join('\n')}` : '';
  const skip = c.skipped.length ? `\n↷ 건너뜀(구조 충돌):\n${c.skipped.map((s) => `- ${s}`).join('\n')}` : '';
  const warn = failed.length ? `\n⚠️ 저장 실패: ${failed.join(', ')}` : '';
  const sec = c.risky.length
    ? `\n🚨 보안 주의 — 위험 패턴(eval/Function 생성자/child_process) 발견, 검토 필요:\n${c.risky.map((p) => `- ${p}`).join('\n')}`
    : '';
  const verify = await verifyGeneratedProject(ctx.workspace, c.baseDir);
  const verifyNote = verify ? `\n\n${verify}` : '';
  return {
    text: `✅ ${saved.length}개 파일 생성:\n` + saved.map((p) => `- ${p}`).join('\n') + stub + skip + warn + sec + verifyNote,
    artifacts: saved,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// import 스텁 복구 (orchestrator 에서 이식) — 생성 코드가 만들지 않은 로컬 import 대상에 최소 stub.
// ─────────────────────────────────────────────────────────────────────────────

/** import 문에서 로컬 대상('@/…'·'./…'·'../…')을 baseDir 기준 모듈경로로. 외부/경로탈출이면 null. */
function resolveLocal(spec: string, importerDir: string): string | null {
  if (spec.startsWith('@/')) return spec.slice(2);
  if (spec.startsWith('./') || spec.startsWith('../')) {
    const parts = importerDir ? importerDir.split('/') : [];
    for (const seg of spec.split('/')) {
      if (seg === '.' || seg === '') continue;
      if (seg === '..') {
        if (!parts.length) return null;
        parts.pop();
      } else parts.push(seg);
    }
    return parts.join('/');
  }
  return null;
}

function repairImports(ctx: Context, baseDir: string, savedRel: string[], existingRel: string[], isTs: boolean): string[] {
  const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.json'];
  const files = new Set<string>([...existingRel, ...savedRel]);
  const resolvable = (target: string): boolean => {
    if (files.has(target)) return true;
    if (EXTS.some((e) => files.has(target + e))) return true;
    if (EXTS.some((e) => files.has(`${target}/index${e}`))) return true;
    const onDisk = (rel: string): boolean => readArtifact(ctx.workspace, `${baseDir}/${rel}`) != null;
    if (onDisk(target)) return true;
    if (EXTS.some((e) => onDisk(target + e))) return true;
    return EXTS.some((e) => onDisk(`${target}/index${e}`));
  };
  const importFrom = /import\s+(?:([\w$]+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*['"]([^'"]+)['"]/g;
  const importBare = /import\s+['"]([^'"]+)['"]/g;
  const created: string[] = [];

  for (const rel of [...savedRel]) {
    const content = readArtifact(ctx.workspace, `${baseDir}/${rel}`);
    if (content == null) continue;
    const importerDir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
    let m: RegExpExecArray | null;
    importFrom.lastIndex = 0;
    while ((m = importFrom.exec(content))) {
      const [, def, namedRaw, spec] = m;
      const target = resolveLocal(spec, importerDir);
      if (!target || resolvable(target)) continue;
      const named = (namedRaw ?? '')
        .split(',')
        .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
        .filter(Boolean);
      const lines: string[] = [];
      for (const n of named) lines.push(/^[A-Z]/.test(n) ? `export function ${n}(_props: any) { return null; }` : `export const ${n}: any = undefined;`);
      if (def) lines.push('export default function (_props: any) { return null; }');
      if (!lines.length) lines.push('export default function (_props: any) { return null; }');
      const stubPath = `${target}${isTs ? '.tsx' : '.jsx'}`;
      if (readArtifact(ctx.workspace, `${baseDir}/${stubPath}`) != null) continue;
      try {
        overwriteFile(ctx.workspace, `${baseDir}/${stubPath}`, lines.join('\n') + '\n');
        files.add(stubPath);
        created.push(stubPath);
      } catch {
        /* 경로 탈출 등 무시 */
      }
    }
    importBare.lastIndex = 0;
    while ((m = importBare.exec(content))) {
      const spec = m[1];
      const target = resolveLocal(spec, importerDir);
      if (!target || resolvable(target) || !/\.css$/.test(target)) continue;
      if (readArtifact(ctx.workspace, `${baseDir}/${target}`) != null) continue;
      try {
        overwriteFile(ctx.workspace, `${baseDir}/${target}`, '');
        files.add(target);
        created.push(target);
      } catch {
        /* 무시 */
      }
    }
  }
  return created;
}
