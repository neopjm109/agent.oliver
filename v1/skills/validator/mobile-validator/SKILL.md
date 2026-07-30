---
name: mobile-validator
description: Validate generated Flutter (Dart) mobile artifacts against the blueprint and design — planned screens/routes exist, API client models match the api_specification DTOs (server-assigned fields omitted from write requests), every planned endpoint is called, form inputs enforce business rules, and theme derives from design tokens — returning a structured pass/fail result. Run after mobile code generation, before review. Distinct from frontend-validator (Next.js/React web) and desktop-shell-validator (Tauri).
version: 1.0.0
category: validator
tags:
  - validation
  - mobile
  - flutter
  - dart
model: inherit
invokes: []
inputs:
  - generated_mobile_artifacts
  - application_blueprint
  - design_system
  - frontend_plan
outputs:
  - validation_result
---

# Goal

Statically validate the generated Flutter mobile app against the blueprint (api_specification,
domain_model), the design system (tokens), and the frontend plan (screens/routes). This skill
**only analyzes** — it never modifies code. Findings are reported for the remediation loop.

This is the mobile counterpart of `frontend-validator` (which is Next.js/React-only and does not
apply to Dart) and is distinct from `desktop-shell-validator` (Tauri native shell). It closes the
gap where Flutter output had no static gate.

# Inputs

Validated inputs (produced upstream): `generated_mobile_artifacts` (the Flutter `lib/**` + `test/`),
`application_blueprint` (uses `api_specification`, `domain_model` incl. `write_policy`),
`design_system` (tokens), `frontend_plan` (planned screens/routes/components).

# Scope

- Screen/route completeness (every planned screen exists and is registered in navigation)
- API client ↔ api_specification consistency (DTO fields, endpoints, server-assigned fields)
- Business-rule enforcement in forms/inputs
- Async state handling (loading/error), theme-token fidelity, Dart conventions
- Plan↔code name traceability

Out of scope: runtime behavior, compiled `flutter analyze`/`flutter test` results (toolchain), and
web/desktop artifacts (see `frontend-validator` / `desktop-shell-validator`).

# Checks

| id | check | severity |
|----|-------|----------|
| FL-01 | Every screen/route declared in `frontend_plan` exists as a widget and is registered in the navigation/router | error |
| FL-02 | API client request/response models match `api_specification` DTO fields; write (POST/PUT/PATCH) request bodies omit fields marked server-assigned/derived in `domain_model.write_policy` (value objects expanded) | error |
| FL-03 | Every planned endpoint (method + path, incl. `base_path`) is called by the API client | error |
| FL-04 | Form/input widgets that submit data enforce the spec's field validation / business rules (e.g. required, `> 0`) before submit | error |
| FL-05 | Async API calls handle both loading and error states; no unawaited/unhandled `Future` on a user action | warning |
| FL-06 | Theme/styling derives from `design_system` tokens (colors/radius/spacing/typography), not arbitrary hardcoded values | warning |
| FL-07 | Dart conventions: `UpperCamelCase` types, `lowerCamelCase` members, `snake_case` file names, null-safety respected | warning |
| FL-08 | Each screen/component declared in `frontend_plan` maps to a traceably-named widget — a conventional suffix is fine (`PlaceOrder` → `PlaceOrderScreen`), but a plan-declared item must not be renamed to something unrelated or silently inlined into another widget | warning |

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
    checked_screens: int
    checked_files: int
    error_count: int
    warning_count: int
```

# Rules

- Analyze only; never modify code (remediation is a separate stage).
- Judge against the blueprint (api_specification, domain_model), design tokens, and the plan —
  not assumptions or a compiler run.
- Deterministic verdict: any `error` finding forces `fail`.
- Apply Dart/Flutter conventions only; do not flag Flutter code for lacking React/Next patterns.
- The `write_policy` in `domain_model` is authoritative for which fields a write request must carry;
  a request that includes a server-assigned field (or omits a client-supplied required one) is an FL-02 error.

# Examples

Input: generated Flutter app for `order` feature + plan with 2 screens (`/orders/new`,
`/orders/[id]`); `api_specification` with `POST /api/orders` + `GET /api/orders/{id}`;
`write_policy.Order.server_assigned: [id, status, total.currency]`.

Output:

```yaml
validation_result:
  status: fail
  errors:
    - { id: FL-03, file: lib/api/order_api.dart, message: "planned GET /api/orders/{id} not called by the API client" }
    - { id: FL-02, file: lib/models/order.dart, message: "CreateOrderRequest sends 'currency' — marked server-assigned in write_policy" }
  warnings:
    - { id: FL-06, file: lib/theme/app_theme.dart, message: "card color hardcoded; design_system 'card' token not derived" }
    - { id: FL-08, file: lib/screens/place_order_screen.dart, message: "plan screen 'PlaceOrderForm' generated as 'OrderForm'" }
  metrics: { checked_screens: 2, checked_files: 10, error_count: 2, warning_count: 2 }
```
