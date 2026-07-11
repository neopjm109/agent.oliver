---
name: nestjs-test-generator
description: Generate tests for a NestJS feature — Jest unit tests for providers and e2e tests (supertest) for controllers. NestJS peer of spring-test-generator.
version: 1.0.0
category: backend
tags:
  - nestjs
  - test
  - jest
  - e2e
model: inherit
invokes:
  - nestjs-senior-programmer
inputs:
  - feature
  - backend_artifact
outputs:
  - test_artifact
---

# Goal

Produce tests for the feature in NestJS: Jest unit tests for domain providers/services and
e2e tests (supertest) for controllers, covering the feature's rules and endpoints. Delegates
code to `nestjs-senior-programmer`.

# Inputs

```yaml
feature: { id, name, stories }
backend_artifact: { domain, api, ... }   # what to test
```

# Output

```yaml
test_artifact:
  unit: [<*.spec.ts for providers>]
  e2e: [<*.e2e-spec.ts for controllers>]
  coverage_targets: [<rule/endpoint covered>]
```

# Workflow

## Step 1 — Unit tests
Test domain providers/services, including business-rule invariants, with mocked repositories.

## Step 2 — E2E tests
Test controllers end-to-end with supertest against a test module/DB.

## Step 3 — Delegate & return
Delegate to `nestjs-senior-programmer`; return `test_artifact`.

# Rules

- Cover the feature's business rules and every generated endpoint.
- Unit tests mock persistence; e2e tests exercise the HTTP layer.
- Tests must be deterministic; no reliance on external services (stub them).
- Delegate file contents to `nestjs-senior-programmer`.

# Examples

Input:

```yaml
feature: { id: FEAT-ORDER, stories: [Order API, Order Domain] }
backend_artifact: { domain: [OrderService], api: [OrderController] }
```

Output (abridged):

```yaml
test_artifact:
  unit: [order.service.spec.ts (total = sum(items))]
  e2e: [order.e2e-spec.ts (POST /orders 201, 400 on empty items)]
  coverage_targets: ["invariant: total", "POST /orders"]
```
