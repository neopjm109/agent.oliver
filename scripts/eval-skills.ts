// 전체 스킬 실행 평가 — 복잡도 1~10 으로 나눠 각 스킬을 "실제로 실행"하고(라우팅만이 아님)
// 라우팅 정확도·실행 성공·지연·출력 길이를 측정한다. 프로필은 AGENT_PROFILE 로 지정(m4|m2).
//
// 실행:  AGENT_PROFILE=m4 node --import tsx scripts/eval-skills.ts
//        AGENT_PROFILE=m2 node --import tsx scripts/eval-skills.ts
//
// - mutate 스킬(scaffold/change_code/write_tests/run_command)은 미리보기(pendingStepCommit)에서
//   멈추므로 실제 파일쓰기·명령실행 같은 부작용은 없다(승인 "응"을 주지 않음).
// - 인제스천 스킬(review/analyze/explain/write_tests/convert/meeting)은 임시 픽스처 워크스페이스의
//   파일을 참조한다. git_artifact 는 실제 저장소(cwd)를 워크스페이스로 써서 최근 커밋을 컨텍스트로 받는다.
import 'dotenv/config';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPipeline } from '../src/pipeline.js';

interface Case {
  lvl: number; // 복잡도 1~10
  label: string; // 스킬/시나리오 라벨
  text: string;
  expect: string; // 기대 intent
  alt?: string[]; // 대체 허용 intent
  ws?: 'fixture' | 'repo'; // 워크스페이스(기본 fixture). git_artifact 는 repo.
}

/** 인제스천·코드생성 대상 픽스처 워크스페이스를 만든다(모든 케이스가 공유). */
function makeFixture(): string {
  const ws = mkdtempSync(join(tmpdir(), 'skilleval-'));
  mkdirSync(join(ws, 'src'), { recursive: true });
  writeFileSync(
    join(ws, 'src/discount.ts'),
    `export function applyDiscount(price: number, rate: number): number {
  // rate 는 0~1 가정. 경계·음수 검증이 없다.
  return price - price * rate;
}

export function totalPrice(items: { price: number; qty: number }[]): number {
  let sum = 0;
  for (const it of items) sum += it.price * it.qty;
  return sum;
}
`,
    'utf8',
  );
  writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0', scripts: { build: 'tsc' } }, null, 2), 'utf8');
  writeFileSync(join(ws, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, module: 'ESNext', target: 'ES2022' } }, null, 2), 'utf8');
  writeFileSync(
    join(ws, 'notes.md'),
    '# 결제 모듈 메모\n\n- 할인 정책: 등급별 5~15%\n- 세금: 부가세 10% 별도\n- 환불: 7일 이내 전액\n\n## 미결\n- 포인트 적립률 미정\n',
    'utf8',
  );
  writeFileSync(
    join(ws, 'memo.md'),
    '결제 모듈 킥오프 회의\n참석: 박(PM), 김(BE), 이(FE)\n- 박: 다음 주까지 요구사항 확정\n- 김: 결제 API 스펙 초안 잡기로\n- 이: 체크아웃 화면 와이어프레임\n- 3사 PG 비교는 김이 조사\n결정: 1차 오픈은 카드 결제만\n',
    'utf8',
  );
  return ws;
}

