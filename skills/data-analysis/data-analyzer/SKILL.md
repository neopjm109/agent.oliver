---
name: data-analyzer
description: Compute the analysis a request calls for — aggregations, trends, correlations, and segment comparisons — over the cleaned dataset, returning result tables with the method used. Core computation stage of the data-analysis pipeline.
version: 1.0.0
category: data-analysis
tags:
  - data-analysis
  - aggregation
  - trend
  - correlation
model: inherit
invokes: []
inputs:
  - cleaned
  - analysis_request
  - options
outputs:
  - analysis_results
---

# Goal

Answer the analytical question by computing aggregations, trends, correlations, and segment
comparisons over the cleaned data, returning result tables annotated with method. This skill
computes; narrative and charts are downstream.

# Inputs

```yaml
cleaned: { rows: [...], notes: [...] }
analysis_request: { question, metrics: [revenue], dimensions: [month, region] }
options:
  top_n: 10
```

# Output

```yaml
analysis_results:
  - id: <slug>
    method: aggregation | trend | correlation | segmentation
    query: <what was computed, in words>
    table: [ { <dimension>: ..., <metric>: ... }, ... ]
    stat: <e.g. "+12% H2 over H1", "r=0.62">
    caveats: [<from cleaning notes if relevant>, ...]
```

# Workflow

## Step 1 — Select analyses
From the request's metrics/dimensions, choose the computations that answer the question.

## Step 2 — Compute
Aggregate metrics by dimensions; compute trends over time; correlations between numerics;
compare segments. Respect `top_n`.

## Step 3 — Annotate
Attach the method and a headline stat to each result; carry forward relevant cleaning
caveats.

## Step 4 — Return
Return `analysis_results`. Stop.

# Rules

- Compute only from the cleaned data; never introduce external numbers or assumptions.
- State the method and enough of the query that results are reproducible.
- Distinguish correlation from causation; never claim causation.
- Carry data-quality caveats into results that they affect.

# Examples

Input:

```yaml
cleaned: { rows: [ { month: "2024-01", revenue: 1000 }, { month: "2024-02", revenue: 1120 } ] }
analysis_request: { question: "월별 매출 추세?", metrics: [revenue], dimensions: [month] }
options: { top_n: 10 }
```

Output:

```yaml
analysis_results:
  - id: revenue-by-month
    method: trend
    query: "sum(revenue) grouped by month, ordered chronologically"
    table: [ { month: "2024-01", revenue: 1000 }, { month: "2024-02", revenue: 1120 } ]
    stat: "+12% month-over-month"
    caveats: []
```
