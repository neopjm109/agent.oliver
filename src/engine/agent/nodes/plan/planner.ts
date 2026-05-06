import { zodResponseFormat } from "openai/helpers/zod.js";
import { chatInput } from "../../../client/client";
import { TaskState } from "../execute/types";
import {
  DependeciesSchema,
  Goal,
  GoalSchema,
  Plan,
  Task,
  TaskResultSchema,
  TaskSchema,
} from "./types";

async function generateGoal(input: string): Promise<Goal> {
  const prompt = `
Analyze the following specification and define an execution goal.

Input:
${input.slice(0, 2000)}
`;

  const res: any = await chatInput(
    prompt,
    zodResponseFormat(GoalSchema, "goal_schema"),
  );
  return JSON.parse(res.choices[0].message.content);
}

async function generateTasks(goal: Goal, input: string): Promise<Task[]> {
  const prompt = `
You are a planner.

Goal:
${JSON.stringify(goal)}

Specification:
${input.slice(0, 2000)}

---

Break the goal into executable tasks.

Rules:
- Each task must be independently executable
- Each task must produce a clear output
- Use the MINIMUM number of tasks required
- Avoid unnecessary splitting
- Avoid overly large tasks that combine multiple concerns
- Tasks should be logically ordered
- Typical range is 2~10 tasks, but may exceed if necessary

Subtask Rules:
- Use subtasks ONLY when a task is too large or contains multiple logical steps
- Subtasks must also be independently executable
- Maximum depth is 2 (Task → Subtask only, no deeper nesting)
- Avoid unnecessary nesting
- If a task can be executed in one step, DO NOT create subtasks
- Each subtask should represent a meaningful unit of work (e.g., one tool execution)

Execution Semantics:
- Only leaf tasks (tasks without subtasks) will be executed
- Parent tasks are for grouping and structure only

Save Rules:
- Include a "save_file" task ONLY if:
  - The user explicitly asks for saving, OR
  - The output is large or reusable
- Do NOT include save_file for small or temporary outputs
- If included, "save_file" must be the final task (or final subtask in its group)
`;

  const res: any = await chatInput(
    prompt,
    zodResponseFormat(TaskResultSchema, "task_result_schema"),
  );
  return JSON.parse(res.choices[0].message.content)?.tasks || [];
}

function flattenTasks(tasks: Task[]): Task[] {
  const result: any[] = [];

  for (const t of tasks) {
    result.push({
      ...t,
      subtasks: undefined, // 제거
    });

    if (t.subtasks) {
      result.push(...flattenTasks(t.subtasks));
    }
  }

  return result;
}

async function generateDependencies(tasks: Task[]): Promise<Task[]> {
  const prompt = `
Analyze task dependencies.

Tasks:
${JSON.stringify(tasks, null, 2)}

---

For each task, list dependencies (task ids).

Rules:
- No circular dependencies
- Only include necessary dependencies
`;

  const res: any = await chatInput(
    prompt,
    zodResponseFormat(DependeciesSchema, "dependecies_schema"),
  );
  const deps = JSON.parse(res.choices[0].message.content)?.deps || [];
  const map = new Map(tasks.map((t) => [t.id, t]));

  for (const d of deps) {
    const task = map.get(d.id);
    if (task) {
      task.dependencies = d.dependencies;
    }
  }

  return tasks;
}

function validatePlan(tasks: Task[]) {
  const ids = new Set(tasks.map((t) => t.id));

  // dependency 존재 확인
  for (const t of tasks) {
    for (const dep of t.dependencies) {
      if (!ids.has(dep)) {
        throw new Error(`Invalid dependency: ${dep}`);
      }
    }
  }

  // cycle 체크
  detectCycle(tasks);
}

function detectCycle(tasks: Task[]) {
  const visited = new Set();
  const stack = new Set();

  const map = new Map(tasks.map((t) => [t.id, t]));

  function dfs(id: string) {
    if (stack.has(id)) throw new Error("Cycle detected");
    if (visited.has(id)) return;

    visited.add(id);
    stack.add(id);

    const task = map.get(id);
    for (const dep of task?.dependencies || []) {
      dfs(dep);
    }

    stack.delete(id);
  }

  for (const t of tasks) {
    dfs(t.id);
  }
}

export async function planner(input: string): Promise<Plan> {
  // 1. Goal 생성
  const goal = await generateGoal(input);
  console.log(`goal: ${JSON.stringify(goal)}`);

  // 2. Task 생성
  const tasks = await generateTasks(goal, input);
  const flatten = flattenTasks(tasks);
  console.log(`tasks: ${JSON.stringify(tasks)}`);
  console.log(`flatten: ${JSON.stringify(flatten)}`);

  // 3. Dependency 생성
  const tasksWithDeps = await generateDependencies(flatten);
  console.log(`task: ${JSON.stringify(tasksWithDeps)}`);

  // 4. 검증
  validatePlan(tasksWithDeps);

  return {
    goal,
    tasks: tasksWithDeps,
  };
}

export async function replanTask(input: TaskState): Promise<Task> {
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
Name: ${currentTask?.name || "N/A"}
Description: ${currentTask?.description || "N/A"}

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
`;

  // ------------------------
  // 3. LLM 호출
  // ------------------------

  const res: any = await chatInput(
    prompt,
    zodResponseFormat(TaskSchema, "task_schema"),
  );
  return JSON.parse(res.choices[0].message.content)?.tasks || [];
}

export async function replanPartial(plan: Plan, state: TaskState) {
  const completed = plan.tasks.filter((t) => t.status === "done");

  const prompt = `
We failed at task:
${state.currentTask?.description ?? ""}

Completed tasks:
${JSON.stringify(completed)}

Generate new tasks ONLY for the remaining work.
`;

  const res: any = await chatInput(
    prompt,
    zodResponseFormat(TaskResultSchema, "task_result_schema"),
  );
  const parsed = JSON.parse(res.choices[0].message.content)?.tasks || [];
  return {
    ...plan,
    tasks: [...completed, ...parsed],
  };
}

export async function replanFull(
  originalInput: string,
  state: TaskState,
  previousPlan: Plan,
): Promise<Plan> {
  const { history, context } = state;

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
${JSON.stringify(previousPlan.goal)}

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
`;

  // ------------------------
  // 4. LLM 호출
  // ------------------------
  const res: any = await chatInput(
    prompt,
    zodResponseFormat(TaskResultSchema, "task_result_schema"),
  );
  const tasks = JSON.parse(res.choices[0].message.content)?.tasks || [];

  // 3. Dependency 생성
  const tasksWithDeps: Task[] = await generateDependencies(tasks);

  // ------------------------
  // 6. validation
  // ------------------------
  validatePlan(tasks);

  // ------------------------
  // 5. completed task 유지
  // ------------------------
  const completed: Task[] =
    previousPlan?.tasks.filter((t) => t.status === "done") ?? [];

  return {
    goal: previousPlan.goal,
    tasks: [...completed, ...tasksWithDeps],
  };
}
