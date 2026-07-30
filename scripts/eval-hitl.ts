// plan_and_run · HITL 멀티턴 평가 — 복잡도 1~10, 각 3~5 시나리오. 프로필은 AGENT_PROFILE(m4|m2).
//
// 실행:  AGENT_PROFILE=m4 node --import tsx scripts/eval-hitl.ts
//        AGENT_PROFILE=m2 node --import tsx scripts/eval-hitl.ts
//
// 부작용 격리: 시나리오마다 임시 워크스페이스 + 고유 chatId. 승인("응")으로 실제 실행되는 것은
// 격리된 temp 에 파일쓰기(write_tests editFile / change_code codeFiles)뿐이다. scaffold·run_command 의
// 실제 CLI 실행은 승인하지 않고(미리보기·취소·질문 게이트까지만) 실 명령·네트워크를 건드리지 않는다.
// 채점은 응답 텍스트 패턴(미리보기/취소/계획/건너뛰기/완료 문구)으로 상태기계 전이를 확인한다.
import 'dotenv/config';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPipeline } from '../src/pipeline.js';

interface Turn {
  user: string;
  intent?: string; // 기대 intent(선택)
  inc?: RegExp; // 응답에 포함돼야 함
  exc?: RegExp; // 응답에 없어야 함(예: 부작용 커밋 문구)
}
interface Scenario {
  lvl: number;
  label: string;
  ws?: 'fixture' | 'repo'; // 기본 fixture(임시). run_command 등 실 저장소 감지가 필요하면 repo.
  turns: Turn[];
}

/** 시나리오별 격리 워크스페이스(픽스처 시드). */
function seedWs(): string {
  const ws = mkdtempSync(join(tmpdir(), 'hitl-'));
  mkdirSync(join(ws, 'src'), { recursive: true });
  writeFileSync(
    join(ws, 'src/discount.ts'),
    `export function applyDiscount(price: number, rate: number): number {\n  return price - price * rate;\n}\n`,
    'utf8',
  );
  writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'fx', version: '1.0.0' }, null, 2), 'utf8');
  writeFileSync(join(ws, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true } }, null, 2), 'utf8');
  return ws;
}

// 공용 패턴
const PREVIEW = /만들까요|실행할까요|바꿀까요|테스트를 만들까요|생성\/?수정|파일을 생성/;
const CANCEL = /취소했어요|계획을 (취소|중단)/;
const PLAN = /🎯 목표[\s\S]*할 일/;
const ADVANCE = /진행할까요|계획 완료|건너뛰|## \d|💾|✅/;
const COMMITTED = /✅ 저장 완료|✅ \d+개 파일 생성|✅ 실행 완료/;

