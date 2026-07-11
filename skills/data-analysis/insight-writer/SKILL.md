---
name: insight-writer
description: Write concise, source-traced narrative findings from analysis results, each tied to the computed evidence and any data-quality caveats. Narrative stage of the data-analysis pipeline.
version: 1.0.0
category: data-analysis
tags:
  - data-analysis
  - insight
  - narrative
model: inherit
invokes: []
inputs:
  - analysis_results
  - analysis_request
  - options
outputs:
  - insights
---

# Goal

Translate computed results into clear, honest findings that answer the request, each traced
to its result and carrying relevant caveats. This skill narrates provided results only; it
does not compute or speculate.

# Inputs

```yaml
analysis_results: [ { id, method, table, stat, caveats } ]
analysis_request: { question }
options:
  language: ko
  max_findings: 5
```

# Output

```yaml
insights:
  - finding: <one-sentence insight>
    evidence: <analysis_results id + the stat it rests on>
    caveat: <data-quality limitation or "none">
```

# Workflow

## Step 1 — Rank by relevance
Order results by how directly they answer the question; keep the top `max_findings`.

## Step 2 — Write findings
State each as a single, concrete finding tied to its evidence.

## Step 3 — Attach caveats
Carry forward cleaning/analysis caveats that qualify the finding.

## Step 4 — Return
Return `insights`. Stop.

# Rules

- Use only provided results; never introduce numbers, causes, or predictions not computed.
- Every finding cites its `analysis_results` id and stat.
- Never overstate: correlation is not causation; imputed-heavy metrics get a caveat.
- Neutral, factual tone; no recommendations unless the request asked for them.

# Examples

Input:

```yaml
analysis_results: [ { id: revenue-by-month, method: trend, stat: "+12% MoM", caveats: [] } ]
analysis_request: { question: "월별 매출 추세?" }
options: { language: ko, max_findings: 5 }
```

Output:

```yaml
insights:
  - finding: "매출은 전월 대비 12% 증가하는 상승 추세를 보였다."
    evidence: "revenue-by-month (trend, +12% MoM)"
    caveat: "none"
```
