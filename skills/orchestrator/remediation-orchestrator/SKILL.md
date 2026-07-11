---
name: remediation-orchestrator
description: Closes the validation feedback loop — maps validation errors back to responsible tasks, re-executes only the affected work, and re-validates until the project passes or the remediation budget is exhausted.
version: 1.0.0
category: orchestrator
tags:
  - orchestrator
  - remediation
  - feedback-loop
  - self-healing
model: inherit
invokes:
  - execution-orchestrator
  - code-change-orchestrator
  - validation-orchestrator
inputs:
  - validation_report
  - execution_plan
  - execution_result
  - application_blueprint
  - max_remediation_iterations
outputs:
  - remediation_result
---

# Goal

Turn the one-way validate → review flow into a closed loop. When validation reports
errors, map each error back to the task that produced the faulty artifact, fix it with the
smallest safe action, and re-validate — repeating until the project passes or the
remediation budget is exhausted. This skill **never generates or edits implementation code
directly**; it re-invokes existing orchestrators against a targeted subset of work. For each
error it picks the cheaper repair: a **surgical change** to existing code via
`code-change-orchestrator` (localized bug, deprecated API, dead code) or a **full
re-generation** of the task via `execution-orchestrator` (missing or structurally wrong
artifact).

# Inputs

```yaml
validation_report:
  overall_status: ERROR
  errors: [...]
  warnings: [...]
  recommendations: [...]
execution_plan:
  tasks: [...]
  dependency_graph: {...}
execution_result:
  completed_tasks: [...]
  failed_tasks: [...]
application_blueprint: {...}
max_remediation_iterations: 2
```

# Output

```yaml
remediation_result:
  final_status: passed | unresolved
  iterations_used: 1
  remediated_tasks: [...]
  unresolved_errors: [...]   # promoted to review as remaining_tasks
  remediation_log: [...]
```

# Workflow

## Step 1 — Check entry condition
If `validation_report.overall_status == passed`, skip entirely and return `final_status: passed`, `iterations_used: 0`.

## Step 2 — Map errors to tasks
For each error, resolve the responsible unit via the traceability chain: error → artifact → task → feature → story. Produce a de-duplicated task set. Errors that map to nothing become `unmappable_errors`.

## Step 3 — Build remediation subset
From the affected tasks, build a partial re-execution plan: include the affected tasks plus downstream dependents; exclude passing, unaffected tasks.

## Step 4 — Repair (pick the cheaper action per error)
For each affected unit, choose the repair path:
- **Surgical change** — the artifact exists and the error is localized (wrong logic, missing
  branch, deprecated API, dead/orphaned code). Invoke `code-change-orchestrator` with a
  `change_request` (intent = the error, target = the faulty symbol/file) and `target_stack`.
  This edits in place and preserves surrounding code — preferred whenever the artifact is
  substantially correct.
- **Full re-generation** — the artifact is missing, empty, or structurally wrong. Invoke
  `execution-orchestrator` scoped to the remediation subset.

Preserve all unchanged outputs either way.

## Step 5 — Re-validate
Invoke `validation-orchestrator` on the regenerated artifacts (and anything affected by them).

## Step 6 — Loop or exit
`passed` → exit `final_status: passed`. Else if `iterations >= max` → exit `unresolved`. Else increment and return to Step 2.

## Step 7 — Promote unresolved
On exit with `unresolved`, collect remaining errors plus `unmappable_errors` into `unresolved_errors`, handed to review-orchestrator as `remaining_tasks`.

# Rules

- Never generate or edit implementation code directly; only re-invoke `code-change-orchestrator`, `execution-orchestrator`, and `validation-orchestrator`.
- Prefer a surgical `code-change-orchestrator` fix over full re-generation when the artifact is substantially correct; fall back to `execution-orchestrator` when it is missing or structurally wrong.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Never loop more than `max_remediation_iterations` times.
- Each iteration must reduce the error set; if it does not, exit as `unresolved`.
- Never retry errors caused by requirement gaps — promote them instead.
- Re-execute only tasks mapped from errors plus their dependents; never regenerate passing artifacts.
- Preserve traceability across every regenerated artifact.
- Complete only when validation passes, or the budget is exhausted with unresolved errors promoted, and a log is recorded.

# Examples

Input:

```yaml
validation_report: { overall_status: ERROR, errors: [OrderMapper missing currency, no test for PlaceOrderForm] }
max_remediation_iterations: 2
```

Output (abridged):

```
iteration 1:
  map    → tasks {Order.api (OrderMapper), frontend.tests (PlaceOrderForm)}
  repair → OrderMapper missing currency  → surgical  (code-change: modify OrderMapper)
         → PlaceOrderForm has no test    → regenerate (execution: frontend.tests)
  re-validate → 0 errors
remediation_result: final_status=passed, iterations_used=1, remediated_tasks=2, unresolved_errors=[]
```
