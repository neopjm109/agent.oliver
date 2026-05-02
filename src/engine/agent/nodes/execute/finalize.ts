import { TaskState } from "./types";

export function finalize(state: TaskState) {
  return {
    goal: state.goal,
    steps: state.history,
    result: state.history[state.history.length - 1]?.observation,
  };
}
