import { Tool, ToolAction } from "../../tools/types";
import { Goal, Task } from "../plan/types";
import { act } from "./action";
import { finalize } from "./finalize";
import { createObservation } from "./observation";
import { think } from "./think";
import { Observation, TaskState, Thought } from "./types";

const MAX_STEPS = 10;

async function executeTool(tools: Tool[], action: ToolAction) {
  const toolFn = tools.filter((t) => t.definition.name === action.tool)?.[0]
    ?.execute;

  if (!toolFn) {
    throw new Error("Tool not found");
  }

  return await toolFn(action.args);
}

export const runReAct = async ({
  goal,
  tools,
  currentTask,
}: {
  goal: Goal | string;
  tools: Tool[];
  currentTask?: Task;
}) => {
  let stepCount = 0;
  let state: TaskState = {
    goal: typeof goal === "string" ? goal : JSON.stringify(goal),
    currentTask,
    history: [],
    context: "",
    stepCount: 0,
    retryCount: 0,
  };
  while (stepCount < MAX_STEPS) {
    stepCount++;

    // ------------------------
    // Think
    // ------------------------
    const thought = await think({
      goal: state.goal,
      currentTask: state.currentTask?.description,
      history: state.history,
      context: state.context,
      maxSteps: MAX_STEPS,
    });

    if (thought.intent === "finish") {
      return finalize(state);
    }

    // ------------------------
    // Action
    // ------------------------
    let action = await act(thought, tools, state.context);

    // ------------------------
    // Tool 실행
    // ------------------------
    const result = await executeTool(tools, action);

    // ------------------------
    // Observation
    // ------------------------
    const observation = await createObservation({
      tool: action.tool,
      result,
      context: state.context,
    });

    // ------------------------
    // History 업데이트
    // ------------------------
    state.history.push({
      thought: JSON.stringify(thought),
      action: JSON.stringify(action),
      observation: observation.summary,
    });

    // ------------------------
    // Context 업데이트 (중요)
    // ------------------------
    state.context += "\n" + observation.summary;

    // ------------------------
    // Decision (retry / replan / continue)
    // ------------------------
    const decision = decideNextAction({
      success: observation.success,
      observationType: observation.type,
      relevance: observation.signals.relevance,
      reliability: observation.signals.reliability,
      stepCount: stepCount,
      retryCount: state.retryCount,
    });

    // ------------------------
    // Decision 처리
    // ------------------------
    if (decision === "retry") {
      state.retryCount++;

      action = mutateAction(action);

      continue;
    }

    if (decision === "replan") {
      state.retryCount = 0;

      if (state.plan) {
        state.plan = await replan(state);
        state.currentTask = state.plan.tasks[0];
      }

      continue;
    }

    if (decision === "continue") {
      state.retryCount = 0;

      // Task 완료 체크 (간단 버전)
      if (state.currentTask && observation.success) {
        const nextTask = getNextTask(state.plan, state.currentTask);

        if (nextTask) {
          state.currentTask = nextTask;
          state.context = observation.summary;
        } else {
          return finalize(state);
        }
      }

      continue;
    }

    if (decision === "finish") {
      return finalize(state);
    }
  }

  // ------------------------
  // fallback 종료
  // ------------------------
  return finalize(state);
};
