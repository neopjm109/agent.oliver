import type { Tool, PlanStep } from "./types.js";

const VALID = new Set(["pending", "in_progress", "completed"]);

/**
 * 작업 계획(할 일 목록)을 만들고 갱신하는 도구.
 * 호출할 때마다 전체 목록을 넘기면 그것으로 계획을 통째로 교체한다(TodoWrite 방식).
 * 복잡한 다단계 작업에서 진행 상황을 추적하고 사용자에게 보여주는 용도.
 */
export const updatePlanTool: Tool = {
  name: "update_plan",
  description:
    "다단계 작업의 할 일 목록을 만들거나 갱신한다. 3단계 이상 걸리는 작업이면 시작할 때 계획을 세우고, 한 단계를 시작하면 그 단계를 in_progress 로, 끝내면 completed 로 바꿔 매번 전체 목록을 다시 넘겨라. 항상 한 번에 하나만 in_progress 여야 한다.",
  parameters: {
    type: "object",
    properties: {
      steps: {
        type: "array",
        description: "할 일 단계 전체 목록 (순서대로)",
        items: {
          type: "object",
          properties: {
            content: { type: "string", description: "해당 단계에서 할 일" },
            status: {
              type: "string",
              enum: ["pending", "in_progress", "completed"],
              description: "단계 상태",
            },
          },
          required: ["content", "status"],
        },
      },
    },
    required: ["steps"],
  },
  async run(args, ctx) {
    const raw = Array.isArray(args.steps) ? args.steps : [];
    const steps: PlanStep[] = raw
      .map((s: any) => ({
        content: String(s?.content ?? "").trim(),
        status: VALID.has(s?.status) ? s.status : "pending",
      }))
      .filter((s: PlanStep) => s.content);

    if (!steps.length) return "계획이 비어 있습니다. content 가 있는 단계를 1개 이상 넘기세요.";

    const inProgress = steps.filter((s) => s.status === "in_progress").length;
    if (inProgress > 1) {
      return "in_progress 는 한 번에 하나만 허용됩니다. 하나만 in_progress 로 두세요.";
    }

    ctx.setPlan(steps);
    const done = steps.filter((s) => s.status === "completed").length;
    return `계획 갱신됨 (${done}/${steps.length} 완료).`;
  },
};

/** 계획을 체크리스트 문자열로 렌더링 */
export function renderPlan(steps: PlanStep[]): string {
  const mark = (s: PlanStep) =>
    s.status === "completed" ? "☑" : s.status === "in_progress" ? "▸" : "☐";
  const lines = steps.map((s) => {
    const label = s.status === "in_progress" ? `${s.content}  ⟵ 진행 중` : s.content;
    return `  ${mark(s)} ${label}`;
  });
  return ["📋 계획", ...lines].join("\n");
}
