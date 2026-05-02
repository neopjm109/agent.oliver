import { Tool, ToolAction } from "../../tools/types";
import { replanFull, replanPartial, replanTask } from "../plan/planner";
import { Goal, Plan, Task } from "../plan/types";
import { act } from "./action";
import { finalize } from "./finalize";
import { createObservation } from "./observation";
import { think } from "./think";
import { Decision, DecisionSignals, TaskState } from "./types";

const MAX_STEPS = 10;

async function executeTool(tools: Tool[], action: ToolAction) {
  const toolFn = tools.filter((t) => t.definition.name === action.tool)?.[0]
    ?.execute;

  if (!toolFn) {
    throw new Error("Tool not found");
  }

  return await toolFn(action.args);
}

function decideNextAction(signals: DecisionSignals): Decision {
  const { success, observationType, relevance, reliability, stepCount } =
    signals;

  // ------------------------
  // 1. 성공 → 현재 Task 종료
  // ------------------------
  if (stepCount >= MAX_STEPS) {
    return "finish";
  }

  if (success && relevance > 0.5 && reliability > 0.7) {
    return "finish";
  }

  // ------------------------
  // 2. retry 조건
  // ------------------------
  if (!success && relevance > 0.5 && stepCount < 2) {
    return "retry";
  }

  // ------------------------
  // 3. partial → retry 우선
  // ------------------------
  if (observationType === "partial" && stepCount < 2) {
    return "retry";
  }

  // ------------------------
  // 4. 오래 실패 → replan
  // ------------------------
  if (stepCount > 5 && !success) {
    return "replan";
  }

  // ------------------------
  // fallback
  // ------------------------
  return "replan";
}

export function isTaskScopedFailure(state: TaskState): boolean {
  const recent = state.history.slice(-4);

  if (recent.length < 2) return false;

  // 최근 observation에서 relevance 추출 (간단 가정)
  const lowRelevanceCount = recent.filter((h) =>
    h.observation?.includes("irrelevant"),
  ).length;

  // 👉 대부분 relevance 유지
  const relevanceOk = lowRelevanceCount <= 1;

  // 👉 같은 task 반복
  const sameTask = state.currentTask != null;

  // 👉 retry 진행 중
  const retrying = state.stepCount > 0;

  return relevanceOk && sameTask && retrying;
}

export function isGlobalFailure(state: TaskState): boolean {
  const recent = state.history.slice(-6);

  if (recent.length < 3) return false;

  // relevance 낮은 횟수
  const lowRelevanceCount = recent.filter((h) =>
    h.observation?.includes("irrelevant"),
  ).length;

  // 실패 반복
  const repeatedFailures = state.stepCount >= 2;

  return lowRelevanceCount >= 3 && repeatedFailures;
}

function chooseReplanStrategy(state: TaskState): "task" | "partial" | "full" {
  // 대부분 여기 걸려야 정상
  if (state.stepCount < 2) {
    return "task";
  }

  // 특정 task만 문제
  if (isTaskScopedFailure(state)) {
    return "partial";
  }

  // 전체 구조 문제
  if (isGlobalFailure(state)) {
    return "full";
  }

  return "task";
}

export const runReAct = async ({
  type,
  input,
  plan,
  goal,
  tools,
  currentTask,
  prevContext,
}: {
  type: "simple_query" | "complex_spec";
  input: string;
  goal: Goal | string;
  tools: Tool[];
  plan?: Plan;
  currentTask?: Task;
  prevContext?: string;
}) => {
  let stepCount = 0;
  let state: TaskState = {
    goal: typeof goal === "string" ? goal : JSON.stringify(goal),
    currentTask,
    history: [],
    context: prevContext || "",
    stepCount: 0,
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
      if (type === "simple_query") {
        // simple_query의 경우 task 반복이 1회이기때문에, finish로 바로 오는 경우가 있다.
        const tool = tools.filter(
          (t) => t.definition.name === "simple_llm_response",
        )[0]?.execute;
        const response = await tool({
          input: input,
        });
        return {
          result: response,
        };
      } else {
        return finalize(state);
      }
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
    console.log(state.context);

    // ------------------------
    // Decision (retry / replan / finish)
    // ------------------------
    const decision = decideNextAction({
      success: observation.success,
      observationType: observation.type,
      relevance: observation.signals.relevance,
      reliability: observation.signals.reliability,
      stepCount: stepCount,
    });
    console.log(decision);

    // ------------------------
    // Decision 처리
    // ------------------------
    if (decision === "retry") {
      continue;
    }

    if (decision === "replan") {
      const strategy = chooseReplanStrategy(state);

      if (strategy === "task") {
        state.currentTask = await replanTask(state);
      } else if (strategy === "partial") {
        plan = await replanPartial(plan!!, state);
        return finalize(state);
      } else if (strategy === "full") {
        plan = await replanFull(input, state, plan!!);
        state.currentTask = plan!!.tasks[0];
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
