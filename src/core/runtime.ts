// Runtime — intent 에 매달린 단일 스킬을 1회 실행. 모델은 순서를 정하지 않는다.
// (구 다중 노드 DAG 는 폐기: lite 런타임은 산출물 체이닝/파일쓰기를 하지 않아
//  다중 노드가 원리적으로 동작하지 않았다. 1 intent → 1 skill → 1 LLM 호출.)
import type { Context, Intent, SkillResult } from './types.js';
import type { SkillRegistry } from '../skills/registry.js';
import type { LLMClient } from './llmClient.js';
import { extractSlots } from './extractor.js';

/** 스킬명이 "{slot}" 형태면 슬롯값(=skill명)으로 치환, 아니면 그대로 */
function resolveSkill(name: string, slots: Record<string, string>): string {
  const m = name.match(/^\{(.+)\}$/);
  return m ? (slots[m[1]] ?? name) : name;
}

export class Runtime {
  constructor(
    private registry: SkillRegistry,
    private llm: LLMClient,
  ) {}

  async execute(intent: Intent, ctx: Context): Promise<SkillResult> {
    // 1) 슬롯 추출 (있으면) — 스킬 선택 겸 파라미터
    if (intent.slot) {
      ctx.slots = { ...ctx.slots, ...(await extractSlots(this.llm, intent, ctx)) };
    }

    // 2) 스킬 1개 해결 후 실행
    const skillName = resolveSkill(intent.skill, ctx.slots);
    const skill = this.registry.get(skillName);
    const result = await skill.run(ctx);
    ctx.outputs.push({ skill: skillName, result });
    return result;
  }
}
