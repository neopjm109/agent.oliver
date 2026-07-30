---
name: execution-orchestrator
description: Resolves the task dependency graph and schedules generation work — maximizing parallelism, tracking progress, and handling failures — without generating code itself.
version: 1.0.0
category: orchestrator
tags:
  - orchestrator
  - execution
  - scheduler
  - dependency
  - dag
model: inherit
invokes: []
inputs:
  - execution_plan
  - application_blueprint
outputs:
  - execution_result
---

# Goal

Run the generation pipeline according to the execution plan: build the dependency DAG,
schedule tasks, execute them in dependency order with maximum safe parallelism, track
progress, and handle failures. This skill **never generates implementation code** and
never modifies artifacts — it only schedules and records.

# Inputs

```yaml
execution_plan:
  epics: [...]
  features: [...]
  stories: [...]
  tasks: [...]
  dependency_graph: {...}
  execution_order: [...]
application_blueprint: {...}
```

# Output

```yaml
execution_result:
  completed_tasks: [...]
  skipped_tasks: [...]
  failed_tasks: [...]
  execution_log: [...]
  execution_summary: {...}
```

# Workflow

## Step 1 — Load and validate plan
Load features, stories, tasks, dependency graph, and execution order. Validate before executing.

## Step 2 — Build execution DAG
Construct the graph; identify root tasks, dependencies, blocking tasks, and parallel groups. Reject circular graphs.

## Step 3 — Schedule tasks
Order sequential tasks, parallel groups, and independent branches.

## Step 4 — Dispatch
Hand each ready task to its generator (already resolved in the plan) only after all its
dependencies complete successfully, and record the outcome — this orchestrator schedules and
records, it does not generate. Track state: pending → ready → running → completed / failed.

## Step 5 — Monitor progress
Track task status, progress, execution time, start/completion time, and retry count.

## Step 6 — Handle failures
On failure: mark the task failed, stop dependent tasks (mark skipped), continue independent branches, and preserve state.

## Step 7 — Summarize
Produce completed/skipped/failed tasks, statistics, and a timeline.

# Rules

- Never generate implementation code and never modify artifacts; execute only per the plan.
- Respect every dependency; never start downstream tasks early; reject circular graphs.
- Maximize parallelism across independent branches without violating dependencies.
- On failure: stop dependents, continue unrelated branches, collect all failures.
- If retry is enabled, retry only transient failures — never validation failures — and preserve retry history.
- Every execution record must reference its requirement, blueprint component, epic, feature, story, and task.
- Complete only when every executable task reaches a terminal state and the summary and log are recorded.

# Examples

Input:

```yaml
execution_plan:
  tasks: [Order.entity, Order.repo, Order.service, Order.controller, order.page]
  dependency_graph: entity → repo → service → controller → page
execution_order: [entity, repo, service, controller, page]
```

Output (abridged):

```
DAG: 5 tasks, 1 chain, 0 parallel groups
▶ entity   ✔ (120ms)
▶ repo     ✔ (90ms)
▶ service  ✔ (140ms)
▶ controller ✖ failed (mapping error)
⤼ page     skipped (depends on controller)
summary: completed 3, failed 1, skipped 1
```
