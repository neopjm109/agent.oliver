import { zodResponseFormat } from "openai/helpers/zod.js";
import { chatInput } from "../../../client/client";
import {
  DependeciesSchema,
  Goal,
  GoalSchema,
  Plan,
  Task,
  TaskResultSchema,
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
- Each task must have a clear output
- Keep tasks between 3~7
- Avoid overlap
`;

  const res: any = await chatInput(
    prompt,
    zodResponseFormat(TaskResultSchema, "task_schema"),
  );
  return JSON.parse(res.choices[0].message.content)?.tasks || [];
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
  console.log(`goal: ${JSON.stringify(goal, null, 2)}`);

  // 2. Task 생성
  const tasks = await generateTasks(goal, input);
  console.log(`tasks: ${JSON.stringify(tasks, null, 2)}`);

  // 3. Dependency 생성
  const tasksWithDeps = await generateDependencies(tasks);
  console.log(`tasksWithDeps: ${JSON.stringify(tasksWithDeps, null, 2)}`);

  // 4. 검증
  validatePlan(tasksWithDeps);

  return {
    goal,
    tasks: tasksWithDeps,
  };
}
