import { zodResponseFormat } from "openai/helpers/zod.js";
import Client from "../../client/client";
import { PlannerSchema } from "../schemas";
import { Planner } from "../types";

/**
 * PlannerNode
 * @description 요구사항을 보고 Task 계획을 세운다
 */
const plannerNode = async (client: Client, input: string): Promise<Planner> => {
  const response = await client.chat({
    messages: [
      { role: 'system', content: getPlanSystemPrompt("")},
      { role: 'user', content: input }
    ],
    format: zodResponseFormat(PlannerSchema, "planner_schema")
  });

  console.log("----------");
  console.log(response.choices[0].message?.content);
  console.log("----------");
  const planner: any = JSON.parse(response.choices[0].message?.content!!);
  const usage = response.usage;

  return {
    tasks: planner.tasks,
    thought: planner.thought,
    tokenUsage: {
      promptTokens: usage?.prompt_tokens || 0,
      completionTokens: usage?.completion_tokens || 0,
      totalTokens: usage?.total_tokens || 0,
      estimatedCost: usage?.total_tokens || 0 * 0.01,
    },
    duration: 0,
    completedAt: new Date(),
  };
};

const getPlanSystemPrompt = (toolsDescription: string) => {
  return `
너는 고도로 숙련된 '태스크 플래너' 에이전트이다. 
사용자의 요청을 분석하고, 제공된 도구들만을 조합하여 최적의 실행 계획을 수립하라.

[사용 가능한 도구 목록]
${toolsDescription}

[출력 규칙 - 반드시 엄수]
1. 반드시 순수한 JSON 객체 형식으로만 응답하라.
2. JSON 외의 서론, 결론, 설명 텍스트를 절대 포함하지 마라.
3. 응답 형식: { "tasks": Task[] }
4. Task 객체 구조:
   - taskId: "task-1", "task-2" 순의 고유 식별자
   - goal: 해당 단계에서 달성해야 할 구체적인 목표 (자연어)
   - toolName: 도구 목록에 정의된 정확한 이름 (대소문자 일치 필수)
   - dependsOn: 해당 작업을 시작하기 위해 먼저 완료되어야 하는 taskId 리스트 (없으면 [])

[실행 계획 예시]
{
  "tasks": [
    {
      "taskId": "task-1",
      "goal": "프로젝트 루트의 package.json 파일을 읽어 의존성 파악",
      "toolName": "read_file",
      "dependsOn": []
    },
    {
      "taskId": "task-2",
      "goal": "읽어온 package.json의 라이브러리 보안 취약점 분석",
      "toolName": "understand_code",
      "dependsOn": ["task-1"]
    }
  ]
}`.trim();
};

export default plannerNode;
