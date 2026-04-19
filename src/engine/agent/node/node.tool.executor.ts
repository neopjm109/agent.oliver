import { ToolExecutor } from "../types";

const toolExecutorNode = async (
  toolName: string,
  args: any,
): Promise<ToolExecutor> => {
  return {
    taskId: "",
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
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
    duration: 0,
    completedAt: new Date(),
  };
};

export default toolExecutorNode;
