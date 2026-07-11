---
name: effort-estimator
description: Size each in-scope item into effort (person-days) and a role mix, with a confidence level, producing a total and a per-item breakdown. Estimation stage of the proposal pipeline.
version: 1.0.0
category: proposal
tags:
  - proposal
  - estimation
  - effort
  - person-days
model: inherit
invokes: []
inputs:
  - scope
  - options
outputs:
  - estimate
---

# Goal

Estimate the effort for each in-scope item as person-days with a role mix and confidence.
This produces a sizing for pricing; it does not price the work or plan execution tasks.

# Inputs

```yaml
scope: { in_scope: [ { id, item, covers }, ... ], assumptions: [...] }
options:
  unit: person-days       # estimation unit
  contingency_pct: 15     # optional buffer applied to the total
```

# Output

```yaml
estimate:
  by_item:
    - { scope_id: S-01, person_days: <n>, roles: { senior: <n>, mid: <n> }, confidence: high | medium | low }
  subtotal_person_days: <n>
  contingency_person_days: <n>
  total_person_days: <n>
```

# Workflow

## Step 1 — Size each item
Estimate person-days per in-scope item and split across roles. Lower confidence for items
that depend on unresolved assumptions.

## Step 2 — Apply contingency
Add `contingency_pct` to the subtotal as a buffer line.

## Step 3 — Total
Sum to `total_person_days`.

## Step 4 — Return
Return `estimate`. Stop. Pricing is downstream.

# Rules

- Estimate only in-scope items; never size out-of-scope work.
- Flag low confidence where estimates rest on unresolved assumptions.
- Keep effort in the stated unit; do not convert to money — that is `pricing-generator`.
- Do not produce a task-level execution schedule; this is a proposal-level sizing.

# Examples

Input:

```yaml
scope:
  in_scope:
    - { id: S-01, item: "SSO integration with one identity provider", covers: [R-01] }
  assumptions: ["Client provides one OIDC-compliant identity provider."]
options: { unit: person-days, contingency_pct: 15 }
```

Output:

```yaml
estimate:
  by_item:
    - { scope_id: S-01, person_days: 10, roles: { senior: 4, mid: 6 }, confidence: medium }
  subtotal_person_days: 10
  contingency_person_days: 1.5
  total_person_days: 11.5
```
