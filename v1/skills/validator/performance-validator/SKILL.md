---
name: performance-validator
description: Statically validate generated Spring Boot and Next.js artifacts for common performance anti-patterns, returning a structured pass/fail result. Run after code generation, before review.
version: 1.0.0
category: validator
tags:
  - validation
  - performance
  - spring-boot
  - nextjs
  - quality
model: inherit
invokes: []
inputs:
  - generated_backend_artifacts
  - generated_frontend_artifacts
  - blueprint
outputs:
  - validation_result
---

# Goal

Statically validate the generated backend and frontend for common performance anti-patterns
before handoff. This skill **only analyzes** — it never modifies code or runs load tests.
Failures are reported for the remediation loop.

# Inputs

Validated inputs (produced upstream): `generated_backend_artifacts`, `generated_frontend_artifacts`, `blueprint`.

# Scope

- Backend (Spring Boot): N+1 queries, missing pagination on collection endpoints, unindexed
  query columns, blocking I/O on request threads, missing caching on hot read paths
- Frontend (Next.js): oversized client bundles, missing memoization on large lists, unoptimized
  images, unnecessary client components, waterfall data fetching
- Cross-cutting: unbounded result sets, missing timeouts on outbound calls

# Checks

| id | check | severity |
|----|-------|----------|
| PF-01 | No N+1 query pattern (lazy association iterated without fetch join / batch) | error |
| PF-02 | Collection endpoints are paginated (no unbounded `findAll` to API) | error |
| PF-03 | Outbound/integration calls declare connect + read timeouts | error |
| PF-04 | Query filter/sort columns are indexed per the database_schema | warning |
| PF-05 | Hot read paths use caching where the blueprint specifies it | warning |
| PF-06 | `next/image` used for images; no raw `<img>` for app assets | warning |
| PF-07 | Large lists use virtualization/memoization; no inline funcs in hot render paths | warning |
| PF-08 | Server Components used by default; `"use client"` only where interactivity is needed | warning |

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
    checked_files: int
    error_count: int
    warning_count: int
```

# Examples

Input: generated backend + frontend for `order-history` + blueprint (db indexes, cache policy).

Output:

```yaml
validation_result:
  status: fail
  errors:
    - { id: PF-01, file: OrderService.java, message: "orders.getItems() iterated in loop → add fetch join or @BatchSize" }
    - { id: PF-02, file: OrderController.java, message: "GET /api/orders returns unbounded list → add Pageable" }
  warnings:
    - { id: PF-06, file: order-history-table.tsx, message: "raw <img> for product thumbnail → use next/image" }
  metrics: { checked_files: 18, error_count: 2, warning_count: 1 }
```
