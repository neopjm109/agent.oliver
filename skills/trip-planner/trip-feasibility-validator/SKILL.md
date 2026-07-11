---
name: trip-feasibility-validator
description: Validate the itinerary for feasibility — realistic daily travel times, opening-hours conflicts, over-packed days, and budget-ceiling breaches — returning a pass/fail report. Final check of the trip-planner pipeline.
version: 1.0.0
category: trip-planner
tags:
  - trip-planner
  - feasibility
  - validation
model: inherit
invokes: []
inputs:
  - itinerary
  - logistics
  - budget
  - destination_profile
outputs:
  - feasibility_report
---

# Goal

Check whether the plan is actually doable before the traveler commits, returning a
deterministic pass/fail verdict with specific fixes. This validates the plan; it does not
rewrite it.

# Inputs

Validated inputs (produced upstream): `itinerary`, `logistics`, `budget`, `destination_profile`.

# Scope

- Daily travel realism (transfers + sight durations fit the day)
- Opening-hours conflicts (sights visited when actually open)
- Over-packing (too many items for the stated pace)
- Budget ceiling (total within any stated ceiling)

Out of scope: taste/preference, live schedule accuracy, weather prediction.

# Checks

1. Each day's sight durations + transfers fit within realistic waking hours.
2. Every sight is scheduled within its `typical_hours`.
3. Item count per day is consistent with the requested `pace`.
4. Budget `total` is within `budget_ceiling` when one is set.

# Pass/Fail Criteria

- **pass**: all days fit time, no opening-hours conflicts, pace respected, budget within
  ceiling (or no ceiling).
- **fail**: any day over-stuffed, any opening-hours conflict, or budget over ceiling.

# Output Schema

```yaml
feasibility_report:
  result: pass | fail
  issues:
    - { day: <n or "-">, area: time | hours | pace | budget, detail: <what>, fix: <suggestion> }
  stats: { days: <n>, issues: <n> }
```

# Rules

- Report issues and fixes only; never rewrite the itinerary (the builder applies fixes).
- Deterministic verdict: any over-stuffed day, hours conflict, or budget breach forces `fail`.
- Use durations/times from the plan and profile, not assumptions.
- Treat times as estimates; flag only clear infeasibility, not minor slack.

# Examples

Input:

```yaml
itinerary: [ { day: 1, items: [ { time: "17:30", sight: "기요미즈데라", est_duration: "2h" } ] } ]
destination_profile: { sights: [ { name: "기요미즈데라", typical_hours: "06:00-18:00" } ] }
budget: { total: 800000, vs_ceiling: within }
```

Output:

```yaml
feasibility_report:
  result: fail
  issues:
    - { day: 1, area: hours, detail: "기요미즈데라 17:30 시작 2h는 18:00 폐장과 충돌", fix: "오전으로 이동 또는 소요시간 단축" }
  stats: { days: 1, issues: 1 }
```
