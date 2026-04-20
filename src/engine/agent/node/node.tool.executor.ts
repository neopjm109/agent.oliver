import Client from "../../client/client";
import { Tool } from "../tool/types";
import { TokenUsage, ToolExecutor } from "../types";

const toolExecutorNode = async (
  client: Client,
  taskId: string,
  tools: Tool[],
  toolName: string,
  args: any,
): Promise<ToolExecutor> => {
  const now = new Date();
  const usage: any = null;

  return {
    taskId: taskId,
    result: {
      taskId: "",
      toolName: "",
      args: null, // 실제 호출에 사용된 인자
      output: null, // 도구의 반환 값 (JSON, String 등)
      isError: false,
      duration: 0,
      completedAt: new Date(),
    },
    tokenUsage: {
      promptTokens: usage?.prompt_tokens || 0,
      completionTokens: usage?.completion_tokens || 0,
      totalTokens: usage?.total_tokens || 0,
      estimatedCost: usage?.total_tokens || 0 * 0.01,
    },
    duration: now.getTime() - new Date().getTime(),
    completedAt: new Date(),
  };
};

export default toolExecutorNode;