const CASES: Case[] = [
  // ── L1: 결정론/테이블 (LLM 최소) ──
  { lvl: 1, label: 'agent_status', text: '상태 확인', expect: 'agent_status' },
  { lvl: 1, label: 'chitchat(인사)', text: '안녕하세요', expect: 'chitchat' },
  // ── L2: 경량 LLM 짧은 응답 ──
  { lvl: 2, label: 'chitchat(정체·warm)', text: '너 뭐 할 수 있어?', expect: 'chitchat' },
  { lvl: 2, label: 'unknown(OOS/실시간)', text: '오늘 서울 날씨 어때?', expect: 'unknown' },
  // ── L3: 단일 짧은 생성 ──
  { lvl: 3, label: 'explain_code', text: 'src/discount.ts 이 코드 뭐 하는지 설명해줘', expect: 'explain_code', alt: ['review_code'] },
  { lvl: 3, label: 'translate(짧은 문장)', text: '이 문장 영어로 번역해줘: 우리는 내일 오후에 회의를 합니다.', expect: 'translate' },
  // ── L4: 결정론 조립/감지 (명령·배포·스캐폴드 미리보기) ──
  { lvl: 4, label: 'run_command(preview)', text: '타입체크 돌려줘', expect: 'run_command', ws: 'repo' },
  { lvl: 4, label: 'setup_deployment', text: '이 프로젝트 배포용 빌드 만들어줘', expect: 'setup_deployment', ws: 'repo' },
  { lvl: 4, label: 'scaffold_project(preview)', text: '스프링 프로젝트 shopmall 만들어줘', expect: 'scaffold_project' },
  // ── L5: 중간 생성 + 인제스천 ──
  { lvl: 5, label: 'review_code', text: 'src/discount.ts 리뷰해줘', expect: 'review_code' },
  { lvl: 5, label: 'analyze_document', text: 'notes.md 분석해서 요약해줘', expect: 'analyze_document' },
  { lvl: 5, label: 'research_topic', text: 'REST랑 GraphQL 차이 정리해줘', expect: 'research_topic' },
  // ── L6: 구조화 생성 ──
  { lvl: 6, label: 'design_system', text: '주문 도메인 아키텍처 설계해줘', expect: 'design_system' },
  { lvl: 6, label: 'write_message', text: '회의 일정 변경 메일 초안 정중하게 써줘', expect: 'write_message' },
  { lvl: 6, label: 'write_docs', text: '이 결제 모듈 프로젝트 README 작성해줘', expect: 'write_docs' },
  { lvl: 6, label: 'git_artifact', text: '커밋 메시지 만들어줘', expect: 'git_artifact', ws: 'repo' },
  // ── L7: 코드인접 생성 + 파일 산출 ──
  { lvl: 7, label: 'write_tests(preview)', text: 'src/discount.ts 단위 테스트 짜줘', expect: 'write_tests' },
  { lvl: 7, label: 'convert_document', text: 'notes.md 를 텍스트로 변환해줘', expect: 'convert_document' },
  { lvl: 7, label: 'meeting_minutes', text: 'memo.md 이 회의 메모 회의록으로 정리하고 할 일 뽑아줘', expect: 'meeting_minutes', alt: ['analyze_document'] },
  // ── L8: 코드 생성(무거움) ──
  { lvl: 8, label: 'change_code(codegen preview)', text: '이 프로젝트에 금액 검증 유틸 함수 추가해줘', expect: 'change_code' },
  // ── L9: 장문 창작 / 계획 ──
  { lvl: 9, label: 'write_proposal', text: '결제 모듈 구축 사업 제안서 초안 써줘', expect: 'write_proposal' },
  { lvl: 9, label: 'write_story', text: '판타지 단편 소설 하나 써줘', expect: 'write_story' },
  { lvl: 9, label: 'run_game_session', text: 'TRPG 던전 세션 하나 만들어줘', expect: 'run_game_session' },
  { lvl: 9, label: 'plan_tasks', text: '결제 모듈 도입 작업 계획 세워줘', expect: 'plan_tasks', alt: ['plan_and_run'] },
  // ── L10: 다단계 오케스트레이션 ──
  { lvl: 10, label: 'plan_and_run', text: '주문 도메인 설계하고 이어서 스캐폴딩까지 진행해줘', expect: 'plan_and_run' },
];

const CASE_TIMEOUT_MS = 360_000; // 제품 상한(자유생성 300s)에 정렬 — 정상적으로 느린 생성을 오탐하지 않도록(기록만).
const oneLine = (s: string, n = 70): string => s.replace(/\s+/g, ' ').trim().slice(0, n);
const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | { __timeout: true }> =>
  Promise.race([p, new Promise<{ __timeout: true }>((r) => setTimeout(() => r({ __timeout: true }), ms))]);

