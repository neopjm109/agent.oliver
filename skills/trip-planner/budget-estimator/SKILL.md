---
name: budget-estimator
description: Estimate the trip's cost by category — lodging, transport, food, activities, misc — from the itinerary and logistics, flagging figures as estimates and checking any budget ceiling. Budget stage of the trip-planner pipeline.
version: 1.0.0
category: trip-planner
tags:
  - trip-planner
  - budget
  - cost
model: inherit
invokes: []
inputs:
  - itinerary
  - logistics
  - trip_request
  - options
outputs:
  - budget
---

# Goal

Produce a category cost estimate for the trip and compare it to any ceiling. This skill
estimates from typical/assumption-based figures; it is not live pricing and must say so.

# Inputs

```yaml
itinerary: [ { day, items } ]
logistics: { lodging, transfers, passes }
trip_request: { party, dates: { days }, budget_ceiling }
options:
  currency: KRW
```

# Output

```yaml
budget:
  currency: <ccy>
  by_category: { lodging, transport, food, activities, misc }
  per_day: <amount>
  total: <amount>
  vs_ceiling: within | over | none
  disclaimer: "추정치 — 실시간 가격/예약은 별도 도구 필요"
```

# Workflow

## Step 1 — Estimate per category
Estimate lodging (nights×area), transport (transfers+passes), food (party×days×meal band),
activities (entrance fees), and misc.

## Step 2 — Total & per-day
Sum categories; derive per-day.

## Step 3 — Compare ceiling
Compare `total` to `budget_ceiling`; set `vs_ceiling`.

## Step 4 — Return
Return `budget` with the estimate disclaimer. Stop.

# Rules

- Always mark figures as estimates; never present them as live/booked prices.
- Base figures on typical/assumption-based costs for the destination; state assumptions.
- If over the ceiling, still return the estimate and set `vs_ceiling: over` (do not silently
  trim the itinerary).
- Do not book, and do not re-plan the itinerary.

# Examples

Input:

```yaml
itinerary: [ { day: 1 }, { day: 2 } ]
logistics: { lodging: [ { base_area: "교토역", covers_days: [1,2] } ], passes: ["버스 1일권"] }
trip_request: { party: { adults: 2 }, dates: { days: 2 }, budget_ceiling: { amount: 900000, currency: KRW } }
options: { currency: KRW }
```

Output:

```yaml
budget:
  currency: KRW
  by_category: { lodging: 300000, transport: 120000, food: 240000, activities: 60000, misc: 80000 }
  per_day: 400000
  total: 800000
  vs_ceiling: within
  disclaimer: "추정치 — 실시간 가격/예약은 별도 도구 필요"
```
