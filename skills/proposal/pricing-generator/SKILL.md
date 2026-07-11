---
name: pricing-generator
description: Convert an effort estimate into a costed pricing breakdown using a rate card, with per-item and total amounts in the target currency. Optional pricing stage of the proposal pipeline.
version: 1.0.0
category: proposal
tags:
  - proposal
  - pricing
  - cost
  - rate-card
model: inherit
invokes: []
inputs:
  - estimate
  - options
outputs:
  - pricing
---

# Goal

Turn a person-day effort estimate into a monetary pricing breakdown using a provided rate
card. This skill only computes cost from effort and rates; it does not re-estimate effort.

# Inputs

```yaml
estimate: { by_item: [ { scope_id, person_days, roles } ], contingency_person_days: <n>, total_person_days: <n> }
options:
  currency: KRW
  rate_card: { senior: 800000, mid: 600000 }   # per person-day
  discount_pct: 0        # optional
  tax_pct: 10            # optional (e.g. VAT)
```

# Output

```yaml
pricing:
  currency: <ccy>
  breakdown: [ { scope_id, amount }, ... ]
  contingency: <amount>          # contingency_person_days priced at the blended item rate
  subtotal: <amount>             # sum of breakdown + contingency
  discount: <amount>
  tax: <amount>
  total: <amount>
```

# Workflow

## Step 1 — Cost each item
Multiply each item's role-days by the matching rate; sum to the item amount.

## Step 2 — Cost the contingency buffer
Price `contingency_person_days` at the blended rate of the costed items (sum of item amounts ÷
sum of item person-days) as a distinct `contingency` line, so total priced person-days reconcile
with `estimate.total_person_days`.

## Step 3 — Subtotal, discount, tax
Sum item amounts + contingency; apply `discount_pct`, then `tax_pct`, to reach the total.

## Step 4 — Return
Return `pricing`. Stop.

# Rules

- Requires a `rate_card`; if absent, return nothing priced and report that pricing was
  skipped for lack of rates.
- Compute strictly from provided effort and rates; never re-estimate person-days.
- Price the contingency buffer (never drop it); total priced person-days must reconcile with `estimate.total_person_days`.
- Show every line (subtotal, discount, tax, total) so the math is auditable.
- Currency and rounding follow `options.currency`; state the rounding used.

# Examples

Input:

```yaml
estimate:
  by_item:
    - { scope_id: S-01, person_days: 10, roles: { senior: 4, mid: 6 } }
  contingency_person_days: 1.5
  total_person_days: 11.5
options: { currency: KRW, rate_card: { senior: 800000, mid: 600000 }, tax_pct: 10 }
```

Output:

```yaml
pricing:
  currency: KRW
  breakdown:
    - { scope_id: S-01, amount: 6800000 }   # 4×800000 + 6×600000
  contingency: 1020000                       # 1.5 pd × blended 680000/pd (6800000 ÷ 10)
  subtotal: 7820000                          # 6800000 + 1020000
  discount: 0
  tax: 782000
  total: 8602000
```
