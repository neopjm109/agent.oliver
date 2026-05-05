import { zodResponseFormat } from "openai/helpers/zod.js";
import { chatInput } from "../../../client/client";
import { clamp } from "../../utils/utils";
import { Classification, LLMClassification } from "./types";
import z from "zod";

const LLMClassificationSchema = z.object({
  type: z.enum(["simple_query", "complex_spec"]),
  confidence: z.number(),
});

// 단순 질문 확인용 점수
function simpleConfidence(input: string): number {
  let score = 0;

  if (input.length < 200) score += 0.4;
  if (!input.includes("#")) score += 0.15;
  if (!input.includes("```")) score += 0.15;
  if (!input.includes("- ") && !input.includes("1.")) score += 0.15;
  if (input.split("\n").length < 5) score += 0.15;

  return clamp(score);
}

// 복잡 질문 확인용 점수
function complexConfidence(input: string): number {
  let score = 0;

  if (input.length > 500) score += 0.4;
  if (input.includes("#")) score += 0.15;
  if (input.includes("```")) score += 0.15;
  if (input.includes("- ") || input.includes("1.")) score += 0.15;
  if (input.split("\n").length > 10) score += 0.15;

  return clamp(score);
}

// llm 판단
async function llmClassify(input: string): Promise<LLMClassification> {
  const userPrompt = `
  You are an AI classifier.

Your task is to determine how the input should be handled.

Categories:
- simple_query: can be answered immediately
- actions: needs multi-step planning

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

// 분류
export async function classify(input: string): Promise<Classification> {
  const s = simpleConfidence(input);
  const c = complexConfidence(input);

  const diff = Math.abs(s - c);

  // ------------------------
  // 1. Rule로 충분히 확신 있는 경우
  // ------------------------
  if (diff > 0.4) {
    const type = s > c ? "simple_query" : "complex_spec";
    const confidence = diff;

    return {
      type,
      confidence: clamp(confidence),
      scores: { simple: s, complex: c },
      reason: "rule_high_confidence",
    };
  }

  // ------------------------
  // 2. 애매 → LLM 호출
  // ------------------------
  const llm = await llmClassify(input);

  let finalSimple =
    0.6 * s +
    0.4 * (llm.type === "simple_query" ? llm.confidence : 1 - llm.confidence);
  let finalComplex =
    0.6 * c +
    0.4 * (llm.type === "complex_spec" ? llm.confidence : 1 - llm.confidence);

  // ------------------------
  // 3. disagreement 패널티
  // ------------------------
  const ruleType = s > c ? "simple_query" : "complex_spec";

  if (ruleType !== llm.type) {
    finalSimple -= 0.15;
    finalComplex -= 0.15;
  }

  finalSimple = clamp(finalSimple);
  finalComplex = clamp(finalComplex);

  const finalDiff = Math.abs(finalSimple - finalComplex);

  // ------------------------
  // 4. 최종 결정 (안전 fallback 포함)
  // ------------------------
  if (finalDiff < 0.2) {
    return {
      type: "complex_spec", // 🔥 안전 fallback
      confidence: finalDiff,
      scores: {
        simple: finalSimple,
        complex: finalComplex,
      },
      reason: "low_confidence_fallback",
    };
  }

  const finalType =
    finalSimple > finalComplex ? "simple_query" : "complex_spec";

  return {
    type: finalType,
    confidence: finalDiff,
    scores: {
      simple: finalSimple,
      complex: finalComplex,
    },
    reason: "hybrid_decision",
  };
}
