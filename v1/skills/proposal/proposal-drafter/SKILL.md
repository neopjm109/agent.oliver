---
name: proposal-drafter
description: Assemble the final client-ready proposal document (executive summary, approach, scope, schedule, pricing, team) from scope, estimate, and pricing, emphasizing the win themes. Final stage of the proposal pipeline.
version: 1.0.0
category: proposal
tags:
  - proposal
  - drafting
  - synthesis
  - final-output
model: inherit
invokes: []
inputs:
  - proposal_request
  - rfp_analysis
  - scope
  - estimate
  - pricing
  - options
outputs:
  - proposal
---

# Goal

Compose the final proposal document from upstream results. This skill only assembles and
phrases provided data into a persuasive but factual document; it does not re-scope,
re-estimate, or re-price.

# Inputs

```yaml
proposal_request: { client, title, win_themes: [...] }
rfp_analysis: { evaluation_criteria: [...], constraints: {...} }
scope: { in_scope, out_of_scope, deliverables, assumptions }
estimate: { total_person_days, by_item }
pricing: { total, currency, breakdown }   # optional
options:
  language: ko
  output_format: markdown
```

# Output

```yaml
proposal:
  client: <client>
  title: <title>
  content: <full proposal document>
  sections: [<section title>, ...]
```

# Workflow

## Step 1 — Executive summary
Open with the client's goal and how the proposal wins on the evaluation criteria and win
themes.

## Step 2 — Approach & scope
Describe the approach, then present in-scope items, deliverables, explicit exclusions, and
assumptions.

## Step 3 — Schedule & effort
Present the effort estimate and a schedule framing (do not invent dates beyond the RFP
deadline).

## Step 4 — Pricing & team
Include the pricing breakdown if provided and a role/team summary from the estimate.

## Step 5 — Return
Return the assembled `proposal`. Stop.

# Rules

- Assemble provided data only; never add scope, change estimates, or alter prices.
- Align emphasis to `evaluation_criteria` and `win_themes` without overstating capability.
- Keep claims factual and traceable to scope/estimate; no unquantified superlatives.
- Do not fabricate references, case studies, or dates not supplied as input.
- Reuse `docwriting` style conventions but stay proposal-specific; do not call other skills.

# Examples

Input:

```yaml
proposal_request: { client: "ACME Corp", title: "Customer Portal", win_themes: ["security"] }
rfp_analysis: { evaluation_criteria: [ { criterion: "Price", weight: 60 } ], constraints: { deadline: "4 months" } }
scope: { in_scope: [ { id: S-01, item: "SSO integration" } ], deliverables: ["SSO login flow"], out_of_scope: [], assumptions: ["One OIDC IdP provided."] }
estimate: { total_person_days: 11.5, by_item: [ { scope_id: S-01, person_days: 10 } ] }
pricing: { total: 7480000, currency: KRW, breakdown: [ { scope_id: S-01, amount: 6800000 } ] }
options: { language: ko, output_format: markdown }
```

Output (abridged):

```yaml
proposal:
  client: "ACME Corp"
  title: "Customer Portal"
  sections: ["Executive Summary", "Approach", "Scope", "Schedule & Effort", "Pricing", "Team"]
  content: >
    # Customer Portal 제안서 — ACME Corp

    ## Executive Summary
    보안을 최우선으로, 4개월 내 SSO 기반 고객 포털을 구축합니다. ...

    ## Scope
    - 포함: SSO 통합 (S-01) — 산출물: SSO 로그인 플로우
    - 가정: OIDC 호환 IdP 1종 제공

    ## Pricing
    총액 ₩7,480,000 (VAT 포함) / 11.5 person-days
```
