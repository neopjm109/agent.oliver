import type { Tool } from "./types.js";

/**
 * 하위 작업을 독립된 서브에이전트에게 위임하는 도구.
 * 서브에이전트는 자신만의 대화 히스토리로 루프를 돌고 최종 결과 텍스트만 반환한다.
 * (Claude Code 의 Agent 도구와 동일한 패턴 — 큰 작업을 분해하거나 병렬 조사를 시킬 때 사용)
 */
export const spawnAgentTool: Tool = {
  name: "spawn_agent",
  description:
    "독립적으로 처리할 하위 작업을 서브에이전트에게 위임한다. 서브에이전트는 도구와 스킬을 모두 쓸 수 있으며, 작업을 마친 뒤 결과 요약만 돌려준다. 조사·분석처럼 자기완결적인 하위 작업에 사용하라. 작업 지시는 문맥이 없어도 이해되도록 충분히 자세히 적을 것.",
  parameters: {
    type: "object",
    properties: {
      task: {
        type: "string",
        description: "서브에이전트가 수행할 작업. 배경과 원하는 산출물을 구체적으로.",
      },
    },
    required: ["task"],
  },
  async run(args, ctx) {
    const task = String(args.task ?? "").trim();
    if (!task) return "task 가 비어 있습니다.";
    ctx.log(`  ↳ 서브에이전트 실행 (depth ${ctx.depth + 1})`);
    return ctx.spawnAgent(task);
  },
};
