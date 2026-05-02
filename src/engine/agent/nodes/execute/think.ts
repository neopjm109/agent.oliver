import { zodResponseFormat } from "openai/helpers/zod.js";
import { chatInput } from "../../../client/client";
import { Intent } from "../../types";
import { truncate } from "../../utils/utils";
import { Step, ThinkInput, Thought, ThoughtSchema } from "./types";

function formatHistory(history: Step[], limit = 5): string {
  return history
    .slice(-limit)
    .map((h, i) => {
      return `
Step ${i + 1}:
Thought: ${h.thought ?? ""}
Action: ${h.action ?? ""}
Observation: ${h.observation ?? ""}
`;
    })
    .join("\n");
}

function getLastIntent(history: Step[]): Intent | null {
  const last = history[history.length - 1];
  if (!last?.thought) return null;

  try {
    const parsed = JSON.parse(last.thought);
    return parsed.intent;
  } catch {
    return null;
  }
}

// ------------------------
// Core Think Function
// ------------------------

export async function think(input: ThinkInput): Promise<Thought> {
  const { goal, currentTask, history, context, maxSteps = 10 } = input;

  // ------------------------
  // 1. 강제 종료 조건
  // ------------------------
  if (history.length >= maxSteps) {
    return {
      intent: "finish",
      reasoning: "Max steps reached, stopping execution.",
    };
  }

  // ------------------------
  // 2. Prompt 구성
  // ------------------------
  const prompt = `
You are an AI agent using the ReAct pattern.

Goal:
${goal}

Current Task:
${currentTask ?? "N/A"}

Recent History:
${formatHistory(history)}

Context:
${truncate(context)}

---

Decide the NEXT best action.

Choose EXACTLY ONE intent from:
- search → need external information
- analyze → reason over current data
- compute → perform calculation or transformation
- verify → check correctness or consistency
- finish → task is complete

Rules:
- Be concise (1 sentence)
- Do NOT repeat previous actions
- Focus only on the NEXT step
- Avoid vague reasoning
`;

  // ------------------------
  // 3. LLM 호출
  // ------------------------
  const res: any = await chatInput(
    prompt,
    zodResponseFormat(ThoughtSchema, "thought_schema"),
  );

  const parsed = JSON.parse(res.choices[0].message.content);

  // ------------------------
  // 4. 반복 방지 로직
  // ------------------------
  const lastIntent = getLastIntent(history);

  if (lastIntent && lastIntent === parsed.intent) {
    // 같은 intent 반복 방지
    return {
      intent: "verify",
      reasoning: "Avoid repeating same action, switching to verification.",
    };
  }

  // ------------------------
  // 5. Intent validation
  // ------------------------
  const validIntents: Intent[] = [
    "search",
    "analyze",
    "compute",
    "verify",
    "finish",
  ];

  if (!validIntents.includes(parsed.intent)) {
    return {
      intent: "analyze",
      reasoning: "Invalid intent received, defaulting to analyze.",
    };
  }

  // ------------------------
  // 6. 정상 반환
  // ------------------------
  return parsed;
}
