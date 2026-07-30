---
name: rfp-analyzer
description: Interpret extracted RFP material into structured requirements, evaluation criteria, and constraints (budget, timeline, mandatory conditions). First interpretation stage of the proposal pipeline.
version: 1.0.0
category: proposal
tags:
  - proposal
  - rfp
  - requirements
  - analysis
model: inherit
invokes: []
inputs:
  - rfp_material
  - options
outputs:
  - rfp_analysis
---

# Goal

Convert raw extracted RFP text into a structured interpretation: what the client requires,
how proposals will be judged, and what constraints bound the work. This skill interprets
the RFP; it does not scope, estimate, or price.

# Inputs

```yaml
rfp_material:
  facts: [<extracted RFP statement>, ...]   # from docs-analyze
options:
  language: ko
```

# Output

```yaml
rfp_analysis:
  requirements:
    - { id: R-01, text: <what the client wants>, priority: must | should | could, source_ref: <ptr> }
  evaluation_criteria: [ { criterion: <how judged>, weight: <n or "unstated"> }, ... ]
  constraints: { budget: <or unstated>, deadline: <or unstated>, mandatory: [<hard condition>, ...] }
  unknowns: [<question to clarify with the client>, ...]
```

# Workflow

## Step 1 — Extract requirements
Turn RFP statements into atomic requirements with a MoSCoW priority and a source pointer.

## Step 2 — Capture evaluation criteria
Record how the client says proposals will be scored, with weights when stated.

## Step 3 — Capture constraints
Pull budget, deadline, and mandatory conditions (certifications, standards, staffing).

## Step 4 — List unknowns
Note ambiguities that need client clarification rather than guessing.

## Step 5 — Return
Return `rfp_analysis`. Stop.

# Rules

- Interpret only what the RFP states; never invent requirements or infer a budget.
- Every requirement carries a source pointer for traceability.
- Ambiguities go to `unknowns`, not silent assumptions.
- Do not scope, estimate, or price — downstream stages own those.

# Examples

Input:

```yaml
rfp_material:
  facts:
    - "The portal must support single sign-on and be delivered within 4 months."
    - "Proposals will be evaluated 40% on technical approach, 60% on price."
options: { language: ko }
```

Output:

```yaml
rfp_analysis:
  requirements:
    - { id: R-01, text: "Portal supports single sign-on (SSO).", priority: must, source_ref: "fact#1" }
  evaluation_criteria:
    - { criterion: "Technical approach", weight: 40 }
    - { criterion: "Price", weight: 60 }
  constraints: { budget: unstated, deadline: "4 months", mandatory: [] }
  unknowns: ["Which identity provider is required for SSO?"]
```
