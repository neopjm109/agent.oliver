// 흔한 인사/잡담 응대 코드 스킬.
//  · 소울(페르소나) 활성 → 인사·잡담 전부 LLM 페르소나 목소리(성격이 가장 잘 드러나는 지점).
//  · 소울 없음(기본) → 하이브리드: 단순 인사·감사·작별은 즉답 테이블(빠름, LLM 0),
//    '누구야/뭐해/잘지내'처럼 성격이 드러나는 것만 LLM으로 자연스럽게(warmChitchat).
//    LLM 실패/미가용/off 면 해당 항목의 테이블 답으로 폴백.
//  · 테이블에 안 걸리는 잡담은 unknown→fallback(LLM) 이 받는다.
import type { Context, Skill, SkillResult } from '../core/types.js';
import type { LLMClient } from '../core/llmClient.js';
import { withTimeout } from '../core/text.js';

/** warm(정체·안부) LLM 응대 상한 — 초과하면 테이블 답으로 폴백(빠른 경로 보호). */
const WARM_TIMEOUT_MS = 8_000;

interface Entry { words: string[]; replies: string[]; warm?: boolean }

/** 배열에서 하나를 무작위로 고른다(즉답 문구가 매번 달라져 덜 로봇적). */
function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)] ?? arr[0];
}

export class ChitchatReply implements Skill {
  readonly name = 'chitchat';
  constructor(
    private llm: LLMClient,
    private capabilities: string,
    private warm = true,
  ) {}

  private table(): Entry[] {
    return [
      // 즉답(빠름) — 단순 인사·감사·작별. 카테고리마다 변형을 두고 매번 랜덤 선택.
      { words: ['안녕', '하이', 'ㅎㅇ', '반가', '헬로', 'hello', 'hi'], replies: [
        '안녕하세요! 무엇을 도와드릴까요? (예: "코드 리뷰 해줘", "상태 확인")',
        '안녕하세요 🙂 오늘은 무엇을 도와드릴까요? (예: "이 문서 요약해줘", "커밋 메시지 써줘")',
        '반가워요! 필요한 걸 말씀해 주세요. (예: "회의록 정리해줘", "영어로 번역해줘")',
        '안녕하세요! 개발부터 문서 작업까지 도와드려요. 무엇부터 해볼까요?',
      ] },
      { words: ['고마', '감사', '땡큐', 'thank'], replies: [
        '천만에요! 더 필요한 게 있으면 말씀해 주세요.',
        '도움이 됐다니 다행이에요 🙂 또 필요하면 불러주세요.',
        '별말씀을요! 언제든 도와드릴게요.',
        '네, 언제든지요! 더 도와드릴 게 있을까요?',
      ] },
      { words: ['잘 있어', '안녕히', '바이', 'bye', '수고'], replies: [
        '네, 언제든 다시 불러주세요! 👋',
        '오늘도 수고하셨어요. 또 뵈어요! 👋',
        '안녕히 가세요, 필요하면 언제든 찾아주세요 🙂',
        '좋은 하루 되세요! 👋',
      ] },
      // LLM warm — 성격/정체가 드러나는 지점 (지연 덜 민감). replies 는 LLM 실패 시 폴백.
      { words: ['누구', '뭐야', '정체', '뭐 할', '뭐할', '뭘 할', '뭘할', '무엇을 할', '무슨 기능', '기능 알려', 'who are you'], warm: true, replies: [
        `저는 로컬 LLM으로 동작하는 경량 에이전트예요. ${this.capabilities}`,
      ] },
      { words: ['잘 지내', '어떻게 지내', '기분', 'how are you'], warm: true, replies: [
        '저는 늘 잘 돌아가고 있어요 🙂 무엇을 도와드릴까요?',
        '덕분에 잘 지내요 😊 무엇을 도와드릴까요?',
      ] },
    ];
  }

  /** 최근 대화 맥락 문자열(멀티턴에서 자연스러운 응대). */
  private historyBlock(ctx: Context): string {
    return ctx.history.length
      ? '[최근 대화]\n' + ctx.history.map((h) => `사용자: ${h.user}\n어시스턴트: ${h.assistant}`).join('\n') + '\n\n'
      : '';
  }

  async run(ctx: Context): Promise<SkillResult> {
    const t = ctx.userText;

    // 소울 활성 → 페르소나 목소리로 짧게 응대 (인사/잡담은 성격이 가장 잘 드러나는 지점)
    if (ctx.soul) {
      const system =
        ctx.soul +
        '\n\n너는 위 인격으로 대화한다. 인사·감사·잡담·정체 질문엔 1~2문장으로 짧고 자연스럽게 답한다. ' +
        '없는 기능을 지어내지 않는다.\n' +
        `할 수 있는 일: ${this.capabilities}`;
      try {
        const text = await this.llm.chatText(system, this.historyBlock(ctx) + `사용자: ${t}`);
        if (text.trim()) return { ok: true, text: text.trim(), data: { soul: ctx.soulName } };
      } catch {
        // LLM 실패 시 아래 테이블로 폴백
      }
    }

    const hit = this.table().find((e) => e.words.some((w) => t.includes(w)));

    // 하이브리드: warm 항목이면 LLM으로 자연스럽게(정체/안부). 실패·off·미가용 시 테이블 답으로 폴백.
    if (hit?.warm && this.warm && !ctx.soul) {
      const system =
        '너는 로컬 LLM으로 동작하는 경량 에이전트다. 사용자의 가벼운 인사·잡담(정체·안부 등)에 ' +
        '1~2문장으로 짧고 친근하게, 사람 같은 말투로 답한다. 없는 기능은 지어내지 않는다. 이모지는 최대 1개.\n' +
        `할 수 있는 일: ${this.capabilities}`;
      try {
        const text = (await withTimeout(this.llm.chatText(system, this.historyBlock(ctx) + `사용자: ${t}`), WARM_TIMEOUT_MS)).trim();
        if (text) return { ok: true, text, data: { matched: true, warm: true } };
      } catch {
        // 폴백: 아래 테이블 답
      }
    }

    return {
      ok: true,
      text: hit ? pick(hit.replies) : '네, 말씀하세요! 무엇을 도와드릴까요?',
      data: { matched: Boolean(hit) },
    };
  }
}