async function main(): Promise<void> {
  const fixture = makeFixture();
  const repo = process.cwd();
  const pipe = await createPipeline();
  const info = pipe.info();

  console.log(`\n${'='.repeat(78)}`);
  console.log(`프로필=${info.profile}  chat=${info.chatModel}  embed=${info.embedModel}  baseURL=${info.baseURL}`);
  console.log(`케이스 ${CASES.length}개 · 복잡도 1~10 · 실제 스킬 실행(mutate 는 미리보기까지)`);
  console.log('='.repeat(78));

  interface Row extends Case { got: string; routeOk: boolean; execOk: boolean; ms: number; outLen: number; preview: string }
  const rows: Row[] = [];

  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i];
    const ws = c.ws === 'repo' ? repo : fixture;
    const chatId = `skilleval-${info.profile}-${i}`;
    pipe.reset({ workspace: ws, chatId }); // 세션 초기화 후 진행(TEST-CRITERIA §3) — 영속 세션 잔여 상태 누수 차단
    const t0 = Date.now();
    let got = '(error)';
    let execOk = false;
    let outLen = 0;
    let preview = '';
    try {
      const res = await withTimeout(pipe.handle(c.text, { workspace: ws, chatId }), CASE_TIMEOUT_MS);
      if ('__timeout' in res) {
        got = '(timeout)';
        preview = `>${CASE_TIMEOUT_MS / 1000}s`;
      } else {
        got = res.intent;
        outLen = (res.text ?? '').length;
        execOk = Boolean((res.text ?? '').trim());
        preview = oneLine(res.text ?? '');
      }
    } catch (e) {
      got = '(error)';
      preview = oneLine(e instanceof Error ? e.message : String(e));
    }
    const ms = Date.now() - t0;
    const routeOk = got === c.expect || (c.alt?.includes(got) ?? false);
    rows.push({ ...c, got, routeOk, execOk, ms, outLen, preview });
    const mark = execOk ? (routeOk ? '✅' : '🟡') : '❌'; // 🟡=실행됐지만 라우팅 다름
    console.log(
      `L${String(c.lvl).padStart(2)} ${mark} ${(ms / 1000).toFixed(1).padStart(6)}s  ${c.label.padEnd(28)} route[${got}]${routeOk ? '' : `≠${c.expect}`}  out=${outLen}\n        └ ${preview}`,
    );
  }

  // ── 요약 ──
  console.log(`\n${'-'.repeat(78)}`);
  console.log(`복잡도별 요약 (프로필 ${info.profile})`);
  const byLvl = new Map<number, Row[]>();
  for (const r of rows) (byLvl.get(r.lvl) ?? byLvl.set(r.lvl, []).get(r.lvl)!).push(r);
  for (const lvl of [...byLvl.keys()].sort((a, b) => a - b)) {
    const g = byLvl.get(lvl)!;
    const route = g.filter((r) => r.routeOk).length;
    const exec = g.filter((r) => r.execOk).length;
    const avg = (g.reduce((s, r) => s + r.ms, 0) / g.length / 1000).toFixed(1);
    console.log(`  L${String(lvl).padStart(2)}  라우팅 ${route}/${g.length}  실행 ${exec}/${g.length}  평균 ${avg}s`);
  }
  const route = rows.filter((r) => r.routeOk).length;
  const exec = rows.filter((r) => r.execOk).length;
  const total = (rows.reduce((s, r) => s + r.ms, 0) / 1000).toFixed(1);
  const avg = (rows.reduce((s, r) => s + r.ms, 0) / rows.length / 1000).toFixed(1);
  console.log('-'.repeat(78));
  console.log(`전체 [${info.profile}]: 라우팅 ${route}/${rows.length} (${((route / rows.length) * 100).toFixed(1)}%)  ·  실행성공 ${exec}/${rows.length} (${((exec / rows.length) * 100).toFixed(1)}%)  ·  총 ${total}s  평균 ${avg}s`);
  const bad = rows.filter((r) => !r.execOk || !r.routeOk);
  if (bad.length) {
    console.log('\n주의 케이스:');
    for (const r of bad) console.log(`  - L${r.lvl} ${r.label}: route=${r.got}(기대 ${r.expect}) exec=${r.execOk} — ${r.preview}`);
  }
  console.log('');
}

main().catch((err) => {
  console.error('평가 실패:', err instanceof Error ? err.message : String(err));
  console.error('힌트: Ollama(11434) 실행 + 활성 프로필 모델 로드 확인.');
  process.exit(2);
});
