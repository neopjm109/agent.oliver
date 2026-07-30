---
name: security-validator
description: Validate generated backend and frontend artifacts for authentication/authorization presence, input validation, secrets handling, and common OWASP issues, returning a structured pass/fail result. Run after code generation, before review.
version: 1.0.0
category: validator
tags:
  - validation
  - security
  - owasp
  - authn-authz
model: inherit
invokes: []
inputs:
  - generated_backend_artifacts
  - generated_frontend_artifacts
  - security_plan
outputs:
  - validation_result
---

# Goal

Statically validate the generated code for common security weaknesses. This skill
**only analyzes** — it never modifies code. Findings are reported for the
remediation loop.

# Inputs

Validated inputs (produced upstream): `generated_backend_artifacts`, `generated_frontend_artifacts`, `security_plan`.

# Scope

- Authentication presence on non-public endpoints
- Authorization checks (role/ownership) on protected resources
- Input validation on request DTOs and query parameters
- Secrets handling (no hardcoded credentials/keys/tokens)
- Common OWASP issues: injection, broken access control, sensitive data exposure,
  security misconfiguration

# Checks

| id | check | severity |
|----|-------|----------|
| SE-01 | Every endpoint not declared public in the plan requires authentication | error |
| SE-02 | Protected/owned resources enforce authorization (role or ownership check) | error |
| SE-03 | No hardcoded secrets (passwords, API keys, tokens) in source or config | error |
| SE-04 | Request DTOs and params carry input validation (Bean Validation / schema) | error |
| SE-05 | No raw/concatenated SQL from user input (use parameterized queries/JPA) | error |
| SE-06 | Sensitive fields (password, token) are not returned in API responses | error |
| SE-07 | Security-relevant config disabled in prod is not committed (CSRF, CORS `*`, debug) | warning |
| SE-08 | Errors do not leak stack traces or internal details to clients | warning |

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
    checked_files: int
    error_count: int
    warning_count: int
```

# Examples

Input: backend + frontend for `payments` feature + security plan marking all
endpoints authenticated.

Output:

```yaml
validation_result:
  status: fail
  errors:
    - { id: SE-01, file: PaymentController.java, message: "POST /api/payments has no auth annotation" }
    - { id: SE-03, file: application.yml, message: "hardcoded db password 'root123'" }
    - { id: SE-06, file: UserResponse.java, message: "passwordHash exposed in response DTO" }
  warnings:
    - { id: SE-07, file: SecurityConfig.java, message: "CORS allows '*' origin" }
  metrics: { checked_endpoints: 5, checked_files: 20, error_count: 3, warning_count: 1 }
```
