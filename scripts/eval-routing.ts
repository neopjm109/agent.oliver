// 라우팅 골든셋 평가 — 대표 발화 → 기대 intent 정확도를 라이브로 측정한다.
// 실행: npm run eval:routing   (Ollama 가 떠 있고 활성 프로필 모델이 로드돼 있어야 함)
//
// handle(..., { decideOnly:true }) 로 "라우팅 결정만" 재고 스킬은 실행하지 않는다(빠름).
// 케이스마다 고유 chatId 로 세션을 격리한다. 결과가 임계치 미만이면 종료코드 1(회귀 감시용).
import 'dotenv/config';
import { createPipeline } from '../src/pipeline.js';

interface Case {
  text: string;
  expect: string;
  /** 대체 허용 intent(모호 경계에서 이것도 정답 처리). */
  alt?: string[];
  note?: string;
}

// 17 intent(v3) + 회귀(H2 웹소켓, M1 스캐폴드 이름) + OOS. add_capability→change_code,
// check_quality→review_code 흡수, 콘텐츠(식단·여행·음악) 제거를 반영.
const CASES: Case[] = [
  { text: '상태 확인', expect: 'agent_status' },
  { text: '안녕하세요', expect: 'chitchat' },
  { text: '너는 뭘 할 수 있어?', expect: 'capabilities', note: '결정론 인터셉트: 능력질문(explain_code 오분류 방지)' },
  { text: '무슨 기능 있어?', expect: 'capabilities' },
  { text: '기능 알려줘', expect: 'capabilities' },
  { text: '도움말', expect: 'capabilities' },
  { text: '스프링 프로젝트 shopmall 만들어줘', expect: 'scaffold_project' },
  { text: 'nextjs 프론트 프로젝트 생성', expect: 'scaffold_project' },
  { text: '여기 웹소켓 추가해줘', expect: 'change_code', note: 'H2 회귀: 웹소켓→nextjs 오검출 금지 + add_capability 흡수' },
  { text: '캐시 추가해줘', expect: 'change_code' },
  { text: '이 코드 리팩터링 해줘', expect: 'change_code' },
  { text: '이 코드 전반적으로 리뷰해줘', expect: 'review_code' },
  { text: 'src/foo.ts 단위 테스트 짜줘', expect: 'write_tests' },
  { text: '이 함수 유닛 테스트 만들어줘', expect: 'write_tests', alt: ['change_code'] },
  { text: '테스트 돌려줘', expect: 'run_command' },
  { text: '빌드 되는지 실행해봐', expect: 'run_command' },
  { text: '타입체크 돌려줘', expect: 'run_command' },
  { text: '이 함수 뭐 하는거야 설명해줘', expect: 'explain_code', alt: ['review_code'] },
  { text: '회의 일정 변경 메일 초안 써줘', expect: 'write_message' },
  { text: '이 회의 메모 회의록으로 정리하고 할 일 뽑아줘', expect: 'meeting_minutes', alt: ['analyze_document'] },
  { text: '이 API 보안 취약점 검사해줘', expect: 'review_code', note: 'check_quality 흡수' },
  { text: '주문 도메인 아키텍처 설계해줘', expect: 'design_system' },
  { text: 'DB 테이블 설계해줘', expect: 'design_system' },
  { text: '이 pdf 분석해줘', expect: 'analyze_document' },
  { text: '이 마크다운 워드로 변환해줘', expect: 'convert_document' },
  { text: 'pdf 를 마크다운으로 바꿔줘', expect: 'convert_document' },
  { text: '샘플 양식에 맞춰서 이 문서 변환해줘', expect: 'convert_document', alt: ['analyze_document'] },
  { text: '이 문서 영어로 번역해줘', expect: 'translate' },
  { text: '이 README 국문으로 번역', expect: 'translate' },
  { text: 'translate this document to English', expect: 'translate' },
  { text: 'README 작성해줘', expect: 'write_docs' },
  { text: '커밋 메시지 만들어줘', expect: 'git_artifact' },
  { text: 'PR 설명 작성해줘', expect: 'git_artifact' },
  { text: '이 프로젝트 배포하고 싶어', expect: 'setup_deployment' },
  { text: 'REST랑 GraphQL 차이 정리해줘', expect: 'research_topic' },
  { text: '이 작업 할 일 목록 만들어줘', expect: 'plan_tasks', alt: ['plan_and_run'] },
  { text: '설계하고 이어서 스캐폴딩까지 진행해줘', expect: 'plan_and_run' },
  { text: '판타지 단편 소설 써줘', expect: 'write_story' },
  { text: 'TRPG 던전 세션 만들어줘', expect: 'run_game_session' },
  { text: '사업 제안서 작성해줘', expect: 'write_proposal' },
  { text: '오늘 서울 날씨 어때?', expect: 'unknown', note: 'OOS/실시간 → fallback' },

  // ── 확장: 인접 인텐트·경로 변형·example-only 신호·OOS 다양화 ──
  { text: '스프링에 인증 붙여줘', expect: 'change_code', note: 'add_capability 흡수' },
  { text: '이 프로젝트에 알림 기능 넣어줘', expect: 'change_code', note: 'example-only 신호(알림)' },
  { text: '파일 업로드 기능 추가해줘', expect: 'change_code', note: 'example-only 신호' },
  { text: '스케줄러 넣어줘', expect: 'change_code' },
  { text: 'src/discount.ts 에 입력값 음수 검증을 추가해줘', expect: 'change_code', note: 'F1: 경로지정 편집 과승격 금지(검증+추가 2동사)' },
  { text: 'src/foo.ts 리팩터링하고 정리해줘', expect: 'change_code', note: 'F1: 경로지정 편집은 원자적 → plan 승격 안 함' },
  { text: 'src/auth.ts 리뷰해줘', expect: 'review_code', note: '경로 지정 리뷰' },
  { text: '이 함수 성능 병목 있는지 봐줘', expect: 'review_code', note: 'check_quality 흡수' },
  { text: 'SQL 인젝션 위험 있는지 확인해줘', expect: 'review_code' },
  { text: '의존성 취약점 확인해줘', expect: 'review_code' },
  { text: 'postgres 스키마 설계해줘', expect: 'design_system' },
  { text: '엔티티 관계 모델링 해줘', expect: 'design_system' },
  { text: 'report.pdf 분석해줘', expect: 'analyze_document', note: 'pdf 경로' },
  { text: 'sales.xlsx 정리해줘', expect: 'analyze_document', note: 'xlsx 경로' },
  { text: 'ADR 써줘', expect: 'write_docs' },
  { text: '릴리즈 노트 작성해줘', expect: 'write_docs', alt: ['git_artifact'] },
  { text: '체인지로그 써줘', expect: 'git_artifact', alt: ['write_docs'] },
  { text: '배포용 빌드 스크립트 만들어줘', expect: 'setup_deployment' },
  { text: '프로덕션 빌드 명령 알려줘', expect: 'setup_deployment', alt: ['research_topic'] },
  { text: '마이크로서비스가 뭔지 쉽게 설명해줘', expect: 'research_topic' },
  { text: '이 요구사항 작업 계획 짜줘', expect: 'plan_tasks', alt: ['plan_and_run'] },
  { text: '조사하고 그걸로 제안서까지 만들어줘', expect: 'plan_and_run' },
  { text: 'RFP 분석하고 제안서 써줘', expect: 'write_proposal', alt: ['plan_and_run'] },
  { text: '연극 대본 하나 써줘', expect: 'write_story' },
  { text: '지금 몇 시야?', expect: 'unknown', note: 'OOS/실시간' },
  { text: '비트코인 시세 알려줘', expect: 'unknown', note: 'OOS/실시간' },
  { text: '고마워', expect: 'chitchat' },
  { text: '헬스체크', expect: 'agent_status' },
];

