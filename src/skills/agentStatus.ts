// 상태 점검 — 결정론 사실 블록(외부/LLM 의존 0)만 유지한다. status 는 인프라 조회라 LLM 라우터를
// 거치지 않고, 파이프라인의 결정론 인터셉트(/status 명령 + 명시적 상태 질문)가 이 블록을 바로 낸다.
// (구 agent_status NL intent·warm 인사 스킬은 폐지 — chitchat↔status 임베딩 모호성 제거.)

export interface StatusInfo {
  intents: number;
  skills: number;
  profile: string;
  chatModel: string;
  embedModel: string;
  startedAt: number; // epoch ms
}

/** 결정론 사실 블록 — 상태의 단일 진실원. /status 명령과 명시적 상태 질문 인터셉트가 공유한다. */
export function statusFactsBlock(i: StatusInfo): string {
  const upMin = Math.floor((Date.now() - i.startedAt) / 60000);
  const uptime = upMin >= 60 ? `${Math.floor(upMin / 60)}h ${upMin % 60}m` : `${upMin}m`;
  return (
    '✅ 정상 작동 중\n' +
    `· 인텐트 ${i.intents} · 스킬 ${i.skills}\n` +
    `· 프로파일 ${i.profile} (${i.chatModel} · ${i.embedModel})\n` +
    `· 가동 ${uptime}`
  );
}
