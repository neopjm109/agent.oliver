---
name: scope-definer
description: Derive the proposal's scope — in-scope items, explicit out-of-scope items, deliverables, and assumptions — from analyzed RFP requirements. Scoping stage of the proposal pipeline.
version: 1.0.0
category: proposal
tags:
  - proposal
  - scope
  - deliverables
  - assumptions
model: inherit
invokes: []
inputs:
  - rfp_analysis
  - options
outputs:
  - scope
---

# Goal

Define what the proposed engagement will and will not include, plus deliverables and
assumptions. This is pre-sales scoping; it does not estimate effort, price, or plan
execution tasks.

# Inputs

```yaml
rfp_analysis: { requirements: [...], constraints: {...}, unknowns: [...] }
options:
  language: ko
```

# Output

```yaml
scope:
  in_scope: [ { id: S-01, item: <work included>, covers: [R-01, ...] }, ... ]
  out_of_scope: [ { item: <explicitly excluded>, reason: <why> }, ... ]
  deliverables: [<tangible output>, ...]
  assumptions: [<assumption the estimate depends on>, ...]
```

# Workflow

## Step 1 — Map requirements to scope items
Group requirements into coherent work items; each in-scope item lists the requirement IDs
it covers.

## Step 2 — Declare exclusions
State what is explicitly out of scope (things the RFP hints at but the proposal will not
deliver), with a reason.

## Step 3 — Deliverables & assumptions
List tangible deliverables; convert `unknowns` into stated assumptions the estimate relies
on.

## Step 4 — Return
Return `scope`. Stop.

# Rules

- Every in-scope item must cover at least one requirement (`covers` non-empty); no scope
  without a source requirement.
- Turn RFP unknowns into explicit assumptions rather than silently including or excluding.
- Do not estimate effort or price — later stages own those.
- Out-of-scope items need a stated reason so the client understands the boundary.

# Examples

Input:

```yaml
rfp_analysis:
  requirements:
    - { id: R-01, text: "Portal supports single sign-on (SSO).", priority: must }
  unknowns: ["Which identity provider is required for SSO?"]
options: { language: ko }
```

Output:

```yaml
scope:
  in_scope:
    - { id: S-01, item: "SSO integration with one identity provider", covers: [R-01] }
  out_of_scope:
    - { item: "Multi-IdP federation", reason: "RFP references a single provider." }
  deliverables: ["Configured SSO login flow", "Integration test report"]
  assumptions: ["Client provides one OIDC-compliant identity provider."]
```
