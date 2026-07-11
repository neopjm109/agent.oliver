---
name: event-brief-analyzer
description: Normalize an event request — occasion, guest count, budget, venue, duration, and constraints — into a structured planning spec. First stage of the event-planner pipeline.
version: 1.0.0
category: event-planner
tags:
  - event-planner
  - brief
  - spec
model: inherit
invokes: []
inputs:
  - event_request
outputs:
  - event_spec
---

# Goal

Turn a loose event request into a precise spec: occasion, headcount, budget, venue
constraints, duration, and any dietary/accessibility needs. This skill specifies only; it
does not design or plan.

# Inputs

```yaml
event_request: { occasion, guests, budget, venue, duration, vibe: [...] }
```

# Output

```yaml
event_spec:
  occasion: <normalized>
  guests: <n>
  budget: { amount, currency, per_head }
  venue: { place, capacity, capacity_note, constraints: [...] }
  duration: <hours>
  vibe: [...]
  needs: [<dietary/accessibility constraint>]
```

# Workflow

## Step 1 — Normalize basics
Confirm occasion, guests, duration, and vibe; compute per-head budget.

## Step 2 — Capture venue constraints
Note capacity, kitchen/space limits, and anything the venue restricts.

## Step 3 — Flag needs
Record dietary/accessibility needs as hard constraints.

## Step 4 — Return
Return `event_spec`. Stop.

# Rules

- Specify only; never design theme or plan menu/activities.
- Compute per-head budget so downstream can scale.
- Treat needs/venue limits as hard constraints.
- Do not invent guests, budget, or venue features not given.

# Examples

Input:

```yaml
event_request: { occasion: "생일 파티", guests: 12, budget: { amount: 300000, currency: KRW }, venue: "집", duration: "4시간", vibe: ["캐주얼"] }
```

Output:

```yaml
event_spec:
  occasion: 생일 파티
  guests: 12
  budget: { amount: 300000, currency: KRW, per_head: 25000 }
  venue: { place: 집, capacity: 12, capacity_note: "거실 12인 여유", constraints: ["가정용 오븐 1개"] }
  duration: 4
  vibe: [캐주얼]
  needs: []
```
