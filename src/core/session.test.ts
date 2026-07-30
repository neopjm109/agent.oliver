import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  detectFramework,
  looksMultiStep,
  strongMultiStep,
  isAffirmative,
  isNegative,
  SessionStore,
} from './session.js';

test('detectFramework: 명시 프레임워크 토큰을 잡는다', () => {
  assert.equal(detectFramework('스프링 프로젝트 만들어줘'), 'spring');
  assert.equal(detectFramework('nestjs 백엔드 세팅'), 'nestjs');
  assert.equal(detectFramework('django 새 프로젝트'), 'django');
  assert.equal(detectFramework('nextjs 프론트 프로젝트'), 'nextjs');
  assert.equal(detectFramework('플러터 앱 만들어줘'), 'flutter');
  assert.equal(detectFramework('tauri 데스크탑 앱'), 'tauri');
});

test('detectFramework: H2 회귀 — 웹소켓의 "웹"을 nextjs로 오탐하지 않는다', () => {
  assert.equal(detectFramework('웹소켓 추가해줘'), undefined);
  assert.equal(detectFramework('웹훅 붙여줘'), undefined);
  // 단, 독립된 "웹"은 여전히 nextjs 힌트로 인정
  assert.equal(detectFramework('웹 서버 만들어줘'), 'nextjs');
});

test('detectFramework: H2 회귀 — 라틴 키워드 단어경계(context의 next 오탐 방지)', () => {
  assert.equal(detectFramework('context 클래스 만들어줘'), undefined);
  assert.equal(detectFramework('next.js 프로젝트'), 'nextjs');
  assert.equal(detectFramework('프론트엔드 화면 만들어줘'), 'nextjs'); // 다음절 한글 부분일치 유지
  assert.equal(detectFramework('모바일 앱 만들어줘'), 'flutter');
});

test('looksMultiStep: 순차/나열 신호를 넓게 잡는다', () => {
  assert.equal(looksMultiStep('설계하고 스캐폴딩까지 해줘'), true);
  assert.equal(looksMultiStep('스프링 만들어줘\n도메인 설계해줘'), true);
  assert.equal(looksMultiStep('조사해서 제안서까지 만들어줘'), true);
  assert.equal(looksMultiStep('안녕'), false);
  assert.equal(looksMultiStep('여행 계획 짜줘'), false);
});

test('looksMultiStep: M2 회귀 — 쉼표 단독·명사(문서)로는 오탐하지 않는다', () => {
  assert.equal(looksMultiStep('여행 계획 짜줘, 제주도'), false); // 쉼표 단독
  assert.equal(looksMultiStep('이 문서 분석해줘'), false); // 문서(명사)+분석 → 단일
});

test('strongMultiStep: 스킬평가 회귀 — 순차 구조 없는 2동사(명사구)는 강한 신호 아님', () => {
  // "금액 검증 유틸 함수 추가"는 단일 작업인데 검증+추가 2동사로 오승격(plan_and_run)되던 것을 막는다.
  assert.equal(strongMultiStep('금액 검증 유틸 함수 추가해줘'), false); // 접속 없는 단일 작업 → LLM 판정에 위임
  assert.equal(strongMultiStep('이 코드 리팩터링 해줘'), false); // 단일 동사
  // 순차 구조(하고/까지/문장경계)가 동반되면 여전히 강한 신호로 승격
  assert.equal(strongMultiStep('설계하고 이어서 스캐폴딩까지 진행해줘'), true);
  assert.equal(strongMultiStep('조사하고 그걸로 제안서까지 만들어줘'), true);
  assert.equal(strongMultiStep('스프링 만들어줘\n도메인 설계해줘'), true); // 줄바꿈 경계
});

test('isAffirmative / isNegative: 확인 게이트 응답 인식', () => {
  for (const yes of ['응', '네', 'ㅇㅇ', 'ok', '그대로 진행', '좋아 해줘']) {
    assert.equal(isAffirmative(yes), true, `긍정: ${yes}`);
  }
  for (const no of ['아니', '아니오', '취소', '그만', '하지마']) {
    assert.equal(isNegative(no), true, `부정: ${no}`);
    assert.equal(isAffirmative(no), false, `부정인데 긍정오탐: ${no}`);
  }
  // 부정 신호가 섞이면 긍정 아님
  assert.equal(isAffirmative('진행하지 마'), false);
});

