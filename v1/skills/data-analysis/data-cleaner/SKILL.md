---
name: data-cleaner
description: Produce a cleaning plan and a cleaned dataset from a profile — handling missing values, duplicates, type coercion, and outliers — while reporting every transformation applied. Runs after profiling.
version: 1.0.0
category: data-analysis
tags:
  - data-analysis
  - cleaning
  - preprocessing
model: inherit
invokes: []
inputs:
  - dataset
  - profile
  - options
outputs:
  - cleaned
---

# Goal

Transform a dataset into an analysis-ready form, guided by its profile, and report exactly
what changed. This skill cleans transparently; it never silently alters data or draws
conclusions.

# Inputs

```yaml
dataset: { rows: [...] }
profile: { columns: [...], warnings: [...] }
options:
  missing_strategy: median   # median | mean | drop-row | keep
  dedupe: true
  outlier_policy: keep       # keep | flag | winsorize
```

# Output

```yaml
cleaned:
  rows: [ {...}, ... ]
  transformations:
    - { column: <name>, action: <impute-median | drop-duplicates | coerce-type | winsorize>, affected: <n> }
  dropped_rows: <n>
  notes: [<caveat for analysis/report>, ...]
```

# Workflow

## Step 1 — Plan from profile
Decide actions per column from the profile warnings and `options` (impute missing, coerce
types, handle duplicates/outliers).

## Step 2 — Apply & record
Apply each transformation and record it with the affected count.

## Step 3 — Surface caveats
Note anything that could bias analysis (e.g. high imputation rate) in `notes`.

## Step 4 — Return
Return `cleaned`. Stop.

# Rules

- Record every transformation; never change data without an entry in `transformations`.
- Do not fabricate values beyond the stated `missing_strategy`; if data is too sparse to
  clean safely, keep it and add a note rather than inventing.
- Do not analyze or draw conclusions — that is `data-analyzer`.
- Preserve the original when `keep` strategies are chosen.

# Examples

Input:

```yaml
dataset: { rows: [ { revenue: 1000 }, { revenue: null }, { revenue: 1000 } ] }
profile: { columns: [ { name: revenue, type: numeric, missing_pct: 33 } ], warnings: [ "revenue: 33% missing" ] }
options: { missing_strategy: median, dedupe: true, outlier_policy: keep }
```

Output:

```yaml
cleaned:
  rows: [ { revenue: 1000 }, { revenue: 1000 } ]
  transformations:
    - { column: revenue, action: impute-median, affected: 1 }
    - { column: "-", action: drop-duplicates, affected: 1 }
  dropped_rows: 1
  notes: [ "33% of revenue imputed with median; interpret revenue trends with caution." ]
```
