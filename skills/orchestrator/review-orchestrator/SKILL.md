---
name: review-orchestrator
description: Produces the final project review — summary, coverage, warnings, suggestions, and remaining tasks — by analyzing execution, validation, and generated artifacts. Strictly analysis-only; never modifies anything.
version: 1.0.0
category: orchestrator
tags:
  - orchestrator
  - review
  - summary
  - reporting
model: inherit
invokes: []
inputs:
  - application_blueprint
  - execution_result
  - validation_report
  - generated_artifacts
outputs:
  - review_report
---

# Goal

Generate the final consolidated review of the whole generation process: project summary,
subsystem reviews, coverage and quality metrics, risks, warnings, improvement
suggestions, and remaining tasks. This skill is strictly **read-only** — it never modifies
artifacts and never re-executes generation.

# Inputs

```yaml
application_blueprint: {...}
execution_result: {...}
validation_report: {...}
generated_artifacts: {...}
```

# Output

```yaml
review_report:
  project_summary: {...}
  architecture_review: {...}
  backend_review: {...}
  frontend_review: {...}
  integration_review: {...}
  quality_metrics: {...}
  risks: [...]
  warnings: [...]
  errors: [...]
  recommendations: [...]
  remaining_tasks: [...]
  final_status: complete | complete_with_warnings | incomplete
```

# Workflow

## Step 1 — Load all results
Collect the blueprint, execution result, validation report, and generated artifacts; verify completeness.

## Step 2 — Summarize execution
Summarize completed/failed/skipped tasks, execution efficiency, and dependency bottlenecks.

## Step 3 — Review subsystems
Evaluate architecture (modularity, layering), backend (domain/API/DB/security/tests), frontend (UI consistency, reusability, state, API integration), and integration (contracts, external services, data consistency).

## Step 4 — Analyze validation results
Incorporate errors, warnings, passed checks, and quality metrics; carry over unresolved issues and remediation `remaining_tasks`.

## Step 5 — Risk analysis
Detect architectural, performance, security, and scalability risks plus technical debt; categorize and prioritize.

## Step 6 — Recommendations
Provide actionable code, architecture, process, and testing improvements.

## Step 7 — Final report
Assemble the structured `review_report` and determine `final_status`.

# Rules

- Analysis only: never modify generated artifacts and never re-execute generation steps.
- Do not invoke any other skill; consume the provided inputs directly.
- Verify alignment across blueprint ↔ implementation, backend ↔ frontend, API ↔ integration, execution ↔ validation.
- Every risk must be categorized, prioritized, explained, and actionable.
- Every finding must reference its requirement, blueprint component, feature, story, task, and validation result.
- Carry unresolved errors from remediation into `remaining_tasks` — never silently drop them.
- Complete only when execution is summarized, validation analyzed, all subsystems reviewed, risks identified, recommendations provided, and `final_status` determined.

# Examples

Input:

```yaml
execution_result: { completed: 21, failed: 0, skipped: 0 }
validation_report: { overall_status: PASS, coverage: 94% }
generated_artifacts: { backend: 47 files, frontend: 33 files }
```

Output (abridged):

```
project_summary: 4 features, 21 tasks, 80 files, 0 failed
architecture_review: modular, clean layering — good
backend_review:  domain solid; 1 suggestion (extract OrderPricing service)
frontend_review: consistent UI; state via tanstack-query — good
integration_review: contracts aligned
quality_metrics: coverage 94%, 0 circular deps
risks: [low: no rate limiting on PSP client]
recommendations: [add integration test for payment retry]
remaining_tasks: []
final_status: complete
```
