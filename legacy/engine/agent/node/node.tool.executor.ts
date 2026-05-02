import { Tool } from "../tool/types";
import { ToolExecutor } from "../types";

const toolExecutorNode = async (
  taskId: string,
  tool: Tool,
  args: any,
): Promise<ToolExecutor> => {
  const now = new Date();

  const result = await tool.execute(args);
  const usage: any = result?.usage;

  return {
    taskId: taskId,
    result: {
      taskId: taskId,
      toolName: tool.definition.name,
      args: args, // 실제 호출에 사용된 인자
      output: result, // 도구의 반환 값 (JSON, String 등)
      isError: false,
      duration: 0,
      completedAt: new Date(),
    },
    tokenUsage: {
      promptTokens: usage?.prompt_tokens || 0,
      completionTokens: usage?.completion_tokens || 0,
      totalTokens: usage?.total_tokens || 0,
    },
    duration: now.getTime() - new Date().getTime(),
    completedAt: new Date(),
  };
};

export default toolExecutorNode;
