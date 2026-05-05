import { zodResponseFormat } from "openai/helpers/zod.js";
import { chatInput } from "../../../client/client";
import { Tool, ToolAction, ToolActionSchema } from "../../tools/types";
import { Intent } from "../../types";
import { truncate } from "../../utils/utils";
import { Thought } from "./types";

// ------------------------
// Tool Filtering
// ------------------------

function filterToolsByIntent(tools: Tool[], intent: Intent): Tool[] {
  return tools.filter((t) => t.definition.intents.includes(intent));
}

function rankTools(tools: Tool[], context: string): Tool[] {
  return tools
    .map((t) => {
      let score = 0;

      if (context.includes(t.definition.name)) score += 2;
      if (t.definition.tags && context.includes(t.definition.tags.join(" ")))
        score += 1;

      return { tool: t, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.tool);
}

function selectTopTools(tools: Tool[], limit = 8): Tool[] {
  return tools.slice(0, limit);
}

// ------------------------
// Schema Validation
// ------------------------

function validateArgs(schema: Record<string, string>, args: any): boolean {
  for (const key of Object.keys(schema)) {
    if (!(key in args)) return false;
  }
  return true;
}

// ------------------------
// Fallback
// ------------------------

function fallbackToolAction(tools: Tool[]): ToolAction {
  const tool = tools[0];

  const args: Record<string, any> = {};
  for (const key of Object.keys(tool.definition.parameters?.properties ?? {})) {
    args[key] = "";
  }

  return {
    tool: tool.definition.name,
    args,
  };
}

// ------------------------
// Core Action Function
// ------------------------

export async function act(
  thought: Thought,
  tools: Tool[],
  context: string,
): Promise<ToolAction> {
  // ------------------------
  // 1. Intent 기반 후보 필터링
  // ------------------------
  let candidates = filterToolsByIntent(tools, thought.intent);

  if (candidates.length === 0) {
    throw new Error(`No tools for intent: ${thought.intent}`);
  }

  // ------------------------
  // 2. 랭킹 + 축소
  // ------------------------
  candidates = rankTools(candidates, context);
  candidates = selectTopTools(candidates, 8);
  console.log(candidates);

  // ------------------------
  // 3. LLM에 전달할 Tool 설명 생성
  // ------------------------
  const toolDescriptions = candidates
    .map(
      (t) => `
Tool: ${t.definition.name}
Description: ${t.definition.description}
Input Schema: ${JSON.stringify(t.definition.parameters?.properties ?? {})}
`,
    )
    .join("\n");

  // ------------------------
  // 4. Prompt 구성
  // ------------------------
  const prompt = `
You are an AI agent.

Intent: ${thought.intent}

Reasoning:
${thought.reasoning}

Context:
${truncate(context)}

Available Tools:
${toolDescriptions}

---

Select the BEST tool and generate arguments.

Rules:
- Use ONLY one tool
- Follow the input schema strictly
- Do NOT hallucinate fields
- Keep arguments minimal and relevant
- Do NOT provide empty values for required fields
- If a required field cannot be filled, do NOT call the tool
`;

  // ------------------------
  // 5. LLM 호출
  // ------------------------

  const res: any = await chatInput(
    prompt,
    zodResponseFormat(ToolActionSchema, "tool_action_schema"),
  );

  const parsed = JSON.parse(res.choices[0].message.content);

  // ------------------------
  // 6. Tool 존재 검증
  // ------------------------
  const selectedTool = candidates.find(
    (t) => t.definition.name === parsed!.tool,
  );
  console.log(selectedTool);

  if (!selectedTool) {
    return fallbackToolAction(candidates);
  }

  // ------------------------
  // 7. args 검증
  // ------------------------
  if (
    !validateArgs(
      selectedTool.definition.parameters?.properties ?? {},
      parsed!.args,
    )
  ) {
    return fallbackToolAction([selectedTool]);
  }

  // ------------------------
  // 8. 정상 반환
  // ------------------------
  return parsed!;
}
