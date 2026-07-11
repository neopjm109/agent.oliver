---
name: event-feasibility-validator
description: Validate the event plan for feasibility — budget within ceiling, timeline fits the duration, venue capacity, and dietary-need coverage — returning a pass/fail report. Final check of the event-planner pipeline.
version: 1.0.0
category: event-planner
tags:
  - event-planner
  - feasibility
  - validation
model: inherit
invokes: []
inputs:
  - menu_activities
  - run_of_show
  - event_spec
  - theme
outputs:
  - feasibility_report
---

# Goal

Check whether the plan is actually doable before the host commits, returning a deterministic
pass/fail verdict with fixes. This validates the plan; it does not rewrite it.

# Scope

- Budget (menu + activity + decor cost within the stated budget)
- Time (run-of-show fits the event duration)
- Capacity (guest count within venue capacity)
- Dietary coverage (each stated need has a safe menu option)

Out of scope: taste, guest enjoyment, live vendor pricing.

# Checks

1. `est_total_cost` + `theme.est_decor_cost` ≤ budget amount.
2. Timeline `total_span` ≤ event duration (with reasonable buffer).
3. Guests ≤ venue capacity.
4. Every dietary need has at least one honoring menu item.

# Pass/Fail Criteria

- **pass**: budget, time, capacity, and dietary coverage all satisfied.
- **fail**: any budget overrun, timeline overflow, over-capacity, or uncovered dietary need.

# Output Schema

```yaml
feasibility_report:
  result: pass | fail
  issues:
    - { area: budget | time | capacity | dietary, detail: <what>, fix: <suggestion> }
  stats: { guests: <n>, est_cost: <amount>, issues: <n> }
```

# Rules

- Report issues and fixes only; never rewrite the plan.
- Deterministic verdict: any budget/time/capacity/dietary breach forces `fail`.
- Treat costs as estimates; flag clear overruns, not marginal ones.
- Judge against the event spec, not assumptions.

# Examples

Input:

```yaml
menu_activities: { est_total_cost: 340000 }
theme: { est_decor_cost: 20000 }
run_of_show: { total_span: 4 }
event_spec: { guests: 12, budget: { amount: 300000 }, duration: 4, venue: { capacity_note: "12인" }, needs: [] }
```

Output:

```yaml
feasibility_report:
  result: fail
  issues:
    - { area: budget, detail: "추정 ₩340,000 > 예산 ₩300,000", fix: "핑거푸드 종수 축소 또는 음료 자가준비" }
  stats: { guests: 12, est_cost: 340000, issues: 1 }
```