const THRESHOLD = 0.8; // 이 미만이면 종료코드 1

async function main(): Promise<void> {
  const pipe = await createPipeline();
  const info = pipe.info();
  console.log(`profile=${info.profile} chat=${info.chatModel} embed=${info.embedModel} · 케이스 ${CASES.length}개\n`);

  let pass = 0;
  const fails: Array<{ text: string; expect: string; got: string }> = [];
  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i];
    let got = '(error)';
    try {
      const res = await pipe.handle(c.text, { chatId: `eval-${i}`, decideOnly: true }); // 라우팅만, 세션 격리
      got = res.intent;
    } catch (e) {
      got = `(error: ${e instanceof Error ? e.message : String(e)})`;
    }
    const ok = got === c.expect || (c.alt?.includes(got) ?? false);
    if (ok) pass++;
    else fails.push({ text: c.text, expect: c.expect, got });
    const mark = ok ? '✅' : '❌';
    console.log(`${mark} [${got}] ← "${c.text}"${ok ? '' : `  (기대: ${c.expect})`}`);
  }

  const acc = pass / CASES.length;
  console.log(`\n정확도: ${pass}/${CASES.length} = ${(acc * 100).toFixed(1)}%`);
  if (fails.length) {
    console.log('\n오분류:');
    for (const f of fails) console.log(`  - "${f.text}"  기대=${f.expect}  실제=${f.got}`);
  }
  process.exit(acc >= THRESHOLD ? 0 : 1);
}

main().catch((err) => {
  console.error('평가 실행 실패:', err instanceof Error ? err.message : String(err));
  console.error('힌트: Ollama(11434) 실행 + 활성 프로필 모델 로드 확인.');
  process.exit(2);
});
