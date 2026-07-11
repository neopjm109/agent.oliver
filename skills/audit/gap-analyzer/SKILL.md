---
name: gap-analyzer
description: For each non-compliant or partial conformance result, describe the compliance gap, its likely cause, and a concrete remediation. Turns raw verdicts into actionable findings.
version: 1.0.0
category: audit
tags:
  - audit
  - gap-analysis
  - remediation
model: inherit
invokes: []
inputs:
  - conformance_results
  - rules
  - options
outputs:
  - gaps
---

# Goal

Convert non-compliant and partial verdicts into described gaps, each with the missing
requirement and a concrete remediation. This skill explains and recommends fixes; it does
not re-decide conformance or assign final risk scores.

# Inputs

```yaml
conformance_results: [ { rule_id, status, evidence, note }, ... ]
rules: [ { id, text, severity }, ... ]     # for the obligation text
options:
  language: en
```

# Output

```yaml
gaps:
  - rule_id: <id>
    requirement: <the obligation not fully met>
    gap: <what is missing or wrong, in one sentence>
    remediation: <concrete corrective action>
    evidence: [<clause id>, ...]
```

# Workflow

## Step 1 — Select gaps
Take only `non-compliant` and `partial` results; ignore `compliant` and `not-applicable`.

## Step 2 — Describe each gap
State the requirement (from the rule text) and precisely what the document lacks or
contradicts, referencing the checker's evidence and note.

## Step 3 — Recommend remediation
Give one concrete, actionable corrective step per gap.

## Step 4 — Return
Return the `gaps` list. Stop. Risk scoring happens downstream.

# Rules

- Operate only on provided verdicts; never re-evaluate conformance.
- One gap per non-compliant/partial rule; keep gap and remediation to single sentences.
- Remediation must be concrete (what to add/change), not "review this".
- Do not assign risk levels — that is risk-scorer's job.

# Examples

Input:

```yaml
conformance_results:
  - { rule_id: RULE-destroy-after-purpose, status: non-compliant, evidence: [], note: "No clause addresses destruction after purpose." }
rules:
  - { id: RULE-destroy-after-purpose, text: "Destroy data without delay after the purpose is achieved.", severity: high }
options: { language: en }
```

Output:

```yaml
gaps:
  - rule_id: RULE-destroy-after-purpose
    requirement: "Destroy data without delay after the purpose is achieved."
    gap: "The policy defines no data-destruction procedure tied to purpose completion."
    remediation: "Add a clause specifying destruction within a fixed window after the processing purpose ends, including the method."
    evidence: []
```
