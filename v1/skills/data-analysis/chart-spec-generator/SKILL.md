---
name: chart-spec-generator
description: Turn analysis results into chart specifications (chart type, data encoding, axes, series) consumable by web/chart-generator. Produces specs, not rendered charts or React code.
version: 1.0.0
category: data-analysis
tags:
  - data-analysis
  - chart
  - visualization
  - spec
model: inherit
invokes: []
inputs:
  - analysis_results
  - options
outputs:
  - chart_specs
---

# Goal

Choose an appropriate visualization for each analysis result and express it as a declarative
chart spec. This skill specifies charts; it does not render them or emit component code —
`web/chart-generator` consumes these specs to build actual charts.

# Inputs

```yaml
analysis_results: [ { id, method, table, stat } ]
options:
  library_hint: recharts   # optional target library convention
```

# Output

```yaml
chart_specs:
  - id: <slug>
    chart_type: line | bar | area | scatter | pie
    title: <chart title>
    encoding: { x: <field>, y: <field>, series: <field or null> }
    data_ref: <analysis_results id>
    rationale: <why this chart fits the result>
```

# Workflow

## Step 1 — Pick a chart type
Match the analysis method to a chart (trend→line, comparison→bar, relationship→scatter,
composition→pie/stacked).

## Step 2 — Define encoding
Map table fields to axes/series; set a clear title.

## Step 3 — Return
Return `chart_specs`. Stop.

# Rules

- Produce specs only; never render charts or write React/`chart-generator` code.
- Choose chart types honestly (no pie charts for many categories; no dual-axis unless
  justified).
- Reference the source `analysis_results` id via `data_ref`; do not duplicate the data.
- Keep specs library-agnostic; `library_hint` only tweaks naming conventions.

# Examples

Input:

```yaml
analysis_results: [ { id: revenue-by-month, method: trend, table: [...], stat: "+12% MoM" } ]
options: { library_hint: recharts }
```

Output:

```yaml
chart_specs:
  - id: chart-revenue-trend
    chart_type: line
    title: "월별 매출 추세"
    encoding: { x: month, y: revenue, series: null }
    data_ref: revenue-by-month
    rationale: "Time-ordered metric → line chart best shows the trend."
```
