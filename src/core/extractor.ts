// Extractor — 슬롯 채우기(JSON schema 제약). free-form tool-call 대신 이것만 사용.
import type { Context, Intent } from './types.js';
import type { LLMClient } from './llmClient.js';

/**
 * intent.slot 정의를 JSON schema 로 만들어 서버에 강제하고, 값을 추출한다.
 * enum 슬롯이므로 모델은 정해진 값 중 하나만 고르면 된다(저사양 친화).
 */
export async function extractSlots(llm: LLMClient, intent: Intent, ctx: Context): Promise<Record<string, string>> {
  if (!intent.slot) return {};

  // 이미 확정된(파이프라인이 사전 주입한) 슬롯은 재추출하지 않는다.
  const pending = Object.entries(intent.slot).filter(
    ([name, spec]) => !(ctx.slots[name] && spec.enum.includes(ctx.slots[name])),
  );
  if (pending.length === 0) return {};

  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [name, spec] of pending) {
    properties[name] = { type: 'string', enum: spec.enum };
    required.push(name);
  }
  const schema = { type: 'object', properties, required, additionalProperties: false };

  const system =
    '너는 슬롯 추출기다. 사용자 발화의 핵심 대상을 파악해 enum 값 중 정확히 맞는 것 하나를 고른다.\n' +
    '- 값 이름에 형식/종류가 들어있으면 발화의 단어와 정확히 매칭한다:\n' +
    '  엑셀→xlsx, 워드→docx, 파워포인트·파포·ppt→pptx, pdf→pdf, 마크다운·md→markdown, csv→csv.\n' +
    '- 발화에 없는 것을 임의로 고르지 말고, 발화의 단어에 가장 정확히 대응하는 값을 고른다.\n' +
    '- 설명 없이 JSON 만 출력한다.';
  const user = `발화: "${ctx.userText}"`;

  let raw: Record<string, string> = {};
  try {
    raw = await llm.chatJson<Record<string, string>>(system, user, schema);
  } catch {
    /* 아래에서 enum 검증 → 기본값 처리 */
  }
  // enum 밖 값(모델 환각/느슨한 enum 강제) 방어: enum 안에 없으면 첫 값으로.
  const out: Record<string, string> = {};
  for (const [name, spec] of pending) {
    out[name] = spec.enum.includes(raw[name]) ? raw[name] : spec.enum[0];
  }
  return out;
}
