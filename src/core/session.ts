// 멀티턴 세션 스토어. chatId 단위로 최근 프로젝트 컨텍스트 유지.
// 텔레그램은 chat.id, CLI 는 단일 기본 키를 쓴다. persistPath 를 주면 디스크에 영속화(재시작 복원).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { SessionState } from './types.js';

const DEFAULT_KEY = '__cli__';

/**
 * 여러 작업으로 나뉠 법한 "순차/나열 신호"가 있는지(값싼 1차 게이트).
 * 넓게 잡아 후보만 추리고, 실제 복합 여부는 LLM(isComplexRequest)이 확정한다.
 * "~하고 나서 / 그 다음 / 이어서 / ~한 뒤 / 후에 / ~까지" 등 이어쓰기 접속을 포괄.
 */
// 동작 동사 집합. 명사('문서'·'계획'·'커밋')는 제외 — "이 문서 분석해줘"·"커밋 메시지 만들어줘"가
// 2동사로 오탐돼 plan_and_run 으로 잘못 승격되던 것을 막는다("커밋하고 푸시"는 -고 연결어미가 잡는다).
const STEP_VERBS = /만들|생성|작성|설계|모델링|스캐폴|추가|구현|점검|검증|리뷰|리팩터|정리|삭제|조사|분석|배포하/g;
// 순차 구조 신호: 줄바꿈·종결부호 뒤 내용(문장 경계), 또는 순차 접속어/"-고" 연결어미.
// 쉼표(,) 단독은 제외 — "여행 계획 짜줘, 제주도"처럼 단일 요청의 부연에도 붙어 오탐이 잦았다.
const SEQ_CUE = /그리고|그\s?다음|그담|이어서|연이어|한\s?다음|하고\s*나서|한\s?뒤|후에|다음에|까지|[가-힣]고\s+\S/;

function twoDistinctVerbs(text: string): boolean {
  const verbs = text.match(STEP_VERBS);
  return !!verbs && new Set(verbs).size >= 2;
}
function hasSequentialCue(text: string): boolean {
  return /\n/.test(text) || /[.!?。]\s*\S/.test(text) || SEQ_CUE.test(text);
}

export function looksMultiStep(text: string): boolean {
  // 넓게 잡는 1차 게이트(실제 복합 여부는 LLM isComplexRequest 가 확정).
  // 순차 구조가 있거나(문장경계/접속어), 접속어 없이 서로 다른 동작 동사가 2개 이상이면 후보로.
  return hasSequentialCue(text) || twoDistinctVerbs(text);
}

/**
 * "강한" 복합 신호 — 서로 다른 동작 동사 2개 + 순차 구조(문장경계/순차 접속어/"-고" 연결)를 모두 만족.
 * 저사양 LLM(gemma)의 isComplexRequest 과소판정·분류 오분류를 결정론으로 구제해 LLM 게이트 없이 승격한다.
 * 동사 2개만으로는 승격하지 않는다 — "금액 검증 유틸 함수 추가해줘"처럼 한 명사구 안에 동사성 토큰이
 * 둘 있는 단일 작업의 오승격을 막고, 순차 구조가 없는 애매한 건 LLM 복합판정에 맡긴다.
 * (단일 동사 스캐폴드 "넥스트 만들어줘"도 여기 안 걸려 과승격되지 않는다.)
 */
export function strongMultiStep(text: string): boolean {
  return twoDistinctVerbs(text) && hasSequentialCue(text);
}

/**
 * 발화에 프레임워크가 명시됐는지 키워드로 탐지 (framework 슬롯 enum 과 동일 토큰).
 * 매칭 규칙(오탐 방지):
 *  - 라틴 키워드('next' 등)는 단어 경계(\b) — "context" 의 next, "nextjs" 의 next 오매칭 차단.
 *    ("nextjs"·"nestjs" 처럼 붙여 쓰는 흔한 표기는 별도 토큰으로 명시.)
 *  - 단음절 한글('웹')은 앞뒤가 다른 한글이 아닐 때만 — "웹소켓"·"웹훅" 의 '웹' 오매칭 차단, "웹 서버"는 인정.
 *  - 다음절 한글('프론트'·'모바일' 등)은 부분일치 유지 — "프론트엔드" 같은 자연 확장은 그대로 잡는다.
 */
export function detectFramework(text: string): string | undefined {
  const kw: Array<[string, string[]]> = [
    ['spring', ['스프링', 'spring']],
    ['nestjs', ['네스트', 'nestjs', 'nest']],
    ['django', ['장고', 'django', 'drf']],
    ['nextjs', ['넥스트', 'nextjs', 'next', '프론트', '웹']],
    ['flutter', ['플러터', 'flutter', '모바일']],
    ['tauri', ['타우리', 'tauri', '데스크탑']],
  ];
  const lower = text.toLowerCase();
  const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = (w: string): boolean => {
    if (/^[가-힣]$/.test(w)) return new RegExp(`(?<![가-힣])${esc(w)}(?![가-힣])`).test(text); // 단음절 한글: 경계
    if (/[가-힣]/.test(w)) return lower.includes(w); // 다음절 한글: 부분일치
    return new RegExp(`\\b${esc(w)}\\b`, 'i').test(lower); // 라틴: 단어 경계
  };
  for (const [fw, words] of kw) if (words.some(matches)) return fw;
  return undefined;
}

