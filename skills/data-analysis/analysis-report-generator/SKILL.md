---
name: analysis-report-generator
description: Assemble the final analysis report from insights, result tables, chart specs, and data-quality notes into a structured, human-readable document. Final stage of the data-analysis pipeline.
version: 1.0.0
category: data-analysis
tags:
  - data-analysis
  - report
  - synthesis
  - final-output
model: inherit
invokes: []
inputs:
  - insights
  - analysis_results
  - chart_specs
  - cleaned
  - options
outputs:
  - analysis_report
---

# Goal

Combine upstream outputs into a single report that answers the analytical question. This
skill assembles and formats provided data only; it does not compute, re-analyze, or add
findings.

# Inputs

```yaml
insights: [ { finding, evidence, caveat } ]
analysis_results: [ { id, table, stat } ]
chart_specs: [ { id, chart_type, title, data_ref } ]
cleaned: { notes: [...] }        # data-quality caveats
options:
  language: ko
  output_format: markdown
```

# Output

```yaml
analysis_report:
  summary: <one-paragraph answer>
  findings: [<insight>, ...]
  charts: [<chart spec>, ...]
  tables: [<result table>, ...]
  data_quality: [<cleaning note>, ...]
```

# Workflow

## Step 1 — Summary
Open with a one-paragraph answer to the question, grounded in the insights.

## Step 2 — Body
Lay out findings, then reference charts (by spec) and supporting tables.

## Step 3 — Data quality
Append cleaning/analysis caveats so readers know the limitations.

## Step 4 — Return
Return `analysis_report`. Stop.

# Rules

- Assemble provided data only; never re-analyze, re-chart, or invent findings.
- Always include the `data_quality` section when cleaning notes exist.
- Reference charts by their spec (for `web/chart-generator`); do not render them.
- Neutral tone; conclusions must match the insights, not exceed them.

# Examples

Input:

```yaml
insights: [ { finding: "매출은 전월 대비 12% 증가.", evidence: "revenue-by-month", caveat: "none" } ]
analysis_results: [ { id: revenue-by-month, table: [...], stat: "+12% MoM" } ]
chart_specs: [ { id: chart-revenue-trend, chart_type: line, title: "월별 매출 추세", data_ref: revenue-by-month } ]
cleaned: { notes: [ "33% of revenue imputed." ] }
options: { language: ko, output_format: markdown }
```

Output (abridged):

```yaml
analysis_report:
  summary: "월별 매출은 전월 대비 12% 증가하는 상승 추세를 보였다."
  findings: [ "매출은 전월 대비 12% 증가." ]
  charts: [ { id: chart-revenue-trend, chart_type: line, title: "월별 매출 추세" } ]
  tables: [ { id: revenue-by-month } ]
  data_quality: [ "revenue 33% 결측 → 중앙값 보정; 추세 해석에 주의." ]
```
