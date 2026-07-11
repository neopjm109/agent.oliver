import { ComparisonCondition, LogicalCondition } from "./types";

/**
 * ---------------------------------------------------
 * Condition Helpers
 * ---------------------------------------------------
 */

export const eq = (left: string, right: any): ComparisonCondition => ({
  type: "comparison",
  left,
  operator: "==",
  right,
});

export const neq = (left: string, right: any): ComparisonCondition => ({
  type: "comparison",
  left,
  operator: "!=",
  right,
});

export const and = (
  ...conditions: (ComparisonCondition | LogicalCondition)[]
): LogicalCondition => ({
  type: "logical",
  operator: "AND",
  conditions,
});

export const or = (
  ...conditions: (ComparisonCondition | LogicalCondition)[]
): LogicalCondition => ({
  type: "logical",
  operator: "OR",
  conditions,
});
