// 마크다운 스킬 실행기 — skills/**/SKILL.md 본문을 시스템 프롬프트로 삼아 LLM 1회 실행.
// 스킬을 코드로 재구현하지 않고 프롬프트를 그대로 구동한다. (순수 텍스트 in/out)
import { readFileSync } from 'node:fs';
import type { Context, Skill, SkillResult } from '../core/types.js';
import type { LLMClient } from '../core/llmClient.js';
import { priorOutputsBlock } from '../core/text.js';

/** 프론트매터(--- ... ---) 제거하고 본문만 반환 */
function stripFrontmatter(md: string): string {
  if (md.startsWith('---')) {
    const end = md.indexOf('\n---', 3);
    if (end !== -1) return md.slice(md.indexOf('\n', end + 1) + 1);
  }
  return md;
}

export class MarkdownSkill implements Skill {
  constructor(
    readonly name: string,
    private path: string,
    private llm: LLMClient,
  ) {}

  async run(ctx: Context): Promise<SkillResult> {
    let body: string;
    try {
      body = stripFrontmatter(readFileSync(this.path, 'utf8'));
    } catch {
      return { ok: false, text: `[skill:${this.name}] SKILL.md 로드 실패` };
    }

    const project = ctx.session?.framework ? `대상 프로젝트: ${ctx.session.framework}\n` : '';
    const hist = ctx.history.length
      ? '[최근 대화 — 이 문맥을 반영하라]\n' +
        ctx.history.map((t) => `사용자: ${t.user}\n어시스턴트: ${t.assistant}`).join('\n') +
        '\n\n'
      : '';
    const slots = Object.keys(ctx.slots).length ? `슬롯: ${JSON.stringify(ctx.slots)}\n` : '';
    // 파일 인제스천: 발화가 참조한 workspace 파일/자료를 프롬프트에 실어, 붙여넣기 없이 분석·리뷰가 되게 한다.
    // 소형 모델이 스킬의 "자료 없으면 붙여넣어 달라" 규칙을 첨부보다 우선시하지 않도록, 첨부가
    // 곧 "제공된 대상"임을 명시하고 추가 붙여넣기 요구를 금지한다.
    const attach = ctx.attachments?.length
      ? '[제공된 자료 — 아래가 이번 요청의 대상이다. 이 자료가 곧 "제공된 코드/문서"이니 ' +
        '추가로 붙여넣기를 요구하지 말고 이 내용으로 바로 작업하라. 여기 없는 내용은 지어내지 마라]\n' +
        ctx.attachments
          .map((a) => `## ${a.label}${a.truncated ? ' (일부 생략됨)' : ''}\n\`\`\`\n${a.content}\n\`\`\``)
          .join('\n\n') +
        '\n\n'
      : '';
    // 체이닝: 오케스트레이터가 앞선 단계 결과를 ctx.outputs 에 쌓아두면, 이번 단계가 이어받아 작업한다.
    // 총량 예산 압축(priorOutputsBlock) — 단계가 많아도 num_ctx 를 넘지 않게 최근 단계 우선으로 싣는다.
    const prior = ctx.outputs.length
      ? '[이전 단계 산출물 — 이 내용을 참고해 이어서 작업하라]\n' + priorOutputsBlock(ctx.outputs) + '\n\n'
      : '';
    const user = attach + prior + hist + `요청: ${ctx.userText}\n` + `작업 디렉토리(workspace): ${ctx.workspace}\n` + project + slots;

    // 출력 언어 고정: 한국어만(한자·일본어 금지). 코드·영문 기술용어·숫자는 예외.
    const sys = body + '\n\n[출력 언어] 반드시 한국어로만 답한다. 한자(漢字)·일본어(かな/カナ)를 쓰지 않는다(코드·영문 기술용어·숫자는 예외).';
    // 스트리밍 요청이면 토큰을 흘린다(긴 생성의 체감 지연↓). 아니면 한국어 정제 pass 를 거친 비스트리밍.
    const text = ctx.onToken
      ? await this.llm.chatTextStream(sys, user, ctx.onToken)
      : await this.llm.chatKorean(sys, user);
    return { ok: true, text, data: { skill: this.name } };
  }
}