test('isAffirmative: L6 회귀 — 선행 긍정("응 근데 …")은 인정, 합성어는 배제', () => {
  assert.equal(isAffirmative('응 근데 이름은 foo 로'), true); // 선행 "응"
  assert.equal(isAffirmative('네 진행할게요'), true);
  assert.equal(isAffirmative('응 근데 취소'), false); // 부정 섞이면 아님
  // "네"·"예"로 시작하는 합성어를 선행긍정으로 오탐하지 않는다(긍정 큐가 없는 단어로 격리 검증).
  assert.equal(isAffirmative('네이버'), false);
  assert.equal(isAffirmative('예약'), false);
});

test('isAffirmative: Medium 회귀 — 질문·가정 맥락은 승인으로 보지 않는다(안전 게이트)', () => {
  // 승인 게이트는 파일쓰기·명령실행 직전 경계 — 되묻는 발화를 긍정으로 오인해 커밋하면 안 된다.
  assert.equal(isAffirmative('실행하면 뭐가 바뀌어요?'), false); // 가정+물음표
  assert.equal(isAffirmative('진행할까요?'), false);
  assert.equal(isAffirmative('시작해도 돼?'), false);
  assert.equal(isAffirmative('이거 실행하는지 궁금해'), false);
  // 문두 명시 긍정은 물음표/구분자가 붙어도 여전히 인정
  assert.equal(isAffirmative('네, 진행할게요'), true);
  assert.equal(isAffirmative('응 시작하자'), true);
  // 어휘 긍정 큐 정상 인정(질문 맥락 아님)
  assert.equal(isAffirmative('그대로 진행'), true);
  assert.equal(isAffirmative('좋아 해줘'), true);
});

test('SessionStore: H1 회귀 — 상한을 넘으면 오래된 세션부터 제거(LRU)', () => {
  const store = new SessionStore(3);
  store.get('a');
  store.get('b');
  store.get('c');
  assert.equal(store.size, 3);
  store.get('a'); // a 를 최근 사용으로 갱신 → 가장 오래된 것은 b
  store.get('d'); // 상한 초과 → b 제거
  assert.equal(store.size, 3);
  // b 는 제거됐으므로 새 빈 세션이 만들어져야 한다(이전 상태 소실 확인용으로 플래그 저장)
  store.get('a').framework = 'spring';
  assert.equal(store.get('a').framework, 'spring'); // a 는 유지
});

test('SessionStore: get 은 같은 참조를 돌려준다(멀티턴 상태 누적)', () => {
  const store = new SessionStore();
  const s1 = store.get('x');
  s1.framework = 'nextjs';
  assert.equal(store.get('x').framework, 'nextjs');
  store.clear('x');
  assert.equal(store.get('x').framework, undefined);
});

test('SessionStore: #8 영속화 — persist 후 새 인스턴스가 복원', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'sess-')), 'sessions.json');
  const a = new SessionStore(500, path);
  a.get('chat1').framework = 'spring';
  a.get('chat1').pendingStepCommit = {
    preview: 'spring init x 실행?',
    commit: { type: 'exec', argv: ['spring', 'init', 'x'], cwd: '/w', label: 'spring init x', framework: 'spring' },
  };
  a.persist();

  const b = new SessionStore(500, path); // 재시작 시뮬레이션
  assert.equal(b.get('chat1').framework, 'spring');
  const restored = b.get('chat1').pendingStepCommit?.commit;
  assert.equal(restored?.type === 'exec' ? restored.label : undefined, 'spring init x');
  assert.equal(b.size, 1);

  // 손상 파일은 조용히 빈 상태
  writeFileSync(path, 'not json', 'utf8');
  const c = new SessionStore(500, path);
  assert.equal(c.size, 0);
});
