---
name: dataset-profiler
description: Profile a tabular dataset — shape, per-column type, missingness, cardinality, ranges, and distributions — to characterize it before cleaning and analysis. First stage of the data-analysis pipeline.
version: 1.0.0
category: data-analysis
tags:
  - data-analysis
  - profiling
  - eda
model: inherit
invokes: []
inputs:
  - dataset
  - options
outputs:
  - profile
---

# Goal

Describe a dataset's structure and quality so downstream stages know what they are working
with. This skill measures and reports; it does not clean or analyze.

# Inputs

```yaml
dataset:
  rows: [ {...}, ... ]   # parsed rows
options:
  sample_limit: 100000   # optional cap for profiling large sets
```

# Output

```yaml
profile:
  shape: { rows: <n>, columns: <n> }
  columns:
    - name: revenue
      type: numeric | categorical | datetime | boolean | text
      missing_pct: <0..100>
      cardinality: <distinct count>
      stats: { min, max, mean, median, p95 }   # numeric
      top_values: [ { value, count } ]          # categorical
  warnings: [<e.g. "high missingness in col X">, ...]
```

# Workflow

## Step 1 — Infer types
Detect each column's type from its values.

## Step 2 — Measure quality & distribution
Compute missing %, cardinality, and type-appropriate stats (numeric ranges; categorical top
values; datetime spans).

## Step 3 — Flag warnings
Note high missingness, constant columns, likely IDs, and suspected outliers.

## Step 4 — Return
Return `profile`. Stop.

# Rules

- Measure only; never impute, drop, or transform data.
- Report stats faithfully; do not round away signal or hide outliers.
- Flag quality issues as warnings for the cleaner rather than acting on them.
- Sample transparently: if `sample_limit` applied, state it in warnings.

# Examples

Input:

```yaml
dataset: { rows: [ { month: "2024-01", revenue: 1000, region: "Seoul" }, { month: "2024-01", revenue: null, region: "Busan" } ] }
options: { sample_limit: 100000 }
```

Output:

```yaml
profile:
  shape: { rows: 2, columns: 3 }
  columns:
    - { name: month, type: datetime, missing_pct: 0, cardinality: 1 }
    - { name: revenue, type: numeric, missing_pct: 50, cardinality: 1, stats: { min: 1000, max: 1000, mean: 1000, median: 1000 } }
    - { name: region, type: categorical, missing_pct: 0, cardinality: 2, top_values: [ { value: Seoul, count: 1 }, { value: Busan, count: 1 } ] }
  warnings: [ "revenue: 50% missing" ]
```
