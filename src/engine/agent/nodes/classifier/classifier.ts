import { zodResponseFormat } from "openai/helpers/zod.js";
import { chatInput } from "../../../client/client";
import { clamp } from "../../utils/utils";
import { Classification, LLMClassification } from "./types";
import z from "zod";

const LLMClassificationSchema = z.object({
  type: z.enum(["simple_query", "complex_spec"]),
  confidence: z.number(),
});

/* -----------------------------
 * 1. Rule Layer (Action Detection)
 * ----------------------------- */

function detectAction(input: string): Classification | null {
  const lower = input.toLowerCase();

  // ------------------------
  // 1. Explicit Actions
  // ------------------------
  if (/검색|찾아줘|알아봐|search|look up|find/.test(lower)) {
    return {
      type: "light_reasoning",
      confidence: 0.9,
      reason: "search_intent",
      suggestedTool: "search_web",
    };
  }

  if (/번역|translate/.test(lower)) {
    return {
      type: "light_reasoning",
      confidence: 0.9,
      reason: "translate_intent",
      suggestedTool: "translate_text",
    };
  }

  // ------------------------
  // 2. External Data Needed
  // ------------------------
  if (/최신|뉴스|가격|날씨|정보/.test(lower)) {
    return {
      type: "light_reasoning",
      confidence: 0.85,
      reason: "external_data_needed",
      suggestedTool: "search_web",
    };
  }

  // ------------------------
  // 3. Creation / Planning
  // ------------------------
  if (/만들어줘|구성해줘|설계해줘/.test(lower) && input.length > 100) {
    return {
      type: "requires_planning",
      confidence: 0.85,
      reason: "creation_large_scope",
    };
  }

  // ------------------------
  // 4. Debug / Analysis
  // ------------------------
  if (/에러|error|버그|debug|왜 안됨/.test(lower)) {
    return {
      type: "light_reasoning",
      confidence: 0.85,
      reason: "debug_intent",
    };
  }

  // ------------------------
  // 5. Simple Intent
  // ------------------------
  if (/차이|비교|vs|difference/.test(lower)) {
    return {
      type: "direct_answer",
      confidence: 0.75,
      reason: "comparison_intent",
    };
  }

  if (/추천|목록|리스트|top|best/.test(lower)) {
    return {
      type: "direct_answer",
      confidence: 0.8,
      reason: "list_request",
    };
  }

  // ------------------------
  // 6. Command Fallback
  // ------------------------
  if (/해줘|부탁해$/.test(lower) && input.length < 100) {
    return {
      type: "light_reasoning",
      confidence: 0.7,
      reason: "single_command",
    };
  }

  return null;
}

/* -----------------------------
 * 2. Heuristic Signals
 * ----------------------------- */

function simpleConfidence(input: string): number {
  let score = 0;

  if (input.length < 200) score += 0.4;
  if (!input.includes("#")) score += 0.15;
  if (!input.includes("```")) score += 0.15;
  if (!input.includes("- ") && !input.includes("1.")) score += 0.15;
  if (input.split("\n").length < 5) score += 0.15;

  return clamp(score);
}

function complexConfidence(input: string): number {
  let score = 0;

  if (input.length > 500) score += 0.4;
  if (input.includes("#")) score += 0.15;
  if (input.includes("```")) score += 0.15;
  if (input.includes("- ") || input.includes("1.")) score += 0.15;
  if (input.split("\n").length > 10) score += 0.15;

  return clamp(score);
}

function planningSignal(input: string): number {
  let score = 0;

  if (/설계|architecture|구성|design/.test(input)) score += 0.4;
  if (/단계|step|process/.test(input)) score += 0.3;
  if (input.length > 300) score += 0.3;

  return clamp(score);
}

function multiActionSignal(input: string): number {
  let score = 0;

  if (/하고 .*해줘/.test(input)) score += 0.4;
  if (/후 .*해줘/.test(input)) score += 0.4;
  if (/다음 .*해줘/.test(input)) score += 0.3;

  return clamp(score);
}

function questionSignal(input: string): boolean {
  return /(\?|뭐야|왜|어떻게|what|why|how)/i.test(input);
}

/* -----------------------------
 * 3. LLM Fallback (placeholder)
 * ----------------------------- */

async function llmClassify(
  input: string,
  simple: number,
  complex: number,
): Promise<LLMClassification> {
  const userPrompt = `
  You are an AI classifier.

Your task is to determine how the input should be handled.

Categories:
- simple_query: can be answered immediately
- actions: needs multi-step planning

---

Heuristic Signals (may be inaccurate):
- simple_score: ${simple}
- complex_score: ${complex}

---

Input:
${input}

---

Rules:
- Do NOT blindly follow heuristic scores
- Focus on user intent and required actions
- If multi-step solution is needed → complex_spec
- If answer can be given directly → simple_query
  `;

  const result = await chatInput(
    userPrompt,
    zodResponseFormat(LLMClassificationSchema, "llm_classification_schema"),
  );

  return JSON.parse(result.choices[0].message?.content || "");
}

/* -----------------------------
 * 4. Main Classifier
 * ----------------------------- */

// 분류
export async function classify(input: string): Promise<Classification> {
  // 🔥 1. Rule First (가장 중요)
  const action = detectAction(input);
  if (action) return action;

  // 🔥 2. Heuristic 계산
  const s = simpleConfidence(input);
  const c = complexConfidence(input);
  const p = planningSignal(input);
  const m = multiActionSignal(input);

  const planningScore = clamp(p + m * 0.5);

  if (questionSignal(input) && planningScore < 0.4) {
    return {
      type: "direct_answer",
      confidence: 0.8,
      reason: "question_pattern",
    };
  }

  // 🔥 3. direct_answer
  if (s > 0.7 && planningScore < 0.3) {
    return {
      type: "direct_answer",
      confidence: s,
      reason: "simple_high_confidence",
      scores: { simple: s, complex: c, planning: planningScore },
    };
  }

  // 🔥 4. requires_planning
  if (planningScore > 0.6 || c > 0.7) {
    return {
      type: "requires_planning",
      confidence: Math.max(planningScore, c),
      reason: "planning_detected",
      scores: { simple: s, complex: c, planning: planningScore },
    };
  }

  // 🔥 5. 애매 → LLM
  const llm = await llmClassify(input, s, c);

  return {
    ...llm,
    scores: { simple: s, complex: c, planning: planningScore },
  };
}
