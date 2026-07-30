// plan_and_run 장기 완주 평가 — 6~8단계 계획을 끝까지 진행(응×N)해 분해·체이닝·완주·무오버플로를 검증한다.
// commit d801d8c(maxSteps 설정화 + priorOutputsBlock 압축 + planTokens 비례)의 실증 하네스.
//
// 실행:  AGENT_MAX_STEPS=8 AGENT_PROFILE=m4 node --import tsx scripts/eval-plan-longrun.ts
//        AGENT_MAX_STEPS=8 AGENT_PROFILE=m2 node --import tsx scripts/eval-plan-longrun.ts
//        LONGRUN_STEPS=6,8 …  ← 정례 스모크: 6·8단계만(중간 7 생략) 골라 빠르게 회귀 확인.
//
// 부작용 격리(TEST-CRITERIA §3): 시나리오마다 임시 워크스페이스 + 고유 chatId + pipe.reset.
// 발화는 produce 계열(research/design/docs/proposal/message/minutes/deploy/review)만 쓰도록 설계 —
// scaffold(CLI exec)·프레임워크 키워드를 배제해 실 명령/네트워크를 건드리지 않는다. 혹 mutate(codegen)
// 단계가 섞여도 codeFiles 쓰기는 격리 temp 로만 간다. 승인 "응"만 주고, 완주(🎉)까지 몰아붙인다.
import 'dotenv/config';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPipeline } from '../src/pipeline.js';

interface LongScenario {
  steps: number; // 목표 단계 수(발화 설계 기준)
  label: string;
  user: string; // 계획을 세울 첫 발화(6~8개 서로 다른 produce 작업)
}

// 6~8단계: 모두 produce. "하고, …하고, …해줘" 구조로 작업 경계가 뚜렷하다.
// 키워드 매핑(heuristic 폴백 대비): 조사=research / 설계=design / 문서·가이드=write_docs /
// 제안서=write_proposal / 메일=write_message / 회의록=meeting_minutes / 배포=setup_deployment /
// 품질·리뷰=review_code. scaffold(만들+프레임워크)·change_code(작성/구현/추가/코드) 키워드는 피한다.
const SCENARIOS: LongScenario[] = [
  {
    steps: 6,
    label: '6단계 완주(조사→설계→문서→제안서→메일→회의록)',
    user:
      '결제 시장 트렌드를 조사하고, 주문 결제 도메인을 설계하고, 그 설계를 API 가이드 문서로 정리하고, ' +
      '투자 유치용 제안서를 만들고, 고객 안내 메일 문안을 쓰고, 마지막으로 킥오프 회의록 초안까지 정리해줘',
  },
  {
    steps: 7,
    label: '7단계 완주(+배포 방안)',
    user:
      '결제 시장 트렌드를 조사하고, 주문 결제 도메인을 설계하고, 그 설계를 API 가이드 문서로 정리하고, ' +
      '투자 유치용 제안서를 만들고, 고객 안내 메일 문안을 쓰고, 킥오프 회의록 초안을 정리하고, ' +
      '마지막으로 배포 전략까지 정리해줘',
  },
  {
    steps: 8,
    label: '8단계 완주(+품질 리뷰)',
    // review 계열을 계획 후미에 둘 땐 대상을 발화로 못박는다(§7 관찰: 대상 없는 review 는 코드 되묻기로 축약).
    // 앞 단계의 설계·API 문서 산출을 명시적 리뷰 대상으로 지정 → 체이닝 맥락이 실제 리뷰로 이어지게 한다.
    user:
      '결제 시장 트렌드를 조사하고, 주문 결제 도메인을 설계하고, 그 설계를 API 가이드 문서로 정리하고, ' +
      '투자 유치용 제안서를 만들고, 고객 안내 메일 문안을 쓰고, 킥오프 회의록 초안을 정리하고, ' +
      '배포 전략을 정리하고, 마지막으로 앞서 정리한 설계와 API 문서 내용을 대상으로 품질 리뷰까지 해줘',
  },
];

const TURN_TIMEOUT_MS = 360_000; // 제품 상한(자유생성 300s)에 맞춰 상향 — 정상적으로 느린 완주를 오탐 실패로 안 찍음
const PLAN = /🎯 목표[\s\S]*할 일/;
const FINISH = /🎉 계획 완료 — (\d+)\/(\d+)단계/;
// 오버플로/치명 오류 신호(있으면 안 됨).
const OVERFLOW = /num_ctx|context length|context window|too many tokens|exceeded|maximum context/i;
const GENFAIL = /생성에 실패|생성 실패|출력 한도|잘렸어요|파일을 찾지 못|만들 수 없어요/;

const oneLine = (s: string, n = 90): string => s.replace(/\s+/g, ' ').trim().slice(0, n);
const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | { __t: true }> =>
  Promise.race([p, new Promise<{ __t: true }>((r) => setTimeout(() => r({ __t: true }), ms))]);

/** 첫 응답(체크리스트)에서 계획 단계 수를 센다: "N. [ ] …" 라인 개수. */
function countPlanSteps(planText: string): number {
  return (planText.match(/^\s*\d+\.\s+\[[ x]\]/gm) ?? []).length;
}

