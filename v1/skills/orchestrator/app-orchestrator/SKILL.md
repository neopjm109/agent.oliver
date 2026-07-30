---
name: app-orchestrator
description: Top-level pipeline that turns project documents into a validated, reviewed application by delegating to analysis, blueprint, planning, generation, validation, and review skills.
version: 1.0.0
category: orchestrator
tags:
  - orchestrator
  - pipeline
  - entrypoint
model: inherit
invokes:
  - docs-analyze-docx
  - docs-analyze-pptx
  - docs-analyze-xlsx
  - docs-analyze-markdown
  - docs-analyze-pdf
  - blueprint-orchestrator
  - design-orchestrator
  - spring-initializer
  - nestjs-initializer
  - django-initializer
  - nextjs-initializer
  - mobile-orchestrator
  - desktop-orchestrator
  - project-planner
  - feature-orchestrator
  - execution-orchestrator
  - validation-orchestrator
  - remediation-orchestrator
  - review-orchestrator
  - data-pipeline-orchestrator
  - doc-pipeline-orchestrator
  - vcs-orchestrator
  - deployment-orchestrator
inputs:
  - documents
  - target_stack
  - options
outputs:
  - application_blueprint
  - design_system
  - execution_plan
  - generated_artifacts
  - validation_report
  - review_summary
  - remaining_tasks
  - mobile_artifacts
  - desktop_artifacts
  - data_artifacts
  - doc_artifacts
  - deployment_artifact
---

# Goal

Receive project documents, build an application blueprint, and orchestrate the full
generation workflow. This skill **never generates code directly** — it only delegates,
sequences, and reports. The backend is selected via `target_stack.backend`
(`spring` | `nestjs` | `django`; default Spring Boot) and the default web client is Next.js;
additional clients (desktop/mobile) are generated when requested via `target_stack.clients`.

# Inputs

```yaml
documents: [requirements.docx, ui-design.pptx, api-spec.xlsx]
target_stack:
  backend: Spring Boot
  frontend: Next.js
  database: MariaDB
  clients: [web]        # web | desktop | mobile — web (Next.js) is default; desktop (Tauri) / mobile (Flutter) optional, multiple allowed
options:
  generate_tests: true
  max_remediation_iterations: 2
  compose_data: true    # optional; fill demo seed data + localize strings via data-pipeline-orchestrator
  compose_docs: true    # optional; generate handoff docs (API guide/release notes) via doc-pipeline-orchestrator
  init_vcs: true        # optional; commit the generated app to a work branch (branch-safe) via vcs-orchestrator
  deploy: true          # optional; runs deployment-orchestrator after review
```

# Output

```yaml
application_blueprint: architecture + domain + database + api overview
design_system: design tokens + design system (+ optional ux flows/wireframes)
execution_plan: epics/features/stories/tasks + dependency graph
generated_artifacts: backend + web (Next.js) frontend source
mobile_artifacts: Flutter app source (if 'mobile' in target_stack.clients)
desktop_artifacts: Tauri desktop shell (if 'desktop' in target_stack.clients)
validation_report: pass/fail + errors + warnings
review_summary: coverage + suggestions
remaining_tasks: unresolved after max remediation
data_artifacts: seed/demo data + localization catalogs (if compose_data)
doc_artifacts: handoff documents — API guide / release notes (if compose_docs)
vcs_artifacts: commits on a work branch + changelog/PR, branch-safe (if init_vcs)
deployment_artifact: CI/CD pipelines + per-environment config (if deploy)
```

# Workflow

## Step 1 — Analyze documents
Invoke the matching `docs-analyze-*` skill per file type → unified requirements.

## Step 2 — Build blueprint
Invoke `blueprint-orchestrator` → architecture, domain model, database, API spec.

## Step 2b — Build design foundation
Invoke `design-orchestrator` → design tokens + design system (and optional UX flows/wireframes).
Runs once at the app level; the resulting `design_system` is handed to the frontend generators.

## Step 2c — Initialize projects
Invoke the backend initializer matching `target_stack.backend` (`spring-initializer` /
`nestjs-initializer` / `django-initializer`) and `nextjs-initializer` for the web client **once**
→ build files, package structure, base config/profiles, and app skeleton. This scaffold must
exist before feature code is generated into it. Skip an initializer only when its target project
is already scaffolded (e.g. on rerun).

## Step 3 — Plan
Invoke `project-planner` → epics/features/stories/tasks + dependency graph.

## Step 4 — Generate features
For each feature, invoke `feature-orchestrator` (which fans out to backend/web/integration).
This produces the backend and the web (Next.js) client.

## Step 4b — Generate additional clients (conditional)
For each non-web entry in `target_stack.clients`, invoke the matching client orchestrator with
the `application_blueprint`, `design_system` (design tokens), and API spec: `mobile` →
`mobile-orchestrator` (Flutter), `desktop` → `desktop-orchestrator` (Tauri, reusing the web
React). Only `design-tokens` values and the backend `api-spec` are shared across clients; each
client owns its own UI. Collect their outputs into `mobile_artifacts` / `desktop_artifacts`.

## Step 5 — Resolve execution
Invoke `execution-orchestrator` → dependency resolution + parallel scheduling.

## Step 6 — Validate
Invoke `validation-orchestrator`. Mandatory before review.

## Step 7 — Remediate (conditional)
If validation failed, invoke `remediation-orchestrator` (re-runs only affected tasks +
re-validates), bounded by `max_remediation_iterations`. Unresolved → remaining_tasks.

## Step 8 — Review
Invoke `review-orchestrator` → summary, coverage, suggestions, remaining tasks.

## Step 8b — Compose data (optional)
If `options.compose_data` is enabled, invoke `data-pipeline-orchestrator` to fill the app
with demo/test data and localized strings — using the generated domain model as the
seed-data `schema_source` and the frontend strings as the localization `source`. It returns
self-healed (validator-passing) `data_artifacts`. Runs after generation so the schema and
strings exist; independent of deploy.

## Step 8c — Compose docs (optional)
If `options.compose_docs` is enabled, invoke `doc-pipeline-orchestrator` to generate handoff
documentation from the built app — e.g. an API guide from the generated backend and release
notes from the changeset. It returns self-healed (style-passing) `documents`, which this
orchestrator surfaces as `doc_artifacts`. Runs after
generation so the code and changeset exist; independent of deploy.

## Step 8d — Version control (optional)
If `options.init_vcs` is enabled, invoke `vcs-orchestrator` to place the generated/changed
artifacts onto a **work branch** with Conventional Commits (and optionally changelog/PR),
never committing to a protected branch. Runs after generation so the files exist.

## Step 9 — Deploy (optional)
If `options.deploy` is enabled, invoke `deployment-orchestrator` → CI/CD pipelines + scripts and
per-environment config (no containers; deploy target owned by user infra). Runs only after
validation passes and review completes.

# Rules

- Never generate implementation code; always delegate.
- Never run review before validation completes.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Preserve traceability: every artifact references its source document + requirement id.
- On rerun, regenerate only artifacts whose requirements changed.

# Examples

Input:

```yaml
documents: [requirements.docx]
options: { generate_tests: true, max_remediation_iterations: 1 }
```

Output (abridged):

```
✔ analyze → 12 requirements
✔ blueprint → 3 modules, 8 entities
✔ plan → 4 features, 21 tasks
✔ generate → 47 backend files, 33 frontend files
✔ validate → 2 errors
↻ remediate (1/1) → 0 errors
✔ review → coverage 94%, 3 suggestions, 0 remaining tasks
```
