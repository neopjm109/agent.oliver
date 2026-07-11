import z from "zod";

export type Task = {
  id: string;
  name: string;
  description: string;
  dependencies: string[];
  status: "pending" | "in_progress" | "done";
  outputs?: any;
};

export const TaskSchema: z.ZodType<Task> = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  dependencies: z.array(z.string()),
  status: z.enum(["pending", "in_progress", "done"]),
  output: z.string().optional().nullable(),
});

export const TaskResultSchema = z.object({
  tasks: z.array(TaskSchema),
});

export type Goal = {
  objective: string;
  scope: string[];
  constraints?: string[] | null;
};

export const GoalSchema: z.ZodType<Goal> = z.object({
  objective: z.string(),
  scope: z.array(z.string()),
  constraints: z.array(z.string()).optional().nullable(),
});

export type Plan = {
  goal: Goal;
  tasks: Task[];
};

export const PlanSchema: z.ZodType<Plan> = z.object({
  goal: GoalSchema,
  tasks: z.array(TaskSchema),
});

export type DependenciesItem = {
  id: string;
  dependencies: string[];
};

export type Dependencies = DependenciesItem[];

export const DependeciesItemSchema: z.ZodType<DependenciesItem> = z.object({
  id: z.string(),
  dependencies: z.array(z.string()),
});

export const DependeciesSchema = z.object({
  deps: z.array(DependeciesItemSchema),
});
