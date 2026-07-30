// 결과물 파일·폴더 이름 짓기 (스킬기반 업무 보조).
// 원칙: 모델이 쓴 제목 문장을 통째로 슬러그화하지 않는다("주문-도메인-아키텍처-설계-문서.md" 금지).
//   - 단일 파일: 문서 종류의 "관용 표준명"(README.md·CHANGELOG.md·설계서.md·제안서.md …).
//   - 여러 단계 결과 폴더: 요청에서 뽑은 "짧은 주제"(문장 전체가 아니라 핵심 명사 1~2개).

/** 파일/폴더명에 위험한 문자(경로 구분·제어문자)만 제거. 공백·하이픈·한글·영숫자는 보존. */
function sanitize(s: string): string {
  return s
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/[\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 창작물(이야기)은 제목이 곧 좋은 파일명 — 첫 줄 제목을 뽑아 정리. 없으면 '이야기'. */
function storyFileName(text?: string): string {
  const first = (text ?? '').split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  const title = sanitize(first.replace(/^#+\s*/, '').replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')).slice(0, 30).trim();
  return `${title || '이야기'}.md`;
}

/**
 * intent(+슬롯)로 결과물의 표준 파일명(확장자 포함)을 정한다.
 * 종류가 명확하면 관용명, 아니면 종류별 기본명. (write_story 만 제목을 파일명으로 씀)
 */
export function resultFileName(intent: string, slots: Record<string, string> = {}, text?: string): string {
  switch (intent) {
    case 'write_docs':
      return (
        { readme: 'README.md', 'api-guide': 'API-가이드.md', 'release-notes': 'RELEASE-NOTES.md', adr: 'ADR.md' }[slots.doc_type ?? ''] ??
        '문서.md'
      );
    case 'git_artifact':
      return { commit: 'COMMIT_MESSAGE.txt', pr: 'PULL-REQUEST.md', changelog: 'CHANGELOG.md' }[slots.kind ?? ''] ?? 'git-메시지.md';
    case 'design_system':
      return '설계서.md';
    case 'write_proposal':
      return '제안서.md';
    case 'research_topic':
      return '조사노트.md';
    case 'run_game_session':
      return '게임세션.md';
    case 'meeting_minutes':
      return '회의록.md';
    case 'write_story':
      return storyFileName(text);
    default:
      return '결과.md';
  }
}

// 짧은 주제 추출에서 걸러낼 동작 동사·불용어(핵심 명사만 남기기 위함).
const TOPIC_DROP = new Set([
  '설계', '설계해줘', '만들어줘', '만들어', '만들', '생성', '생성해줘', '작성', '작성해줘', '구현', '구현해줘',
  '문서', '해줘', '해', '하고', '그걸로', '그거로', '이어서', '까지', '그리고', '그다음', '및', '좀', '코드', '추가',
  '리뷰', '점검', '분석', '정리', '조사', '비교', '차이', '써줘', '만들자', 'readme',
]);

/** 흔한 조사·연결어미(끝에 붙는 것) — 폴더명에서 떼어낸다. 리스트접속 '랑/이랑/과/와/하고' 포함. */
const JOSA = /(?:이?랑|으로|에서|에게|까지|부터|과|와|하고|을|를|은|는|이|가|로|에|의|도|만)$/u;

/**
 * 요청/목표에서 폴더명용 짧은 주제를 뽑는다 — 동작 동사·불용어·조사를 빼고 앞 핵심 명사 1~2개.
 * 예: "주문 도메인 아키텍처 설계하고 그걸로 README 문서까지 써줘" → "주문도메인",
 *     "REST랑 GraphQL 비교 조사해줘" → "RESTGraphQL".
 */
export function shortTopic(goal: string): string {
  const tokens = goal.trim().split(/\s+/);
  const kept = tokens.filter((t) => {
    const s = t.toLowerCase().replace(JOSA, '');
    return s.length > 0 && !TOPIC_DROP.has(t) && !TOPIC_DROP.has(s);
  });
  const cleaned = (kept.length ? kept : tokens).map((t) => t.replace(JOSA, '') || t);
  const topic = sanitize(cleaned.slice(0, 2).join('')).replace(/[^\w가-힣]/g, '').slice(0, 16);
  return topic || 'result';
}
