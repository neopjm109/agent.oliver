---
name: ruleset-loader
description: Normalize a ruleset (regulation, policy, standard, or checklist) into a flat list of individually-checkable rules with stable IDs and severity. First stage of the audit pipeline.
version: 1.0.0
category: audit
tags:
  - audit
  - ruleset
  - normalization
model: inherit
invokes: []
inputs:
  - ruleset_material
  - options
outputs:
  - rules
---

# Goal

Turn a ruleset — however it arrives (extracted regulation text, a policy document, a
standard, or an inline checklist) — into a flat, deduplicated list of atomic rules, each
with a stable ID and severity. This skill structures rules only; it does not check them.

# Inputs

```yaml
ruleset_material:
  facts: [<extracted regulation/policy statement>, ...]   # from docs-analyze
  inline_rules: []                                        # optional pre-structured rules
options:
  default_severity: medium   # optional when a rule has no stated severity
```

# Output

```yaml
rules:
  - id: <stable slug, e.g. RULE-retention-notice>
    text: <the single obligation, as one checkable statement>
    severity: high | medium | low
    source_ref: <pointer into ruleset_material>
    applies_when: <condition or "always">
```

# Workflow

## Step 1 — Split into atomic obligations
Break compound statements into one obligation per rule ("shall X and Y" → two rules).

## Step 2 — Assign IDs and severity
Give each rule a stable, descriptive ID. Use stated severity; otherwise
`options.default_severity`.

## Step 3 — Deduplicate
Merge rules that express the same obligation, keeping the strictest severity.

## Step 4 — Return
Return the `rules` list. Stop. Conformance evaluation happens downstream.

# Rules

- Produce checkable rules only; never evaluate whether the target complies.
- One obligation per rule; do not bundle multiple requirements.
- IDs must be stable and human-readable so findings are traceable.
- Do not invent obligations not present in the ruleset material.

# Examples

Input:

```yaml
ruleset_material:
  facts:
    - "The controller shall notify the data subject of the retention period and shall destroy data without delay after the purpose is achieved."
options: { default_severity: high }
```

Output:

```yaml
rules:
  - { id: RULE-retention-notice, text: "Notify the data subject of the retention period.", severity: high, source_ref: "fact#1", applies_when: always }
  - { id: RULE-destroy-after-purpose, text: "Destroy data without delay after the purpose is achieved.", severity: high, source_ref: "fact#1", applies_when: always }
```
