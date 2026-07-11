---
name: architecture-validator
description: Validate the generated codebase against the architecture design for layer separation, module boundaries, and dependency direction, returning a structured pass/fail result. Stack-aware — ORM/DI annotations on domain classes are idiomatic (not violations) for Spring/NestJS/Django; only genuine infrastructure leaks and inner→outer dependencies fail. Run after code generation, before review.
version: 1.0.0
category: validator
tags:
  - validation
  - architecture
  - layering
  - dependencies
  - multi-stack
model: inherit
invokes: []
inputs:
  - generated_artifacts
  - architecture_design
  - target_stack
outputs:
  - validation_result
---

# Goal

Statically validate the generated codebase against the architecture design. This
skill **only analyzes** — it never modifies code. Findings are reported for the
remediation loop.

# Inputs

Validated inputs (produced upstream): `generated_artifacts`, `architecture_design`, and
`target_stack` (optional). The backend stack is resolved from `target_stack.backend` when
present, otherwise from `architecture_design.technology_stack.backend`; default `spring`.
The stack only tunes AR-01 (see Stack resolution); all other checks are stack-neutral.

# Scope

- Layer separation (presentation / application / domain / infrastructure) — the domain core
  stays free of *genuine* infrastructure (web, external transport, broker, cache), but ORM/DI
  annotations that keep it persistable are accepted for annotation-based stacks (see AR-01)
- Module boundaries and inter-module coupling
- Dependency direction vs the blueprint (inner layers must not depend on outer)
- Circular dependency detection
- Architecture-style consistency (declared monolith/modular structure honored)
- Missing modules declared in the blueprint but not generated

# Stack resolution

Resolve the backend stack (`spring` | `nestjs` | `django`, default `spring`) as described in
Inputs. For all annotation-based ORM stacks, persistence/DI **annotations and repository base
types** on domain classes are the idiomatic pattern and are **not** AR-01 violations:

| stack | accepted on domain classes (not AR-01) |
|-------|-----------------------------------------|
| spring | `jakarta.persistence.*` / `@Entity` `@Embeddable` `@Column` …; Spring Data `JpaRepository`; DI stereotypes `@Service` `@Transactional` `@Component` |
| nestjs | TypeORM `@Entity` `@Column` … + repository interfaces; `@Injectable` |
| django | `django.db.models` model base classes + managers |

What stays an AR-01 error on domain classes regardless of stack (genuine infrastructure leaking
into the core): **web/presentation** frameworks (`org.springframework.web.*`, controllers, HTTP
request/response types), **external transport/integration clients** (HTTP clients, `RestTemplate`,
message-broker/cache SDKs), and any import of the **api/presentation layer** (the latter is also
AR-02). If — and only if — `architecture_design` explicitly declares a strict domain-purity style
(`hexagonal`, `ports-and-adapters`, `clean`, or `onion`), the annotation allowance is withdrawn
and ORM/DI coupling on domain classes returns to an AR-01 error, since that style demands a pure
domain with a separate persistence-model layer.

# Checks

| id | check | severity |
|----|-------|----------|
| AR-01 | Domain layer has no *genuine* infrastructure/framework import — per Stack resolution, ORM/DI annotations are accepted for annotation-based stacks (unless a strict domain-purity style is declared); web, external transport, broker/cache, and api-layer imports are always violations | error |
| AR-02 | Dependency direction matches blueprint (no inner→outer references) | error |
| AR-03 | No circular dependency between modules/packages | error |
| AR-04 | Every module declared in the blueprint exists in the codebase | error |
| AR-05 | Cross-module access goes through declared public API, not internal packages. A module declared `kind: shared-kernel` (e.g. `common`, hosting shared value objects) is exempt: any module may import its types directly, and it must not depend on the modules that use it | error |
| AR-06 | Actual layering matches the blueprint's declared architecture style | warning |
| AR-07 | Module coupling (fan-out) stays within the blueprint's stated limit | warning |

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
    checked_modules: int
    checked_files: int
    error_count: int
    warning_count: int
```

# Examples

Input: generated codebase for `order-service` + architecture design declaring a
`modular-monolith` with `domain`, `application`, `infrastructure` layers and 4 modules;
`target_stack.backend: spring`.

Output:

```yaml
validation_result:
  status: fail
  errors:
    # NOTE: Order.java importing jakarta.persistence / @Entity is NOT flagged — idiomatic for spring
    - { id: AR-01, file: domain/order/OrderService.java, message: "domain imports org.springframework.web.client.RestTemplate (external transport belongs in the integration/infrastructure layer)" }
    - { id: AR-03, file: "billing<->catalog", message: "circular dependency detected" }
  warnings:
    - { id: AR-07, file: application/OrderFacade.java, message: "fan-out 9 exceeds blueprint limit 6" }
  metrics: { checked_modules: 4, checked_files: 58, error_count: 2, warning_count: 1 }
```

Contrast: had the same codebase declared a `hexagonal` style, the `jakarta.persistence`
imports on `domain/order/Order.java` *would* be an AR-01 error (pure domain required).
