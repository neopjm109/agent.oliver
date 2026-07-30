import type { Tool } from "./types.js";
import { fsTools } from "./fs.js";
import { bashTool } from "./bash.js";
import { invokeSkillTool, listSkillsTool } from "./skill.js";
import { spawnAgentTool } from "./agent.js";
import { updatePlanTool } from "./plan.js";
import { webTools } from "./web.js";

/** 에이전트에 등록되는 기본 도구 집합 */
export const defaultTools: Tool[] = [
  ...fsTools,
  bashTool,
  ...webTools,
  updatePlanTool,
  listSkillsTool,
  invokeSkillTool,
  spawnAgentTool,
];

export function toolMap(tools: Tool[]): Map<string, Tool> {
  return new Map(tools.map((t) => [t.name, t]));
}

/** 비활성화 목록(disabled)에 없는 도구만 반환 (보안: 공개 배포 시 위험 도구 제거) */
export function selectTools(disabled: string[] = []): Tool[] {
  return defaultTools.filter((t) => !disabled.includes(t.name));
}

export type { Tool };
