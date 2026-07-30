import type { Tool } from "./types.js";
import { renderSkillInstructions } from "../skills.js";

/**
 * 스킬을 탐색하는 도구.
 * 카테고리를 지정하면 그 안의 스킬 목록(이름+설명)을, 없으면 카테고리 개요를 반환한다.
 * 스킬이 많을 때 시스템 프롬프트를 부풀리지 않고 필요할 때만 펼쳐보게 하는 용도.
 */
export const listSkillsTool: Tool = {
  name: "list_skills",
  description:
    "사용 가능한 스킬을 탐색한다. category 를 주면 해당 카테고리의 스킬 목록(이름과 설명)을 반환하고, 생략하면 카테고리 개요를 반환한다. 어떤 스킬을 쓸지 고르기 전에 이 도구로 후보를 살펴보라.",
  parameters: {
    type: "object",
    properties: {
      category: {
        type: "string",
        description: "펼쳐볼 카테고리명 (생략 시 전체 카테고리 개요)",
      },
    },
  },
  async run(args, ctx) {
    const category = args.category ? String(args.category) : undefined;
    if (!category) {
      const cats = ctx.skills
        .categories()
        .map((c) => `- ${c.name} (${c.count}개)`)
        .join("\n");
      return `카테고리 개요 (총 ${ctx.skills.size()}개 스킬):\n${cats}`;
    }
    const skills = ctx.skills.inCategory(category);
    if (!skills.length) {
      const names = ctx.skills.categories().map((c) => c.name).join(", ");
      return `'${category}' 카테고리에 스킬이 없습니다. 사용 가능한 카테고리: ${names}`;
    }
    return (
      `[${category}] 카테고리의 스킬:\n` +
      skills.map((s) => `- ${s.name}: ${s.description}`).join("\n")
    );
  },
};

/**
 * 스킬을 "호출"하는 도구.
 * 실제로는 SKILL.md 본문(지침)을 도구 결과로 반환하며,
 * 모델은 이어지는 턴에서 그 지침을 따라 다른 도구들을 실행한다.
 * (Claude Code 의 Skill 도구와 동일한 패턴)
 */
export const invokeSkillTool: Tool = {
  name: "invoke_skill",
  description:
    "등록된 스킬을 불러온다. 사용자의 요청이 특정 스킬의 설명과 맞으면, 다른 작업을 하기 전에 먼저 이 도구로 스킬 지침을 로드하라. 반환된 지침을 그대로 따라 수행할 것.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "불러올 스킬의 이름" },
    },
    required: ["name"],
  },
  async run(args, ctx) {
    const name = String(args.name);
    const skill = ctx.skills.get(name);
    if (!skill) {
      // 전체 나열 대신 유사 이름만 제안 (스킬이 많을 때 재시도 루프/문맥 폭증 방지)
      const suggestions = ctx.skills.suggest(name);
      if (suggestions.length) {
        return `'${name}' 스킬이 없습니다. 이 이름들 중에서 골라 다시 invoke_skill 을 호출하세요: ${suggestions.join(", ")}`;
      }
      return `'${name}' 스킬이 없습니다. list_skills 로 사용 가능한 스킬을 먼저 확인하세요.`;
    }
    ctx.log(`  ↳ 스킬 로드: ${skill.name}`);
    return renderSkillInstructions(skill);
  },
};
