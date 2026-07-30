---
name: risk-scorer
description: Assign a risk level to each compliance gap from severity and likelihood, producing a comparable risk rating for prioritization. Scoring stage of the audit pipeline.
version: 1.0.0
category: audit
tags:
  - audit
  - risk
  - scoring
  - prioritization
model: inherit
invokes: []
inputs:
  - gaps
  - rules
  - options
outputs:
  - scored_gaps
---

# Goal

Rate each gap's risk so findings can be prioritized. Combines the rule's severity with an
impact/likelihood assessment into a single comparable level. This skill scores only; it
does not describe gaps or write the report.

# Inputs

```yaml
gaps: [ { rule_id, requirement, gap, remediation }, ... ]
rules: [ { id, severity }, ... ]
options:
  scale: high-medium-low   # scoring scale
```

# Output

```yaml
scored_gaps:
  - rule_id: <id>
    gap: <carried through from input, unchanged>
    remediation: <carried through from input, unchanged>
    severity: <from rule>
    likelihood: high | medium | low
    risk: high | medium | low
    rationale: <one line: why this level>
```

# Workflow

## Step 1 — Inherit severity
Take each gap's rule severity as the impact axis.

## Step 2 — Assess likelihood
Judge how likely the gap leads to a real violation/harm given the document's context.

## Step 3 — Combine
Map (severity × likelihood) to a final `risk` level using a fixed matrix (e.g. high
severity + any non-low likelihood → high risk).

## Step 4 — Return
Return `scored_gaps`. Stop.

# Rules

- Score only provided gaps; never introduce new gaps or edit descriptions. Carry each gap's `gap` and `remediation` text through unchanged so the report stage can render them.
- Use a fixed, stated matrix so scoring is deterministic and reproducible.
- Every score needs a one-line rationale.
- Do not recommend remediation (already provided) or assemble the report.

# Examples

Input:

```yaml
gaps:
  - { rule_id: RULE-destroy-after-purpose, requirement: "Destroy data after purpose.", gap: "No destruction procedure.", remediation: "Add destruction clause." }
rules: [ { id: RULE-destroy-after-purpose, severity: high } ]
options: { scale: high-medium-low }
```

Output:

```yaml
scored_gaps:
  - rule_id: RULE-destroy-after-purpose
    gap: "파기 절차 부재"
    remediation: "목적 종료 후 파기 시한·방법 조항 추가"
    severity: high
    likelihood: high
    risk: high
    rationale: "High-severity legal obligation with no procedure in place; violation is likely on audit."
```