const SCENARIOS: Scenario[] = [
  // ── L1: 미리보기/되묻기 진입(대부분 결정론, 부작용 없음) ──
  { lvl: 1, label: 'scaffold 미리보기 진입', turns: [{ user: '스프링 프로젝트 shopmall 만들어줘', intent: 'scaffold_project', inc: /만들까요|실행하려면 "응"/ }] },
  { lvl: 1, label: 'scaffold 이름 되묻기', turns: [{ user: '스프링 프로젝트 만들어줘', intent: 'scaffold_project', inc: /이름을 영문으로/ }] },
  { lvl: 1, label: 'run_command 미리보기', ws: 'repo', turns: [{ user: '타입체크 돌려줘', intent: 'run_command', inc: /실행할까요/ }] },
  { lvl: 1, label: 'change_code 경로 되묻기', turns: [{ user: '이 코드 리팩터링 해줘', intent: 'change_code', inc: /어떤 파일/ }] },

  // ── L2: 취소/부정 게이트(부작용 없음) ──
  { lvl: 2, label: 'scaffold→아니오 취소', turns: [
    { user: '스프링 프로젝트 shopmall 만들어줘', inc: PREVIEW },
    { user: '아니오', inc: CANCEL, exc: COMMITTED },
  ] },
  { lvl: 2, label: 'run_command→취소', ws: 'repo', turns: [
    { user: '타입체크 돌려줘', inc: /실행할까요/ },
    { user: '취소할게', inc: CANCEL, exc: COMMITTED },
  ] },
  { lvl: 2, label: 'scaffold 이름되묻기→아니오', turns: [
    { user: '스프링 프로젝트 만들어줘', inc: /이름을 영문으로/ },
    { user: '아니오', inc: CANCEL },
  ] },
  { lvl: 2, label: 'change_code 경로되묻기→취소', turns: [
    { user: '이 코드 정리해줘', inc: /어떤 파일/ },
    { user: '취소', inc: CANCEL },
  ] },

  // ── L3: 긍정/부정 판정 견고성(질문·가정은 승인 아님 — Medium 수정 검증) ──
  { lvl: 3, label: '미리보기→가정질문은 커밋 안 함', turns: [
    { user: '스프링 프로젝트 shopmall 만들어줘', inc: PREVIEW },
    { user: '이거 실행하면 뭐가 바뀌어?', exc: COMMITTED }, // '실행' 포함이지만 질문 → 승인 아님
  ] },
  { lvl: 3, label: 'write_tests→적용여부 질문은 커밋 안 함', turns: [
    { user: 'src/discount.ts 단위 테스트 짜줘', inc: /테스트를 만들까요/ },
    { user: '적용하면 기존 파일 덮어써?', exc: COMMITTED },
  ] },
  { lvl: 3, label: 'write_tests→명확한 부정', turns: [
    { user: 'src/discount.ts 테스트 만들어줘', inc: /테스트를 만들까요/ },
    { user: '아니 하지마', inc: CANCEL, exc: COMMITTED },
  ] },
  { lvl: 3, label: '미리보기→"그대로 진행" 긍정 인식', turns: [
    { user: 'src/discount.ts 테스트 짜줘', inc: /테스트를 만들까요/ },
    { user: '그대로 진행', inc: /✅ 저장 완료/ }, // 격리 temp 에 저장(안전)
  ] },

  // ── L4: 안전 커밋 완주(editFile / codeFiles 를 격리 temp 에) ──
  { lvl: 4, label: 'write_tests 승인 완주', turns: [
    { user: 'src/discount.ts 단위 테스트 짜줘', inc: /테스트를 만들까요/ },
    { user: '응', inc: /✅ 저장 완료/ },
  ] },
  { lvl: 4, label: 'change_code(경로) 편집 완주', turns: [
    { user: 'src/discount.ts 에 입력값 음수 검증을 추가해줘', inc: /바꿀까요|생성/ },
    { user: '응', inc: /✅ 저장 완료|✅ \d+개 파일 생성/ },
  ] },
  { lvl: 4, label: 'change_code(codegen) 생성 완주', turns: [
    { user: '이 프로젝트에 금액 포맷 유틸 함수 추가해줘', inc: /생성\/?수정|파일을 생성|바꿀까요/ },
    { user: '응', inc: /✅ \d+개 파일 생성|✅ 저장 완료/ },
  ] },

  // ── L5: 되묻기 → 값 제공 → 미리보기 이어짐 ──
  { lvl: 5, label: 'scaffold 이름 제공→미리보기', turns: [
    { user: 'nextjs 프론트 프로젝트 만들어줘', inc: /이름을 영문으로/ },
    { user: 'shopweb', inc: /만들까요|실행하려면 "응"/ },
  ] },
  { lvl: 5, label: 'change_code 경로 제공→미리보기', turns: [
    { user: '이 코드 리팩터링 해줘', inc: /어떤 파일/ },
    { user: 'src/discount.ts', inc: /바꿀까요/ },
  ] },
  { lvl: 5, label: 'scaffold 잘못된 이름→재요청', turns: [
    { user: '스프링 프로젝트 만들어줘', inc: /이름을 영문으로/ },
    { user: '한글이름', inc: /영문 프로젝트 이름/ },
  ] },

  // ── L6: plan_and_run 계획 수립 + 체크리스트 ──
  { lvl: 6, label: 'plan 수립: 설계+스캐폴딩', turns: [{ user: '주문 도메인 설계하고 이어서 스캐폴딩까지 진행해줘', intent: 'plan_and_run', inc: PLAN }] },
  { lvl: 6, label: 'plan 수립: 조사+제안서', turns: [{ user: '결제 트렌드 조사하고 그걸로 제안서까지 만들어줘', intent: 'plan_and_run', inc: PLAN }] },
  { lvl: 6, label: 'plan 수립: 설계+문서', turns: [{ user: 'DB 스키마 설계하고 API 문서까지 작성해줘', intent: 'plan_and_run', inc: PLAN }] },
  { lvl: 6, label: 'plan 수립: 리뷰+테스트', turns: [{ user: '이 코드 리뷰하고 이어서 테스트까지 만들어줘', intent: 'plan_and_run', inc: PLAN }] },

  // ── L7: plan 진행 제어(결정론: abort/skip/edit/재확인) ──
  { lvl: 7, label: 'plan→아니오 취소', turns: [
    { user: '주문 도메인 설계하고 스캐폴딩까지 진행해줘', inc: PLAN },
    { user: '아니오', inc: CANCEL },
  ] },
  { lvl: 7, label: 'plan→건너뛰기', turns: [
    { user: '조사하고 제안서까지 만들어줘', inc: PLAN },
    { user: '건너뛰기', inc: ADVANCE },
  ] },
  { lvl: 7, label: 'plan→2번 빼줘(편집)', turns: [
    { user: '설계하고 문서까지 작성하고 리뷰도 해줘', inc: PLAN },
    { user: '2번 빼줘', inc: /할 일|모든 단계를 빼/ },
  ] },
  { lvl: 7, label: 'plan→비응답 재확인', turns: [
    { user: '설계하고 스캐폴딩까지 진행해줘', inc: PLAN },
    { user: '음 글쎄', inc: /계획 진행 중|진행할까요/ },
  ] },

  // ── L8: plan 첫 단계 실행 후 전진 ──
  { lvl: 8, label: 'plan→응(1단계 실행)→전진', turns: [
    { user: '주문 도메인 설계하고 API 문서까지 작성해줘', inc: PLAN },
    { user: '응', inc: ADVANCE },
  ] },
  { lvl: 8, label: 'plan→응→건너뛰기', turns: [
    { user: '조사하고 제안서까지 만들어줘', inc: PLAN },
    { user: '응', inc: ADVANCE },
    { user: '건너뛰기', inc: ADVANCE },
  ] },
  { lvl: 8, label: 'plan→응→아니오(중단)', turns: [
    { user: '설계하고 문서까지 작성해줘', inc: PLAN },
    { user: '응', inc: ADVANCE },
    { user: '아니오', inc: /중단|완료|취소/ },
  ] },

  // ── L9: plan 내 mutate 단계 커밋 게이트(+체이닝 완주) ──
  { lvl: 9, label: 'plan scaffold 단계 커밋게이트→다시', turns: [
    { user: '스프링 프로젝트 만들고 README까지 작성해줘', inc: PLAN },
    { user: '응', inc: /만들까요|## \d|진행할까요/ }, // 첫 단계(설계/스캐폴드) 진입
    { user: '다시', inc: /만들까요|## \d|진행할까요|저장|완료/ },
  ] },
  { lvl: 9, label: 'plan mutate 단계→건너뛰기', turns: [
    { user: '스프링 프로젝트 만들고 문서까지 써줘', inc: PLAN },
    { user: '응', inc: /만들까요|## \d|진행할까요/ },
    { user: '건너뛰기', inc: ADVANCE },
  ] },
  { lvl: 9, label: 'plan 설계→코드 체이닝 완주', turns: [
    { user: '주문 도메인 설계하고 그걸로 코드까지 생성해줘', inc: PLAN },
    { user: '응', inc: ADVANCE }, // 1단계 설계(produce)
    { user: '응', inc: /생성\/?수정|파일을 생성|## \d|진행할까요|완료/ }, // 2단계 코드 preview 또는 진행
  ] },

  // ── L10: 복합 시나리오(편집+진행+skip+완주) ──
  { lvl: 10, label: 'plan 편집후 진행→건너뛰기→완주', turns: [
    { user: '설계하고 문서 작성하고 리뷰까지 해줘', inc: PLAN },
    { user: '3번 빼줘', inc: /할 일|모든 단계를 빼/ },
    { user: '응', inc: ADVANCE },
    { user: '건너뛰기', inc: ADVANCE },
  ] },
  { lvl: 10, label: 'plan 전부 건너뛰어 완주', turns: [
    { user: '조사하고 제안서까지 만들어줘', inc: PLAN },
    { user: '건너뛰기', inc: ADVANCE },
    { user: '건너뛰기', inc: /계획 완료|진행할까요|건너뛰/ },
  ] },
  { lvl: 10, label: 'plan 비응답→재확인→응→중단', turns: [
    { user: '설계하고 스캐폴딩까지 진행해줘', inc: PLAN },
    { user: '흠', inc: /계획 진행 중|진행할까요/ },
    { user: '응', inc: /만들까요|## \d|진행할까요|저장|완료/ },
    { user: '그만', inc: /중단|취소|완료/ },
  ] },
];

const TURN_TIMEOUT_MS = 360_000; // 제품 상한(자유생성 300s)에 맞춰 상향 — 정상적으로 느린 완주를 오탐 실패로 안 찍음
const oneLine = (s: string, n = 62): string => s.replace(/\s+/g, ' ').trim().slice(0, n);
const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | { __t: true }> =>
  Promise.race([p, new Promise<{ __t: true }>((r) => setTimeout(() => r({ __t: true }), ms))]);

async function main(): Promise<void> {
  const repo = process.cwd();
  // HITL_LEVELS=1,2,6 처럼 지정하면 해당 복잡도만 실행(스모크/부분 재실행용). 없으면 전체.
  const only = (process.env.HITL_LEVELS ?? '').split(',').map((s) => Number(s.trim())).filter((n) => n >= 1);
  const scenarios = only.length ? SCENARIOS.filter((s) => only.includes(s.lvl)) : SCENARIOS;
  const pipe = await createPipeline();
  const info = pipe.info();

  console.log(`\n${'='.repeat(80)}`);
  console.log(`프로필=${info.profile}  chat=${info.chatModel}  · plan_and_run·HITL 멀티턴 · 시나리오 ${scenarios.length}개`);
  console.log('='.repeat(80));

  interface SRes { lvl: number; label: string; ok: boolean; turns: number; passTurns: number; ms: number; detail: string[] }
  const results: SRes[] = [];

  for (let s = 0; s < scenarios.length; s++) {
    const sc = scenarios[s];
    const ws = sc.ws === 'repo' ? repo : seedWs();
    const chatId = `hitl-${info.profile}-${s}`;
    pipe.reset({ workspace: ws, chatId }); // 영속 세션(.cache/sessions.json) 잔여 상태 누수 차단 — 매 시나리오 깨끗한 세션
    const t0 = Date.now();
    let passTurns = 0;
    const detail: string[] = [];
    for (let ti = 0; ti < sc.turns.length; ti++) {
      const turn = sc.turns[ti];
      let text = '';
      let intent = '(err)';
      try {
        const res = await withTimeout(pipe.handle(turn.user, { workspace: ws, chatId }), TURN_TIMEOUT_MS);
        if ('__t' in res) { text = '(timeout)'; intent = '(timeout)'; }
        else { text = res.text ?? ''; intent = res.intent; }
      } catch (e) {
        text = e instanceof Error ? e.message : String(e);
      }
      const okIntent = !turn.intent || intent === turn.intent;
      const okInc = !turn.inc || turn.inc.test(text);
      const okExc = !turn.exc || !turn.exc.test(text);
      const ok = okIntent && okInc && okExc;
      if (ok) passTurns++;
      const why = !okIntent ? `intent≠${turn.intent}(${intent})` : !okInc ? `inc실패` : !okExc ? `exc위반(부작용?)` : '';
      detail.push(`    ${ok ? '✓' : '✗'} T${ti + 1} «${oneLine(turn.user, 34)}» → [${intent}] ${why}  ⟨${oneLine(text)}⟩`);
    }
    const ms = Date.now() - t0;
    const ok = passTurns === sc.turns.length;
    if (ok) {} // no-op
    results.push({ lvl: sc.lvl, label: sc.label, ok, turns: sc.turns.length, passTurns, ms, detail });
    console.log(`L${String(sc.lvl).padStart(2)} ${ok ? '✅' : '❌'} ${(ms / 1000).toFixed(1).padStart(6)}s  ${sc.label}  (${passTurns}/${sc.turns.length})`);
    for (const d of detail) console.log(d);
  }

  // 요약
  console.log(`\n${'-'.repeat(80)}\n복잡도별 요약 (프로필 ${info.profile})`);
  const byLvl = new Map<number, SRes[]>();
  for (const r of results) (byLvl.get(r.lvl) ?? byLvl.set(r.lvl, []).get(r.lvl)!).push(r);
  for (const lvl of [...byLvl.keys()].sort((a, b) => a - b)) {
    const g = byLvl.get(lvl)!;
    const pass = g.filter((r) => r.ok).length;
    const avg = (g.reduce((a, r) => a + r.ms, 0) / g.length / 1000).toFixed(1);
    console.log(`  L${String(lvl).padStart(2)}  시나리오 ${pass}/${g.length} 통과  평균 ${avg}s`);
  }
  const pass = results.filter((r) => r.ok).length;
  const total = (results.reduce((a, r) => a + r.ms, 0) / 1000).toFixed(1);
  console.log('-'.repeat(80));
  console.log(`전체 [${info.profile}]: 시나리오 ${pass}/${results.length} (${((pass / results.length) * 100).toFixed(1)}%)  ·  총 ${total}s`);
  const bad = results.filter((r) => !r.ok);
  if (bad.length) {
    console.log('\n실패 시나리오:');
    for (const r of bad) console.log(`  - L${r.lvl} ${r.label} (${r.passTurns}/${r.turns})`);
  }
  console.log('');
}

main().catch((err) => {
  console.error('평가 실패:', err instanceof Error ? err.message : String(err));
  process.exit(2);
});
