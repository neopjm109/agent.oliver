---
name: proposal-orchestrator
description: Coordinate the end-to-end proposal pipeline that turns an RFP (request for proposal) into a scoped, estimated, priced proposal document. Use when the goal is a pre-sales proposal, not runtime code or project execution planning. Entrypoint of the proposal domain.
version: 1.0.0
category: proposal
tags:
  - proposal
  - orchestrator
  - rfp
  - pre-sales
  - pipeline
  - entrypoint
model: inherit
invokes:
  - docs-analyze-docx
  - docs-analyze-pptx
  - docs-analyze-xlsx
  - docs-analyze-markdown
  - docs-analyze-pdf
  - rfp-analyzer
  - scope-definer
  - effort-estimator
  - pricing-generator
  - proposal-drafter
  - proposal-validator
inputs:
  - proposal_request
  - rfp_documents
  - options
outputs:
  - proposal
---

# Goal

Produce a client-ready proposal by orchestrating specialized proposal skills. This skill
**never scopes, estimates, prices, or drafts directly** — it ingests the RFP, sequences
the pipeline, delegates each stage, and returns the assembled proposal. It produces a
pre-sales document; it never generates runtime code and never plans execution tasks.

# Inputs

```yaml
proposal_request:
  client: "ACME Corp"
  title: "Customer Portal Development"
  win_themes: ["fast delivery", "security"]   # optional emphasis
rfp_documents: [rfp.pdf, requirements.xlsx]
options:
  language: ko                 # optional
  output_format: markdown      # optional
  currency: KRW                # optional
  rate_card: { senior: 800000, mid: 600000 }  # optional per person-day
  include_pricing: true        # optional; omit for scope-only proposals
```

# Output

```yaml
proposal:
  client: <client>
  title: <title>
  content: <assembled proposal document>
  scope: { in_scope: [...], out_of_scope: [...], assumptions: [...] }
  estimate: { total_person_days: <n>, by_item: [...] }
  pricing: { total: <amount>, currency: <ccy>, breakdown: [...] }  # if include_pricing
  validation: <pass/fail + violations from proposal-validator>
```

# Workflow

## Step 1 — Analyze the request
Determine client, title, win themes, and which RFP documents are provided.

## Step 2 — Ingest the RFP
For each document in `rfp_documents`, invoke the matching `docs-analyze-*` skill by
extension. Merge extracted material.

## Step 3 — Interpret the RFP
Invoke `rfp-analyzer` to convert extracted material into structured requirements,
evaluation criteria, and constraints.

## Step 4 — Define scope
Invoke `scope-definer` to derive in-scope/out-of-scope items, deliverables, and
assumptions from the requirements.

## Step 5 — Estimate effort
Invoke `effort-estimator` to size each scope item into effort and a role mix.

## Step 6 — Price (optional)
If `options.include_pricing`, invoke `pricing-generator` to turn effort into a costed
breakdown using the `rate_card`.

## Step 7 — Draft the proposal
Invoke `proposal-drafter` to assemble the final document (executive summary, approach,
scope, schedule, pricing, team), emphasizing `win_themes`.

## Step 8 — Validate
Invoke `proposal-validator` to verify RFP coverage, scope↔estimate↔pricing consistency,
pricing arithmetic, and required-section completeness (pass/fail).

## Step 9 — Return
Return the `proposal` including the validation verdict. The pipeline ends here.

# Rules

- This skill only coordinates. Delegate every stage; never analyze, scope, estimate,
  price, or draft directly.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Never generate runtime code, and never produce an execution task graph — that is
  `project-planner` in the app pipeline. This pipeline is pre-sales scoping only.
- Every scope item, estimate, and price must trace to an RFP requirement or a stated
  assumption; never promise capabilities the RFP did not request without flagging them.
- If pricing is requested without a `rate_card`, return effort only and note that pricing
  was skipped for lack of rates.
- Error handling: if a `docs-analyze-*` skill fails, continue with remaining documents and
  note the gap. If a downstream skill fails, return the partial proposal and mark the
  incomplete stage.

# Examples

Input:

```yaml
proposal_request: { client: "ACME Corp", title: "Customer Portal", win_themes: ["security"] }
rfp_documents: [rfp.pdf]
options: { language: ko, currency: KRW, rate_card: { senior: 800000, mid: 600000 }, include_pricing: true }
```

Output (abridged):

```
✔ ingest    → rfp.pdf → 18 requirements extracted
✔ rfp       → 18 requirements · 4 eval criteria · 3 constraints
✔ scope     → 9 in-scope · 3 out-of-scope · 5 assumptions
✔ estimate  → 140 person-days (senior 60 / mid 80)
✔ pricing   → ₩96,000,000 (KRW)
✔ draft     → 7-section proposal, security win-theme emphasized

Proposal: "Customer Portal" for ACME Corp — 140 p-d, ₩96,000,000
```
