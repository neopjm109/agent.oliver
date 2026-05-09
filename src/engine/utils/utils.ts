// import { TokenUsage } from "../types";
import { exec } from "child_process";
import { promisify } from "util";

// 점수 최소값, 최대값 제어
export function clamp(n: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, n));
}

// 최대 길이 자르기
export function truncate(text: string, max = 1000): string {
  if (text.length <= max) return text;
  return text.slice(0, max);
}

export function safeToLowerCase(text: string): string {
  return (text || "").toLowerCase();
}

// 토큰 사용량 계산
// export const calculateTotalTokenUsage = (
//   origin: TokenUsage,
//   source: TokenUsage,
// ) => {
//   const promptTokens = origin.promptTokens + source.promptTokens;
//   const completionTokens = origin.completionTokens + source.completionTokens;
//   const totalTokens = origin.totalTokens + source.totalTokens;
//   const estimatedCost =
//     origin.estimatedCost || 0 + (totalTokens / 1000000) * 0.01;
//   return {
//     promptTokens,
//     completionTokens,
//     totalTokens,
//     estimatedCost,
//   };
// };

export const execAsync = promisify(exec);
