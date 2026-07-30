// 2단계 라우터의 LLM 분류기 — 임베딩이 애매할 때 top-K 후보 중 하나를 고른다.
// "생성"이 아니라 "K개 중 1택(+none)" = 분류. 저사양 3B 가 잘하는 제약 선택.
import type { Intent } from './types.js';
import type { LLMClient } from './llmClient.js';

/**
 * 후보 힌트: description + 예제 몇 개를 함께 준다.
 * description 만 주면 예제에만 있는 신호(예: add_capability 의 "웹소켓")가 분류기에 안 보여
 * none 오분류가 난다(라우터는 후보로 올렸는데 분류기가 못 알아봄). 예제를 붙여 recall 을 올린다.
 */
function hint(intent: Intent): string {
  const ex = intent.examples.slice(0, 3).join(' / ');
  if (intent.description) return ex ? `${intent.description} (예: ${ex})` : intent.description;
  return ex;
}

/**
 * 후보 intent 중 발화에 가장 맞는 것을 고른다. 맞는 게 없으면 null(→ unknown).
 * enum 제약(JSON schema)으로 서버가 값을 강제 → 파싱 안정적.
 */
export async function classifyIntent(
  llm: LLMClient,
  text: string,
  candidates: Intent[],
): Promise<Intent | null> {
  if (candidates.length === 0) return null;

  const names = candidates.map((c) => c.name);
  const list = candidates.map((c) => `- ${c.name}: ${hint(c)}`).join('\n');
  const schema = {
    type: 'object',
    properties: { intent: { type: 'string', enum: [...names, 'none'] } },
    required: ['intent'],
    additionalProperties: false,
  };
  const system =
    '너는 의도 분류기다. 사용자 요청이 아래 후보 기능 중 어디에 해당하는지 하나만 고른다.\n' +
    '- 요청과 직접 관련된 후보가 없으면 반드시 "none" 을 고른다. 억지로 고르지 마라.\n' +
    '- 인사·잡담·일상질문·실시간정보(날씨·주가 등)·이 시스템이 못하는 요청은 대부분 "none".\n' +
    '- 이름이 아니라 "설명"의 의미로 판단한다. 설명 없이 JSON 만 출력.';
  const user = `요청: "${text}"\n\n후보:\n${list}`;

  try {
    const r = await llm.chatJson<{ intent: string }>(system, user, schema);
    if (!r.intent || r.intent === 'none') return null;
    return candidates.find((c) => c.name === r.intent) ?? null;
  } catch {
    // 분류 실패 시 상위 후보로 폴백하지 않고 unknown 처리(오실행 방지)
    return null;
  }
}

/**
 * 요청이 "서로 다른 여러 작업을 순서대로 수행해야 하는 복합 요청"인지 yes/no 로 판정한다.
 * 순차 신호(looksMultiStep)에 걸린 발화에 한해 호출 — 여기서 true 면 plan_and_run 으로 승격.
 * 단일 작업(한 스킬로 끝나는 것)은 false → 개별 intent 즉답 유지.
 */
export async function isComplexRequest(llm: LLMClient, text: string): Promise<boolean> {
  const schema = {
    type: 'object',
    properties: { complex: { type: 'boolean' } },
    required: ['complex'],
    additionalProperties: false,
  };
  const system =
    '너는 요청이 "여러 개의 서로 다른 작업"으로 나뉘어 순서대로 실행해야 하는지 판정한다.\n' +
    '- 복합(true): 성격이 다른 작업이 2개 이상. 예: "설계하고 스캐폴딩까지", "조사해서 제안서까지 만들어줘".\n' +
    '- 단일(false): 한 가지 작업. 예: "주문 도메인 설계해줘", "이 코드 리팩터링하고 정리해줘"(한 작업의 서술).\n' +
    '- 애매하면 false. 설명 없이 JSON 만.';
  try {
    const r = await llm.chatJson<{ complex: boolean }>(system, `요청: "${text}"`, schema);
    return r.complex === true;
  } catch {
    return false; // 판정 실패 시 단일로 취급(오승격 방지)
  }
}
