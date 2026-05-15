import { zodResponseFormat } from "openai/helpers/zod.js";

import { chatMessages } from "../client/client";
import { IntentResult, IntentResultSchema } from "./types";
import { TEMPLATES_LIST } from "./templates";

function getIntentsByTemplates() {
  let result = "";
  let index = 1;

  for (const t of TEMPLATES_LIST) {
    result += `
${index}. ${t.intent}
- ${t.description}
`;
    index++;
  }

  result += `
${index}. UNKNOWN
- Use ONLY when absolutely unclear.`;

  return result;
}

// 분류
export async function classify(input: string): Promise<IntentResult> {
  const systemPrompt = `
You are an Intent Classifier for an Action Graph system.

Your job is NOT to solve the task.
Your job is NOT to select tools.
Your job is NOT to design workflows.

You ONLY classify the user's request into a single INTENT.

---

Available intents:
${getIntentsByTemplates()}

---

Rules:
- Output ONLY ONE intent.
- Do NOT mention tools or workflows.
- Do NOT break down steps.
- Do NOT explain reasoning unless asked.
- Prefer the most specific intent.
- If multiple apply, choose the dominant user intent.
  `;

  const userPrompt = `
Input:
${input}
  `;

  const result = await chatMessages(
    [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    zodResponseFormat(IntentResultSchema, "llm_classification_schema"),
  );

  return JSON.parse(result.choices[0].message?.content || "");
}

/**

1. SIMPLE_RESPONSE
- Use for casual conversation, trivial questions, or no-tool-needed responses.

2. TRANSLATE
- Use when user requests translation or language conversion.

3. RUN_EXECUTE
- Use when user wants to run commands, code, or system execution.

4. WEB_RESEARCH
- Use when user wants to search or gather external information.

5. DOC_ANALYSIS
- Use when user provides text, logs, or documents for analysis or summarization.

6. CODE_GENERATE
- Use when user wants code creation.

7. CODE_DEBUGGING
- Use when user wants debugging, fixing, or error analysis.

8. SCENARIO_GENERATE
- Use when user wants hypothetical scenarios, simulations, or planning logic.

9. REPORT_GENERATE
- Use when user wants structured output like reports, documents, or formal writing.

10. UNKNOWN
- Use ONLY when absolutely unclear.

 */
