import { Plan, Task } from "../plan/types";
import { ReplanFullInput, ReplanTaskInput } from "./types";

export async function replanTask(input: ReplanTaskInput): Promise<Task> {
  const { goal, currentTask, history, context } = input;

  // ------------------------
  // 1. 최근 실패 요약
  // ------------------------
  const recentHistory = history.slice(-5);

  const failureSummary = recentHistory
    .map((h, i) => {
      return `
Step ${i + 1}:
Thought: ${h.thought}
Action: ${h.action}
Observation: ${h.observation}
`;
    })
    .join("\n");

  // ------------------------
  // 2. Prompt 구성
  // ------------------------
  const prompt = `
You are an AI planner.

Goal:
${goal}

Failed Task:
Name: ${currentTask.name}
Description: ${currentTask.description}

Recent Execution History:
${failureSummary}

Context:
${context.slice(0, 1000)}

---

Your job is to FIX this task.

Rules:
- Keep the SAME goal
- DO NOT repeat the same approach
- Modify strategy to avoid previous failure
- Task must be executable
- Be specific and actionable

Output JSON:

{
  "name": "...",
  "description": "...",
  "inputs": ["..."],
  "outputs": ["..."]
}
`;

  // ------------------------
  // 3. LLM 호출
  // ------------------------
  let newTask: Partial<Task>;

  try {
    const raw = await llmCall(prompt);
    newTask = JSON.parse(raw);
  } catch {
    return fallbackReplanTask(currentTask);
  }

  // ------------------------
  // 4. 안전 보정 (중요)
  // ------------------------
  return {
    id: currentTask.id, // 🔥 id 유지 (핵심)
    name: newTask.name ?? currentTask.name,
    description: newTask.description ?? currentTask.description,

    inputs: newTask.inputs ?? currentTask.inputs,
    outputs: newTask.outputs ?? currentTask.outputs,

    dependencies: currentTask.dependencies, // 🔥 유지
    status: "pending",
  };
}

async function replanPartial(plan: Plan, state: TaskState) {
  const completed = plan.tasks.filter((t) => t.status === "done");

  const prompt = `
We failed at task:
${state.currentTask?.description ?? ""}

Completed tasks:
${JSON.stringify(completed)}

Generate new tasks ONLY for the remaining work.
`;

  const newTasks = await llmCall(prompt);

  return {
    ...plan,
    tasks: [...completed, ...JSON.parse(newTasks)],
  };
}

export async function replanFull(input: ReplanFullInput): Promise<Plan> {
  const { goal, originalInput, history, previousPlan, context } = input;

  // ------------------------
  // 1. 실패 요약
  // ------------------------
  const recentHistory = history.slice(-8);

  const failureSummary = recentHistory
    .map(
      (h, i) => `
Step ${i + 1}
Thought: ${h.thought}
Action: ${h.action}
Observation: ${h.observation}
`,
    )
    .join("\n");

  // ------------------------
  // 2. 성공 Task 추출
  // ------------------------
  const completedTasks =
    previousPlan?.tasks
      .filter((t) => t.status === "done")
      .map((t) => ({
        id: t.id,
        name: t.name,
        output: t.outputs,
      })) ?? [];

  // ------------------------
  // 3. Prompt
  // ------------------------
  const prompt = `
You are an expert planner.

Goal:
${goal}

Original Specification:
${originalInput.slice(0, 2000)}

---

Previous Failed Plan:
${JSON.stringify(previousPlan, null, 2)}

Completed Tasks (DO NOT repeat):
${JSON.stringify(completedTasks, null, 2)}

Execution Failures:
${failureSummary}

Context:
${context.slice(0, 1000)}

---

Your job:
Create a NEW execution plan.

Rules:
- DO NOT repeat failed strategies
- DO NOT redo completed tasks
- You MAY change the approach completely
- Keep the same goal
- Tasks must be executable
- Include dependencies

Output JSON:

{
  "goal": {
    "objective": "...",
    "scope": ["..."]
  },
  "tasks": [
    {
      "id": "t1",
      "name": "...",
      "description": "...",
      "dependencies": []
    }
  ]
}
`;

  // ------------------------
  // 4. LLM 호출
  // ------------------------
  let newPlan: Plan;

  try {
    const raw = await llmCall(prompt);
    newPlan = JSON.parse(raw);
  } catch {
    return fallbackFullReplan(goal);
  }

  // ------------------------
  // 5. completed task 유지
  // ------------------------
  if (previousPlan) {
    const completed = previousPlan.tasks.filter((t) => t.status === "done");

    newPlan.tasks = [
      ...completed,
      ...newPlan.tasks.map((t) => ({
        ...t,
        status: "pending",
      })),
    ];
  }

  // ------------------------
  // 6. validation
  // ------------------------
  validatePlan(newPlan.tasks);

  return newPlan;
}
