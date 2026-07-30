---
name: data-analysis-orchestrator
description: Coordinate the end-to-end data-analysis pipeline that turns a dataset into a profiled, cleaned, analyzed result with chart specs and a written insight report. Use for exploratory/analytical reporting on tabular data, not code generation. Entrypoint of the data-analysis domain.
version: 1.0.0
category: data-analysis
tags:
  - data-analysis
  - orchestrator
  - analytics
  - reporting
  - pipeline
  - entrypoint
model: inherit
invokes:
  - docs-analyze-xlsx
  - docs-analyze-csv
  - docs-analyze-markdown
  - dataset-profiler
  - data-cleaner
  - data-analyzer
  - chart-spec-generator
  - insight-writer
  - analysis-report-generator
  - data-analysis-validator
inputs:
  - analysis_request
  - dataset
  - options
outputs:
  - analysis_report
---

# Goal

Produce an analytical report from a dataset by orchestrating specialized data-analysis
skills. This skill **never analyzes data directly** — it sequences profiling, cleaning,
analysis, charting, and narrative, delegating each stage, and returns the assembled report.
It produces analysis and chart specs; it never renders charts or generates runtime code.

# Inputs

```yaml
analysis_request:
  question: "월별 매출 추세와 지역별 편차를 알고 싶다"
  metrics: [revenue]           # optional focus
  dimensions: [month, region]  # optional grouping
dataset:
  source: sales.xlsx           # a document, or inline rows
  inline_rows: []              # optional pre-parsed rows
options:
  language: ko
  output_format: markdown
```

# Output

```yaml
analysis_report:
  summary: <one-paragraph answer to the question>
  findings: [<insight, source-traced>, ...]
  charts: [<chart spec for web/chart-generator>, ...]
  data_quality: <notes from cleaning>
  tables: [<aggregated result table>, ...]
  validation: <pass/fail + violations from data-analysis-validator>
```

# Workflow

## Step 1 — Ingest the dataset
If `dataset.source` is a document, invoke the matching `docs-analyze-*` skill (`docs-analyze-csv`
for CSV/TSV, `docs-analyze-xlsx` for spreadsheets, `docs-analyze-markdown` for a markdown doc whose tables carry the data). Otherwise use `inline_rows`.

## Step 2 — Profile
Invoke `dataset-profiler` to describe shape, column types, missingness, and distributions.

## Step 3 — Clean
Invoke `data-cleaner` to produce a cleaning plan and a cleaned dataset, reporting every
transformation (never silently mutate).

## Step 4 — Analyze
Invoke `data-analyzer` to compute aggregations, trends, correlations, and segments relevant
to the request.

## Step 5 — Chart specs & insights
Invoke `chart-spec-generator` to produce chart specifications for key results, and
`insight-writer` to write source-traced narrative findings.

## Step 6 — Assemble
Invoke `analysis-report-generator` to combine tables, charts, and insights into the report.

## Step 7 — Validate
Invoke `data-analysis-validator` on the report + `analysis_results` to verify source-traceability
of findings, chart-spec validity, numeric reconciliation, and disclosure of cleaning (pass/fail).

## Step 8 — Return
Return `analysis_report` including the validation verdict. The pipeline ends here.

# Rules

- This skill only coordinates. Delegate every stage; never profile, clean, analyze, chart,
  or narrate directly.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Never render charts — `chart-spec-generator` produces specs; actual React charts are
  `web/chart-generator`. Never generate runtime code.
- Every finding must trace to a computed result; never state conclusions the data does not
  support, and surface data-quality caveats from cleaning.
- Error handling: if ingestion fails, stop and report. If a downstream stage fails, return
  the partial report and mark the incomplete stage.

# Examples

Input:

```yaml
analysis_request: { question: "월별 매출 추세?", metrics: [revenue], dimensions: [month] }
dataset: { source: sales.xlsx }
options: { language: ko, output_format: markdown }
```

Output (abridged):

```
✔ ingest  → sales.xlsx → 1,204 rows × 6 cols
✔ profile → revenue: numeric, 0.5% missing; month: 12 categories
✔ clean   → imputed 6 missing revenue (median), removed 3 duplicates
✔ analyze → monthly revenue trend +12% H2, peak in December
✔ charts  → 1 line chart (month × revenue)
✔ insights→ 3 findings
✔ report  → assembled
✔ validate→ data-analysis-validator: pass (3/3 findings source-traced, chart cols valid, numbers reconciled)

Summary: 하반기 매출이 상반기 대비 12% 증가, 12월 최고치. 데이터 품질: 결측 0.5% 보정.
```