async function main(): Promise<void> {
  const pipe = await createPipeline();
  const info = pipe.info();
  const maxSteps = Number(process.env.AGENT_MAX_STEPS) || 4;
  // LONGRUN_STEPS=6,8 처럼 지정하면 해당 단계 시나리오만 실행(정례 스모크). 없으면 전체(6·7·8).
  const only = (process.env.LONGRUN_STEPS ?? '').split(',').map((s) => Number(s.trim())).filter((n) => n >= 1);
  const scenarios = only.length ? SCENARIOS.filter((sc) => only.includes(sc.steps)) : SCENARIOS;

  console.log(`\n${'='.repeat(84)}`);
  console.log(`프로필=${info.profile}  chat=${info.chatModel}  · plan 장기 완주(${scenarios.map((s) => s.steps).join('·')}단계) · AGENT_MAX_STEPS=${maxSteps}`);
  console.log('='.repeat(84));

  interface Res {
    steps: number; label: string; planSteps: number; committed: number; total: number;
    reachedFinish: boolean; overflow: boolean; genfail: boolean; turns: number; ms: number; chainOk: boolean; notes: string[];
  }
  const results: Res[] = [];

  for (let s = 0; s < scenarios.length; s++) {
    const sc = scenarios[s];
    const ws = mkdtempSync(join(tmpdir(), 'longrun-'));
    const chatId = `longrun-${info.profile}-${sc.steps}-${s}`;
    pipe.reset({ workspace: ws, chatId });
    const t0 = Date.now();
    const notes: string[] = [];
    let planSteps = 0, committed = 0, total = 0;
    let reachedFinish = false, overflow = false, genfail = false, chainOk = true;
    let turns = 0;

    // 턴1: 계획 수립
    let firstIntent = '(err)';
    let firstText = '';
    try {
      const r = await withTimeout(pipe.handle(sc.user, { workspace: ws, chatId }), TURN_TIMEOUT_MS);
      if ('__t' in r) { firstText = '(timeout)'; firstIntent = '(timeout)'; }
      else { firstText = r.text ?? ''; firstIntent = r.intent; }
    } catch (e) { firstText = e instanceof Error ? e.message : String(e); }
    turns++;
    const planOk = firstIntent === 'plan_and_run' && PLAN.test(firstText);
    planSteps = countPlanSteps(firstText);
    console.log(`\n▶ ${sc.label}`);
    console.log(`  T1 계획수립: intent=${firstIntent} plan=${planOk ? '✓' : '✗'} 분해=${planSteps}단계 (목표 ${sc.steps})`);
    console.log(`     ⟨${oneLine(firstText, 110)}⟩`);
    if (OVERFLOW.test(firstText)) overflow = true;

    if (planOk) {
      // 응×N 으로 완주까지. mutate 미리보기(2연속 응)까지 고려해 여유롭게 상한.
      const maxTurns = planSteps * 2 + 6;
      for (let k = 0; k < maxTurns && !reachedFinish; k++) {
        let text = '';
        try {
          const r = await withTimeout(pipe.handle('응', { workspace: ws, chatId }), TURN_TIMEOUT_MS);
          if ('__t' in r) { text = '(timeout)'; notes.push(`T${turns + 1} timeout(미완/성능)`); }
          else text = r.text ?? '';
        } catch (e) { text = e instanceof Error ? e.message : String(e); }
        turns++;
        if (OVERFLOW.test(text)) { overflow = true; notes.push(`T${turns} 오버플로 신호`); }
        if (GENFAIL.test(text)) { genfail = true; notes.push(`T${turns} 생성실패/절단`); }
        const stepHead = text.match(/^## (\d+)\./m);
        const fin = text.match(FINISH);
        if (fin) { reachedFinish = true; committed = Number(fin[1]); total = Number(fin[2]); }
        const tag = fin ? '🎉완료' : stepHead ? `단계${stepHead[1]}` : text.includes('만들까요') || text.includes('생성/') ? 'mutate미리보기' : text.includes('진행할까요') ? '진행질문' : '기타';
        // 체이닝 관찰(느슨): produce 단계 본문이 직전보다 유의미하게 다르게(누적) 나오는지 길이로만 거칠게 로깅.
        const bodyLen = text.replace(/\s+/g, '').length;
        console.log(`  T${String(turns).padStart(2)} [${tag}] len=${bodyLen}  ⟨${oneLine(text)}⟩`);
      }
      if (!reachedFinish) notes.push(`상한 ${maxTurns}턴 내 미완주(committed 미확인)`);
    } else {
      notes.push('계획 수립 실패(plan_and_run 미라우팅 또는 체크리스트 없음)');
      chainOk = false;
    }

    const ms = Date.now() - t0;
    results.push({ steps: sc.steps, label: sc.label, planSteps, committed, total, reachedFinish, overflow, genfail, turns, ms, chainOk, notes });
    const verdict = planOk && reachedFinish && !overflow ? '✅' : '❌';
    console.log(`  ${verdict} 결과: 분해 ${planSteps}/${sc.steps}단계, 완주 ${reachedFinish ? `${committed}/${total}` : '미완'}, 오버플로 ${overflow ? '⚠️있음' : '없음'}, 생성실패 ${genfail ? '⚠️' : '없음'}, ${turns}턴 ${(ms / 1000).toFixed(1)}s`);
    if (notes.length) console.log(`     노트: ${notes.join(' · ')}`);
  }

  console.log(`\n${'-'.repeat(84)}\n장기 완주 요약 (프로필 ${info.profile}, maxSteps=${maxSteps})`);
  for (const r of results) {
    const v = r.reachedFinish && !r.overflow ? '✅' : '❌';
    console.log(`  ${v} ${r.steps}단계 | 분해 ${r.planSteps} · 완주 ${r.reachedFinish ? `${r.committed}/${r.total}` : '미완'} · 오버플로 ${r.overflow ? 'Y' : 'N'} · ${(r.ms / 1000).toFixed(1)}s`);
  }
  const pass = results.filter((r) => r.reachedFinish && !r.overflow).length;
  console.log('-'.repeat(84));
  console.log(`전체 [${info.profile}]: ${pass}/${results.length} 완주(무오버플로)\n`);
}

main().catch((err) => {
  console.error('평가 실패:', err instanceof Error ? err.message : String(err));
  process.exit(2);
});
