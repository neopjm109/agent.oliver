---
name: frontend-validator
description: Validate generated Next.js artifacts for component structure, React hook rules, accessibility basics, naming, and missing pages vs the plan, returning a structured pass/fail result. Run after code generation, before review.
version: 1.0.0
category: validator
tags:
  - validation
  - nextjs
  - react
  - accessibility
model: inherit
invokes: []
inputs:
  - generated_frontend_artifacts
  - frontend_plan
outputs:
  - validation_result
---

# Goal

Statically validate the generated Next.js frontend against the plan. This skill
**only analyzes** — it never modifies code. Findings are reported for the
remediation loop.

# Inputs

Validated inputs (produced upstream): `generated_frontend_artifacts`, `frontend_plan`.

# Scope

- Component structure (server/client boundary, single responsibility)
- React hook rules (top-level only, no conditional/loop calls, deps arrays)
- Accessibility basics (alt text, label association, semantic roles)
- Naming conventions (PascalCase components, camelCase hooks with `use` prefix)
- Missing pages/routes declared in the plan but not generated
- Plan↔code name traceability (generated components/routes keep the names the plan declared)

# Checks

| id | check | severity |
|----|-------|----------|
| FE-01 | Every planned page/route exists under `app/` (or `pages/`) | error |
| FE-02 | Hooks called only at top level, never conditionally or in loops | error |
| FE-03 | Components using hooks/browser APIs are marked `"use client"` | error |
| FE-04 | Interactive elements have accessible names (label/aria-label/alt) | error |
| FE-05 | Custom hooks are named `useX`; components are PascalCase | warning |
| FE-06 | `useEffect`/`useCallback`/`useMemo` declare complete dependency arrays | warning |
| FE-07 | No duplicated component implementing an already-generated component | warning |
| FE-08 | Generated components/routes keep the names declared in `frontend_plan` (a plan screen/component is not renamed or inlined into another) | warning |

# Pass/Fail Criteria

- **pass**: zero `error`-severity findings.
- **fail**: one or more `error` findings. `warning` findings do not fail the run but are reported.

# Output Schema

```yaml
validation_result:
  status: pass | fail
  errors:
    - { id: string, file: string, message: string }
  warnings:
    - { id: string, file: string, message: string }
  metrics:
    checked_components: int
    checked_files: int
    error_count: int
    warning_count: int
```

# Examples

Input: generated frontend for `dashboard` feature + plan listing 5 routes.

Output:

```yaml
validation_result:
  status: fail
  errors:
    - { id: FE-01, file: app/settings/page.tsx, message: "planned route /settings not generated" }
    - { id: FE-04, file: components/IconButton.tsx, message: "icon-only button missing aria-label" }
  warnings:
    - { id: FE-06, file: hooks/useOrders.ts, message: "useEffect missing dependency 'filter'" }
  metrics: { checked_components: 14, checked_files: 22, error_count: 2, warning_count: 1 }
```
