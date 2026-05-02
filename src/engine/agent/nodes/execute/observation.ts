import { zodResponseFormat } from "openai/helpers/zod.js";
import { chatInput } from "../../../client/client";
import { safeToLowerCase, truncate } from "../../utils/utils";
import {
  Observation,
  ObservationInput,
  ObservationSignals,
  ObservationSummarySchema,
  ObservationType,
} from "./types";

// ======================================================
// Success Detection
// ======================================================

function detectSuccess(result: string): boolean {
  if (!result || result.trim().length === 0) return false;

  const failPatterns = [
    "error",
    "exception",
    "failed",
    "not found",
    "undefined",
    "null",
  ];

  const lower = safeToLowerCase(result);

  return !failPatterns.some((p) => lower.includes(p));
}

// ======================================================
// Type Detection
// ======================================================

function detectType(result: string, success: boolean): ObservationType {
  if (!success) return "error";

  if (result.length < 30) return "partial";

  return "info";
}

// ======================================================
// Completeness
// ======================================================

function estimateCompleteness(result: string): number {
  if (!result) return 0;

  const len = result.length;

  if (len > 500) return 1;
  if (len > 200) return 0.7;
  if (len > 50) return 0.4;

  return 0.2;
}

// ======================================================
// Relevance
// ======================================================

function estimateRelevance(summary: string, context: string): number {
  if (!summary || !context) return 0.5;

  const summaryTokens = summary.split(/\s+/).slice(0, 8);

  let score = 0;

  for (const token of summaryTokens) {
    if (context.includes(token)) {
      score += 0.1;
    }
  }

  return Math.min(score, 1);
}

// ======================================================
// Reliability
// ======================================================

function estimateReliability(tool: string): number {
  const map: Record<string, number> = {
    web_search: 0.6,
    code_executor: 0.9,
    json_validator: 0.95,
    db_query: 0.85,
    api_call: 0.8,
  };

  return map[tool] ?? 0.7;
}

// ======================================================
// Retry Hint Generator
// ======================================================

function generateRetryHint(
  tool: string,
  result: string,
  success: boolean,
): string | undefined {
  if (success) return undefined;

  const lower = safeToLowerCase(result);

  if (lower.includes("not found")) {
    return "Try different keywords or broaden the search query.";
  }

  if (lower.includes("timeout")) {
    return "Retry the request or reduce query complexity.";
  }

  if (lower.includes("invalid")) {
    return "Check input format and required fields.";
  }

  return "Retry with adjusted parameters.";
}

// ======================================================
// LLM Summary
// ======================================================

async function generateSummary(
  tool: string,
  result: string,
  context: string,
): Promise<string> {
  const prompt = `
Summarize the tool result.

Tool: ${tool}

Result:
${truncate(result, 1500)}

Context:
${truncate(context, 500)}

---

Rules:
- Max 2 sentences
- Focus only on useful information
- Remove noise and repetition

Output plain text only.
`;

  const res: any = await chatInput(
    prompt,
    zodResponseFormat(ObservationSummarySchema, "observation_summary_schema"),
  );

  const parsed = JSON.parse(res.choices[0].message.content);

  return parsed.summary;
}

// ======================================================
// Fallback Summary
// ======================================================

function fallbackSummary(result: string): string {
  if (!result) return "No result returned.";

  return truncate(result, 200);
}

// ======================================================
// Main Observation Builder
// ======================================================

export async function createObservation(
  input: ObservationInput,
): Promise<Observation> {
  const { tool, result, context } = input;

  // ------------------------
  // 1. raw
  // ------------------------
  const raw = result ?? "";

  // ------------------------
  // 2. success
  // ------------------------
  const success = detectSuccess(raw);

  // ------------------------
  // 3. summary
  // ------------------------
  let summary: string;

  if (success) {
    summary = await generateSummary(tool, raw, context);
  } else {
    summary = "Tool execution failed or returned invalid result.";
  }

  if (!summary || summary.length < 10) {
    summary = fallbackSummary(raw);
  }

  // ------------------------
  // 4. type
  // ------------------------
  const type = detectType(raw, success);

  // ------------------------
  // 5. signals
  // ------------------------
  const completeness = estimateCompleteness(raw);
  const relevance = estimateRelevance(summary, context);
  const reliability = estimateReliability(tool);

  const signals: ObservationSignals = {
    relevance,
    reliability,
    completeness,
  };

  // ------------------------
  // 6. retry hint
  // ------------------------
  const retryHint = generateRetryHint(tool, raw, success);

  // ------------------------
  // 7. normalize summary length
  // ------------------------
  summary = truncate(summary, 300);

  // ------------------------
  // 8. return
  // ------------------------
  return {
    raw,
    summary,
    success,
    type,
    signals,
    retryHint,
  };
}
