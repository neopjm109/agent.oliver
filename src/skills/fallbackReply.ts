// unknown intent(라우터 threshold 미달) 처리 — LLM 대화형 응답.
// 인사·잡담이면 짧게 받아주고, 범위 밖 요청이면 할 수 있는 일로 안내한다.
import type { Context, Skill, SkillResult } from '../core/types.js';
import type { LLMClient } from '../core/llmClient.js';

export class FallbackReply implements Skill {
  readonly name = 'fallback_reply';
  constructor(
    private llm: LLMClient,
    private capabilities: string,
  ) {}

  async run(ctx: Context): Promise<SkillResult> {
    // 소울(페르소나)이 활성이면 그 인격을, 아니면 기본 어시스턴트 정체성을 시스템 프롬프트로.
    const identity = ctx.soul
      ? ctx.soul + '\n\n너는 위 인격으로 대화하는 로컬 LLM 어시스턴트다.'
      : '너는 로컬 LLM으로 동작하는 친절한 한국어 어시스턴트다.';
    const system =
      identity + ' 규칙:\n' +
      '- 사용자 발화가 인사·잡담이면 짧고 자연스럽게(1~2문장) 답한다.\n' +
      '- 무언가 요청인데 네가 못 하는 것이면, 장황한 사과 대신 네가 할 수 있는 것을 간단히 안내한다.\n' +
      '- 날씨·주가·환율·뉴스·현재 시각 등 실시간/최신 정보는 알 수 없다. 아는 척 지어내지 말고 ' +
      '"실시간 정보는 제공할 수 없다"고 솔직히 알린다.\n' +
      '- 없는 기능을 있다고 지어내지 않는다. 길게 말하지 않는다.\n' +
      `할 수 있는 일: ${this.capabilities}`;
    const hist = ctx.history.length
      ? '[최근 대화]\n' + ctx.history.map((t) => `사용자: ${t.user}\n어시스턴트: ${t.assistant}`).join('\n') + '\n\n'
      : '';
    try {
      const prompt = hist + `사용자: ${ctx.userText}`;
      const text = ctx.onToken
        ? await this.llm.chatTextStream(system, prompt, ctx.onToken)
        : await this.llm.chatText(system, prompt);
      return { ok: true, text: text.trim() || '무엇을 도와드릴까요?' };
    } catch {
      // LLM 불가 시 안전한 기본 응답
      return { ok: true, text: '요청을 정확히 이해하지 못했어요. 조금 더 구체적으로 말씀해 주세요.' };
    }
  }
}
