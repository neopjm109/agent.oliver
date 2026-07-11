---
name: nestjs-api-docs-generator
description: Generate runtime OpenAPI/Swagger documentation for a NestJS feature using @nestjs/swagger decorators on controllers and DTOs. Runtime docs only. NestJS peer of api-docs-generator.
version: 1.0.0
category: backend
tags:
  - nestjs
  - api-docs
  - swagger
  - openapi
model: inherit
invokes:
  - nestjs-senior-programmer
inputs:
  - feature
  - api_artifact
outputs:
  - api_docs_artifact
---

# Goal

Produce runtime API documentation for the feature by adding `@nestjs/swagger` decorators to
controllers and DTOs so an OpenAPI spec + Swagger UI are served. Delegates code to
`nestjs-senior-programmer`.

# Inputs

```yaml
feature: { id, name }
api_artifact: { controllers: [...], dtos: [...] }   # from nestjs-api-generator
```

# Output

```yaml
api_docs_artifact:
  decorators: [<@ApiOperation/@ApiResponse/@ApiProperty on controllers/DTOs>]
  swagger_setup: <SwaggerModule bootstrap (once)>
```

# Workflow

## Step 1 — Annotate
Add `@ApiTags`/`@ApiOperation`/`@ApiResponse` to controllers and `@ApiProperty` to DTOs.

## Step 2 — Wire Swagger
Ensure `SwaggerModule` is set up in bootstrap (once).

## Step 3 — Delegate & return
Delegate to `nestjs-senior-programmer`; return `api_docs_artifact`.

# Rules

- Runtime OpenAPI/Swagger only; the design-time contract is `api-spec-generator` (blueprint),
  and the human-readable API guide is `docwriting/api-guide-generator`.
- Annotate only endpoints/DTOs that exist in `api_artifact`; never invent.
- Keep docs in sync with the actual DTO validation.
- Delegate file contents to `nestjs-senior-programmer`.

# Examples

Input:

```yaml
api_artifact: { controllers: [OrderController], dtos: [PlaceOrderDto] }
```

Output (abridged):

```yaml
api_docs_artifact:
  decorators: ["@ApiTags('orders')", "@ApiOperation(POST /orders)", "@ApiProperty on PlaceOrderDto"]
  swagger_setup: "SwaggerModule.setup('docs', app, doc)"
```
