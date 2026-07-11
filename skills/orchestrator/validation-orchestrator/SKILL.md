---
name: validation-orchestrator
description: Validates the generated application by coordinating architecture, backend, frontend, integration, security, performance, dependency/license, and test validators, plus per-client validators (mobile/desktop) selected by target_stack.clients. Read-only; runs before review and gates remediation.
version: 1.0.0
category: orchestrator
tags:
  - orchestrator
  - validation
  - quality
  - verification
model: inherit
invokes:
  - architecture-validator
  - backend-validator
  - frontend-validator
  - mobile-validator
  - desktop-shell-validator
  - integration-validator
  - security-validator
  - performance-validator
  - dependency-license-validator
  - test-validator
inputs:
  - application_blueprint
  - execution_result
  - generated_artifacts
outputs:
  - validation_report
---

# Goal

Validate every generated artifact for completeness, consistency, correctness, and quality
before the project is considered done. This skill coordinates validators across
architecture, backend, frontend, integration, security, and testing. It is strictly
**read-only** and **never modifies artifacts**.

# Inputs

```yaml
application_blueprint: {...}
execution_result: {...}
generated_artifacts: {...}
```

# Output

```yaml
validation_report:
  overall_status: PASS | WARNING | ERROR
  passed: [...]
  warnings: [...]
  errors: [...]
  metrics: {...}
  recommendations: [...]
```

# Workflow

## Step 1 — Load artifacts
Load the blueprint, generated artifacts, and execution result. Verify all required inputs are present.

## Step 2 — Validate architecture
Invoke `architecture-validator` → layers, module dependencies, package structure, naming, circular dependencies.

## Step 3 — Validate backend
Invoke `backend-validator` → entities, repositories, services, controllers, DTOs, validation rules, event flow.

## Step 4 — Validate frontend (web)
Invoke `frontend-validator` → layouts, pages, components, forms, tables, dialogs, routing, state.
This covers the Next.js web client (and, for a Tauri desktop app, the reused React UI).

## Step 4b — Validate additional clients (conditional)
Read `target_stack.clients` from the `application_blueprint`. For each non-web client generated:
- `mobile` → invoke `mobile-validator` (Flutter screens/routes, API client ↔ api_specification, form rules, theme tokens).
- `desktop` → invoke `desktop-shell-validator` (Tauri shell/config, IPC bridge, packaging, shell↔web wiring; the React UI is already covered by Step 4).
Skip a client validator when its client is not in `target_stack.clients`.

## Step 5 — Validate integration
Invoke `integration-validator` → API contracts, external services, contract consistency.

## Step 6 — Validate security
Invoke `security-validator` → authentication, authorization, permissions, secrets, sensitive data, config.

## Step 7 — Validate performance
Invoke `performance-validator` → N+1 queries, pagination, timeouts, indexing, caching, bundle/image/render anti-patterns.

## Step 8 — Validate dependencies
Invoke `dependency-license-validator` → known CVEs, license policy, version pinning, duplicates (Gradle + pnpm).

## Step 9 — Validate tests
Invoke `test-validator` → unit, integration, end-to-end tests, coverage, missing tests.

## Step 10 — Aggregate and report
Merge results; compute overall status, error/warning counts, and metrics; emit the `validation_report`.

# Rules

- Never generate or modify artifacts; perform read-only validation only.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Run client validators conditionally on `target_stack.clients` (from the blueprint): `mobile-validator`
  only when `mobile` is present, `desktop-shell-validator` only when `desktop` is present. `frontend-validator`
  always runs for the web client; do not use it to judge Flutter or the Tauri Rust shell.
- Verify consistency across blueprint ↔ backend ↔ API ↔ frontend and events ↔ messaging ↔ Redis.
- Detect circular dependencies, broken references, invalid imports, and missing relationships.
- Continue validation even when errors are found; collect all findings into one report.
- Every finding must reference its requirement, blueprint component, feature, story, task, and artifact.
- `overall_status` is ERROR if any category reports an error; this gates remediation before review.
- A category returning `inconclusive` (e.g. `dependency-license-validator` with no vuln feed/policy)
  surfaces as at least WARNING and is listed in the report — never counted as passed. Record what
  could not be evaluated so a missing data source is visible, not silently green.
- Complete only when every category finishes, every artifact is evaluated, and the report is generated.

# Examples

Input:

```yaml
application_blueprint: {...}
generated_artifacts: { backend: 12 files, frontend: 14 files }
```

Output (abridged):

```
✔ architecture → PASS
✔ backend      → 1 error (OrderMapper missing field: currency)
✔ frontend     → PASS, 1 warning (unused import)
✔ integration  → PASS
✔ security     → PASS
✔ test         → coverage 88%, 1 error (no test for PlaceOrderForm)
validation_report: overall_status=ERROR, errors=2, warnings=1, coverage=88%
```
