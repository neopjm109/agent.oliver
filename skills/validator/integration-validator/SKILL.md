---
name: integration-validator
description: Validate API contract consistency between the generated backend and frontend — endpoint/DTO matching and broken flows — returning a structured pass/fail result. Run after code generation, before review.
version: 1.0.0
category: validator
tags:
  - validation
  - integration
  - api-contract
  - dto
model: inherit
invokes: []
inputs:
  - generated_backend_artifacts
  - generated_frontend_artifacts
  - api_specification
outputs:
  - validation_result
---

# Goal

Statically validate that the generated frontend and backend agree on the API
contract defined by the api_specification. This skill **only analyzes** — it never modifies
code. Findings are reported for the remediation loop.

# Inputs

Validated inputs (produced upstream): `generated_backend_artifacts`, `generated_frontend_artifacts`, `api_specification`.

# Scope

- Endpoint match: every frontend API call targets an existing backend endpoint
- Method/path match between backend controllers and frontend client
- DTO/payload shape match (request body and response fields, types, required-ness)
- No orphaned backend endpoints unreachable from any frontend flow (informational)
- Broken flows: navigation/action chains that depend on a missing/mismatched call

# Checks

| id | check | severity |
|----|-------|----------|
| IN-01 | Every frontend API call maps to a backend endpoint (method + path) | error |
| IN-02 | Request DTO fields sent by frontend match backend request DTO (name/type/required) | error |
| IN-03 | Response fields consumed by frontend exist in backend response DTO | error |
| IN-04 | Backend endpoint and frontend client agree with the api_specification (no drift) | error |
| IN-05 | No user flow depends on an endpoint that is missing or contract-mismatched | error |
| IN-06 | Backend endpoint defined in api_specification but never called by frontend | warning |
| IN-07 | Enum/status values used by frontend are all defined by backend | warning |

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
    checked_endpoints: int
    checked_calls: int
    error_count: int
    warning_count: int
```

# Examples

Input: backend + frontend for `user-management` + api_specification with 6 endpoints.

Output:

```yaml
validation_result:
  status: fail
  errors:
    - { id: IN-01, file: lib/api/users.ts, message: "PATCH /api/users/{id}/role has no backend endpoint" }
    - { id: IN-03, file: components/UserCard.tsx, message: "reads 'displayName' absent from UserResponse DTO" }
  warnings:
    - { id: IN-06, file: UserController.java, message: "GET /api/users/{id}/audit never called by frontend" }
  metrics: { checked_endpoints: 6, checked_calls: 9, error_count: 2, warning_count: 1 }
```
