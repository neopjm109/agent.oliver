import { Tool, ToolAction } from "../../tools/types";
import { replanFull, replanPartial, replanTask } from "../plan/planner";
import { Goal, Plan, Task } from "../plan/types";
import { act } from "./action";
import { finalize } from "./finalize";
import { createObservation } from "./observation";
import { think } from "./think";
import {
  Decision,
  DecisionSignals,
  Observation,
  TaskState,
  Thought,
} from "./types";

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
  const {
    success,
    observationType,
    relevance,
    reliability,
    completeness,
    stepCount,
  } = signals;

  const score = completeness * 0.5 + relevance * 0.2 + reliability * 0.3;
  console.log("nextAction score: ", score);

  // ------------------------
  // 1. 종료 조건 (핵심)
  // ------------------------
  if (
    success &&
    (completeness >= 0.9 || // 🔥 최우선
      score >= 0.7)
  ) {
    return "finish";
  }

  // step limit 보호
  if (stepCount >= MAX_STEPS) {
    return "finish";
  }

  // ------------------------
  // 2. retry 조건
  // ------------------------
  if ((!success || observationType === "partial") && stepCount < 3) {
    return "retry";
  }

  // ------------------------
  // 3. 오래 실패 → replan
  // ------------------------
  if (stepCount >= 3 && !success) {
    return "replan";
  }

  // ------------------------
  // fallback
  // ------------------------
  return "replan";
}

// 특정 Task 문제로 부분 replan 해야하는 경우
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

// 최근 6개 중 실패 횟수가 많으면 전체적인 실패로 판단
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

// Replan 전략 확인
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
  tools,
  currentTask,
  prevContext,
}: {
  type: "simple_query" | "complex_spec";
  input: string;
  tools: Tool[];
  plan: Plan;
  currentTask: Task;
  prevContext?: string;
}) => {
  let stepCount = 0;
  let state: TaskState = {
    goal: plan.goal,
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
    console.log("// Thought start ------------------------");
    const thought: Thought = await think({
      goal: state.goal,
      currentTask: currentTask.description,
      history: state.history,
      context: state.context,
      maxSteps: MAX_STEPS,
    });
    console.log("intent: ", thought.intent);
    console.log("reason: ", thought.reasoning);
    console.log("// Thought end ------------------------");

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
          result: response?.response,
        };
      } else {
        return finalize(state);
      }
    }

    // ------------------------
    // Action
    // ------------------------
    console.log("// Action start------------------------");
    const action: ToolAction = await act(
      currentTask,
      thought,
      tools,
      state.context,
    );
    console.log("tool name: ", action.tool);
    console.log("tool args: ", JSON.stringify(action.args));
    console.log("// Action end------------------------");

    // ------------------------
    // Tool 실행
    // ------------------------
    console.log("// Tool start ------------------------");
    const result = await executeTool(tools, action);
    console.log("tool result: ", JSON.stringify(result || "N/A"));
    console.log("// Tool end ------------------------");

    // ------------------------
    // Observation
    // ------------------------
    console.log("// Observation start ------------------------");
    const observation: Observation = await createObservation({
      tool: action.tool,
      result: JSON.stringify(result || ""),
      context: state.context,
    });
    console.log("observation result: ", JSON.stringify(observation));
    console.log("// Observation end ------------------------");

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
    // Decision (retry / replan / finish)
    // ------------------------
    const decision = decideNextAction({
      success: observation.success,
      observationType: observation.type,
      relevance: observation.signals.relevance,
      reliability: observation.signals.reliability,
      completeness: observation.signals.completeness,
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
        currentTask = await replanTask(state);
      } else if (strategy === "partial") {
        plan = await replanPartial(plan!!, state);
        // 현재 부분까지 완료된 상태로 다음 진행을 위해 finalize 진행
        return finalize(state);
      } else if (strategy === "full") {
        plan = await replanFull(input, state, plan!!);
        state.currentTask = plan.tasks[0];
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