// 확인 게이트(pending*/awaiting*)에서만 호출된다 — 이미 예/아니오를 물은 맥락이라 넉넉히 인식한다.
// 짧은 감탄사(응·네·어…)는 오탐 방지를 위해 전체 문장 매칭, 뜻이 분명한 어휘 신호(진행·그대로…)는
// "그대로 진행"·"네 진행할게요"처럼 문장 어디에 있어도 인정한다.
const NEGATE_CUE = /(아니|아뇨|아녜|취소|그만|중단|멈춰|관둬|됐어|하지\s?마|안\s?[해돼되할함가]|필요\s?없|싫|\bno(pe)?\b)/i;
const AFFIRM_WHOLE = /^\s*(응+|네+|넵|예+|엉|어+|ㅇ+|yes|y|ok(ay)?|오케이?|오키|콜|고|고고|ㄱ+)\s*$/i;
// 문장 앞에 온 명확한 긍정 + 뒤 내용("응 근데 …", "네 진행할게요"). 뒤에 구분자가 와야 하며(어절 경계),
// "네이버"·"예약" 처럼 뒤가 붙는 한글 합성어는 배제한다.
const AFFIRM_LEAD = /^\s*(응+|네+|넵|예+|yes|ok(ay)?|오케이?|오키|콜)(?=[\s,.!?]|$)/i;
const AFFIRM_CUE = /(맞아|그래|그럼|그대로|이대로|좋아|좋습|진행|실행|시작|가자|해\s?줘|해주세요|부탁)/;
// 질문·가정 맥락 신호. 어휘 긍정 큐(진행/실행/시작…)가 이런 맥락에 섞이면 승인으로 보지 않는다.
// 승인 게이트는 파일쓰기·명령실행 직전의 안전 경계라, 되묻는 발화("실행하면 뭐가 바뀌어?", "진행할까요?")를
// 긍정으로 오인해 부작용을 커밋하면 안 된다. (문두 명시 긍정 "응/네…"는 물음표가 붙어도 아래에서 먼저 인정.)
const AFFIRM_QUESTION = /[?？]|하면|한다면|할까|하나요?|하는지|하는\s?게|해도\s?(되|돼|괜찮)/;

/** 되묻기 응답: 긍정 (부정/질문 신호가 섞였으면 긍정 아님 — "진행하지 마", "실행하면 어떻게 돼?") */
export function isAffirmative(text: string): boolean {
  const t = text.trim();
  if (!t || NEGATE_CUE.test(t)) return false;
  // 문두 명시 긍정("응", "네 진행할게요")은 질문부호가 붙어도 인정.
  if (AFFIRM_WHOLE.test(t) || AFFIRM_LEAD.test(t)) return true;
  // 어휘 긍정 큐는 질문·가정 맥락이 아닐 때만 승인으로 본다.
  if (AFFIRM_QUESTION.test(t)) return false;
  return AFFIRM_CUE.test(t);
}

/** 되묻기 응답: 부정 */
export function isNegative(text: string): boolean {
  return NEGATE_CUE.test(text.trim());
}

/** 상주 서버에서 chatId 마다 영구 엔트리가 쌓이지 않도록 하는 세션 상한(LRU 제거). */
const MAX_SESSIONS = 500;

export class SessionStore {
  // Map 은 삽입 순서를 보존한다 → 가장 오래 안 쓰인(맨 앞) 키를 LRU 로 제거.
  private map = new Map<string, SessionState>();

  constructor(
    private max = MAX_SESSIONS,
    /** 주면 이 경로(JSON)에 세션을 영속화하고, 생성 시 복원한다. */
    private persistPath?: string,
  ) {
    if (persistPath) this.load();
  }

  /** 디스크에서 세션 복원(손상·부재면 조용히 빈 상태). 상한 내로만 로드. */
  private load(): void {
    if (!this.persistPath || !existsSync(this.persistPath)) return;
    try {
      const obj = JSON.parse(readFileSync(this.persistPath, 'utf8')) as Record<string, SessionState>;
      this.map = new Map(Object.entries(obj).slice(-this.max));
    } catch {
      /* 손상 → 빈 상태로 시작 */
    }
  }

  /** 현재 세션 맵을 디스크에 저장(best-effort). persistPath 없으면 무시. 매 턴 호출해도 저렴. */
  persist(): void {
    if (!this.persistPath) return;
    try {
      mkdirSync(dirname(this.persistPath), { recursive: true });
      writeFileSync(this.persistPath, JSON.stringify(Object.fromEntries(this.map)));
    } catch {
      /* best-effort: 저장 실패해도 인메모리 동작엔 지장 없음 */
    }
  }

  /** key = chatId(텔레그램) 또는 workspace 경로(CLI). 같은 디렉토리 = 같은 세션. */
  get(key = DEFAULT_KEY): SessionState {
    const existing = this.map.get(key);
    if (existing) {
      // 최근 사용으로 갱신: 삭제 후 재삽입해 Map 순서의 맨 뒤로 보낸다.
      this.map.delete(key);
      this.map.set(key, existing);
      return existing;
    }
    const s: SessionState = {};
    this.map.set(key, s);
    // 상한 초과 시 가장 오래된 세션부터 제거(무한 증가 방지).
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
    return s;
  }

  /** 세션 상태 초기화 — 다음 get()은 빈 세션을 새로 만든다. (/reset) */
  clear(key = DEFAULT_KEY): void {
    this.map.delete(key);
  }

  /** 현재 보관 중인 세션 수 (테스트·진단용). */
  get size(): number {
    return this.map.size;
  }
}
