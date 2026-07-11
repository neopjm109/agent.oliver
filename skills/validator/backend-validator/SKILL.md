---
name: backend-validator
description: Validate generated backend artifacts for the selected stack (Spring Boot, NestJS, or Django) against the blueprint — layer boundaries, API↔DTO/serializer consistency, entity↔domain_model consistency, naming, and missing components — returning a structured pass/fail result. Run after code generation, before review.
version: 1.0.0
category: validator
tags:
  - validation
  - backend
  - multi-stack
  - quality
model: inherit
invokes: []
inputs:
  - generated_backend_artifacts
  - blueprint
  - target_stack
outputs:
  - validation_result
---

# Goal

Statically validate the generated backend against the blueprint, applying the conventions of
the stack named in `target_stack.backend` (`spring`, `nestjs`, or `django`). This skill
**only analyzes** — it never modifies code. Failures are reported for the remediation loop.

The check *intent* is the same across stacks; only its concrete manifestation differs. The
validator resolves the stack first, then applies that stack's rule mapping.

# Inputs

Validated inputs (produced upstream): `generated_backend_artifacts`, `blueprint`, `target_stack`.

# Scope

- Layer boundaries (thin transport layer → service/domain → persistence)
- API ↔ request/response shape consistency vs the api_specification
- Entity/model ↔ domain_model consistency
- Naming/layout conventions for the stack
- Missing components (declared in plan/blueprint but not generated)

# Stack resolution

Read `target_stack.backend`. Apply the matching column below. If unset, default to `spring`.
If unknown, return a single `error` (`BE-00`, "unsupported backend stack") and stop.

# Checks

Each check is stack-neutral in intent; the table gives its per-stack manifestation.

| id | intent | spring | nestjs | django | severity |
|----|--------|--------|--------|--------|----------|
| BE-01 | Transport layer has no business logic | Controllers delegate to services | Controllers delegate to providers | ViewSets/views delegate to models/managers/services | error |
| BE-02 | Persistence types not leaked in API | No JPA entity in responses | No TypeORM entity returned raw (use DTO) | No model returned without a serializer | error |
| BE-03 | Every planned endpoint is implemented | Controller method exists | Controller route exists | ViewSet action/route exists | error |
| BE-04 | Request DTOs wire a validation mechanism (presence/shape only; adequacy owned by security SE-04) | Bean Validation on request DTOs | class-validator on request DTOs | Serializer field validation | warning |
| BE-05 | Naming/layout matches stack conventions | package/class naming | module/provider naming | app/module naming | warning |
| BE-06 | Entities/models match the domain_model | JPA entities vs model | TypeORM entities vs model | Django models vs model | error |

# Pass/Fail Criteria

- **pass**: zero `error`-severity findings.
- **fail**: one or more `error` findings. `warning` findings are reported but do not fail the run.

# Output Schema

```yaml
validation_result:
  status: pass | fail
  stack: spring | nestjs | django
  errors:
    - { id: string, file: string, message: string }
  warnings:
    - { id: string, file: string, message: string }
  metrics:
    checked_files: int
    error_count: int
    warning_count: int
```

# Rules

- Analyze only; never modify code (remediation is a separate stage).
- Resolve `target_stack.backend` first and apply only that stack's rule mapping; do not flag
  a NestJS artifact for lacking Spring annotations, etc.
- Judge against the blueprint (api_specification, domain_model), not assumptions.
- Deterministic verdict: any `error` finding forces `fail`.
- Report `stack` in the result so downstream knows which conventions were applied.

# Examples

Input: generated NestJS backend for `user-management` + blueprint with 3 endpoints;
`target_stack.backend: nestjs`.

Output:

```yaml
validation_result:
  status: fail
  stack: nestjs
  errors:
    - { id: BE-03, file: user.controller.ts, message: "planned DELETE /api/users/:id route missing" }
    - { id: BE-02, file: user.controller.ts, message: "raw User entity returned; map to a response DTO" }
  warnings:
    - { id: BE-04, file: create-user.dto.ts, message: "email field missing @IsEmail" }
  metrics: { checked_files: 11, error_count: 2, warning_count: 1 }
```

Input: generated Spring backend, `target_stack.backend: spring`.

Output:

```yaml
validation_result:
  status: fail
  stack: spring
  errors:
    - { id: BE-03, file: UserController.java, message: "planned DELETE /api/users/{id} missing" }
  warnings:
    - { id: BE-04, file: CreateUserRequest.java, message: "email field missing @Email" }
  metrics: { checked_files: 12, error_count: 1, warning_count: 1 }
```
