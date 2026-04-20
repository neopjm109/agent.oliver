import * as z from "zod";

export const ToolResult = z.object({
  taskId: z.string(),
  toolName: z.string(),
  args: z.any(),
  output: z.any(),
  isError: z.boolean(),
  errorMessage: z.string().optional().nullable(),
})

export const TaskSchema = z.object({
  taskId: z.string(),
  goal: z.string(),
  toolName: z.string(),
  args: z.record(z.string(), z.any()),
  status: z.enum(["pending", "running", "success", "failed"]),
  dependsOn: z.array(z.string()),
});

export const PlannerSchema = z.object({
  tasks: z.array(TaskSchema),
  thought: z.string(),
});

export const ToolSelectorSchema = z.object({
  taskId: z.string(),
  thought: z.string(),
  toolName: z.string(),
});

export const ArgsGeneratorSchema = z.object({
  taskId: z.string(),
  thought: z.string(),
  args: z.any(),
});

export const ToolExecutorSchema = z.object({
  taskId: z.string(),
  result: ToolResult,
});

export const ObservationSchema = z.object({
  taskId: z.string(),
  thought: z.string(),
  nextStep: z.enum(["continue", "add_task", "break"]),
  tasks: z.array(TaskSchema).optional().nullable(),
});

export const SummarizerSchema = z.object({
  answer: z.string(),
  thought: z.string(),
});
