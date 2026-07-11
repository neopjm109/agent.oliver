---
name: nestjs-api-generator
description: Generate the NestJS API layer for a feature — controllers, DTOs with class-validator, and mappers — from the blueprint api-spec. Thin controllers only; no business logic. NestJS peer of api-generator.
version: 1.0.0
category: backend
tags:
  - nestjs
  - api
  - controller
  - dto
model: inherit
invokes:
  - nestjs-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - api_artifact
---

# Goal

Produce the feature's HTTP API in NestJS from the api-spec: controllers, request/response
DTOs validated with class-validator, and mappers between DTOs and domain. Controllers stay
thin and delegate to domain providers. Delegates code to `nestjs-senior-programmer`.

# Inputs

```yaml
feature: { id, name }
application_blueprint: { api_specification: { endpoints: [...] } }
```

# Output

```yaml
api_artifact:
  controllers: [<controller with routes>]
  dtos: [<request/response DTO with validation>]
  mappers: [<DTO ↔ domain mapper>]
```

# Workflow

## Step 1 — Map endpoints
For each api-spec endpoint, define a controller route and its DTOs.

## Step 2 — Validate inputs
Add class-validator decorators to request DTOs per the spec.

## Step 3 — Map & delegate
Add DTO↔domain mappers; keep controllers thin. Delegate to `nestjs-senior-programmer`.

## Step 4 — Return
Return `api_artifact`.

# Rules

- Implement only endpoints present in the api-spec; never invent routes/fields.
- Controllers thin — no business logic; delegate to domain providers.
- Use class-validator DTOs for all request bodies/queries.
- Runtime OpenAPI decorators are `nestjs-api-docs-generator`; the design contract is
  `api-spec-generator` (blueprint). Do not duplicate their roles.

# Examples

Input:

```yaml
application_blueprint: { api_specification: { endpoints: [ { method: POST, path: /orders, request: {items, customerId} } ] } }
```

Output (abridged):

```yaml
api_artifact:
  controllers: [OrderController (POST /orders → OrderService.place)]
  dtos: [PlaceOrderDto (@IsArray items, @IsInt customerId)]
  mappers: [OrderMapper (PlaceOrderDto → Order)]
```
