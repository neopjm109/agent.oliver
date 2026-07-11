---
name: data-analysis-validator
description: Validate an analysis report for source-traceability of findings, chart-spec validity against real columns, numeric reconciliation between findings and result tables, and disclosure of cleaning transformations, returning a deterministic pass/fail report. Final stage of the data-analysis pipeline.
version: 1.0.0
category: data-analysis
tags:
  - data-analysis
  - validation
  - source-traceability
  - final-output
model: inherit
invokes: []
inputs:
  - analysis_report
  - analysis_results
  - analysis_request
outputs:
  - validation_result
---

# Goal

Verify that an analysis report is grounded in its computed results before use, returning a
deterministic pass/fail verdict with specific violations. This validates the report against
the analyzer's outputs; it does not profile, clean, analyze, or fix. It checks *traceability
and internal consistency*, not statistical methodology or causal validity (analytical
judgment is out of scope).

# Scope

- Source-traceability (every finding traces to a computed result/table)
- Chart validity (every chart spec's fields exist in the analyzed columns; type fits the data)
- Numeric reconciliation (values cited in findings/summary match the result tables)
- Disclosure (cleaning transformations are carried into `data_quality`)
- Request coverage (requested metrics/dimensions are addressed or noted unavailable)

Out of scope: correctness of statistical method, causal claims validity, chart rendering
(see `web/chart-generator`), external benchmarks, runtime code.

# Checks

1. Every entry in `findings` (and every number in `summary`) references a value present in
   `analysis_results` — no orphan claim.
2. Every chart spec's `x`/`y`/`series` fields exist among the analyzed columns, and the chart
   type is valid for those field types.
3. Numbers cited in the narrative equal the corresponding `analysis_results` values (within a
   stated rounding tolerance) — no contradiction.
4. Every transformation in cleaning is disclosed in `analysis_report.data_quality`; no silent
   mutation.
5. Each requested `metric`/`dimension` is either addressed or explicitly marked unavailable.

# Pass/Fail Criteria

- **pass**: all checks succeed.
- **fail**: any unsourced finding, chart referencing a nonexistent column, numeric
  contradiction, undisclosed transformation, or silently dropped request item.

# Output Schema

```yaml
validation_result:
  result: pass | fail
  violations:
    - { area: finding | chart | numeric | disclosure | coverage, ref: <id/field>, issue: <what failed> }
  stats: { findings: <n>, charts: <n>, unsourced: <n>, numeric_mismatches: <n> }
```

# Rules

- Report violations only; never modify the report.
- Deterministic verdict: any single violation forces `fail`.
- Reconcile numbers against `analysis_results`, not against outside expectations.
- Do not judge analytical method or causality — only traceability and internal consistency.

# Examples

Input:

```yaml
analysis_report:
  summary: "하반기 매출 +12%, 12월 최고."
  findings: [ { text: "12월 매출 5,000만원", ref: agg-1 },
              { text: "이탈률 20% 감소", ref: null } ]
  charts: [ { type: line, x: month, y: revenue } ]
analysis_results:
  agg-1: { month: "12", revenue: 50000000 }
  columns: [month, revenue]        # no churn column
analysis_request: { metrics: [revenue, churn], dimensions: [month] }   # churn requested but not analyzed
```

Output:

```yaml
validation_result:
  result: fail
  violations:
    - { area: finding, ref: "이탈률 20% 감소", issue: "no analysis_results reference (unsourced)" }
    - { area: coverage, ref: churn, issue: "requested metric 'churn' neither analyzed nor marked unavailable" }
  stats: { findings: 2, charts: 1, unsourced: 1, numeric_mismatches: 0 }
```
