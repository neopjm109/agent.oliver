---
name: django-api-docs-generator
description: Generate runtime OpenAPI documentation for a Django feature using drf-spectacular — schema annotations on serializers/viewsets and Swagger/Redoc UI. Runtime docs only. Django peer of api-docs-generator.
version: 1.0.0
category: backend
tags:
  - django
  - api-docs
  - drf-spectacular
  - openapi
model: inherit
invokes:
  - django-senior-programmer
inputs:
  - feature
  - api_artifact
outputs:
  - api_docs_artifact
---

# Goal

Produce runtime API documentation for the feature using drf-spectacular: schema annotations
on serializers/viewsets so an OpenAPI schema + Swagger/Redoc UI are served. Delegates code to
`django-senior-programmer`.

# Inputs

```yaml
feature: { id, name }
api_artifact: { serializers: [...], viewsets: [...] }   # from django-api-generator
```

# Output

```yaml
api_docs_artifact:
  annotations: [<@extend_schema on viewsets/serializers>]
  schema_setup: <SpectacularAPIView + Swagger/Redoc urls (once)>
```

# Workflow

## Step 1 — Annotate
Add `@extend_schema`/`@extend_schema_field` to viewsets and serializers as needed.

## Step 2 — Wire schema UI
Ensure SpectacularAPIView + Swagger/Redoc URLs are registered (once).

## Step 3 — Delegate & return
Delegate to `django-senior-programmer`; return `api_docs_artifact`.

# Rules

- Runtime OpenAPI only; the design-time contract is `api-spec-generator` (blueprint), and the
  human-readable API guide is `docwriting/api-guide-generator`.
- Annotate only endpoints/serializers that exist in `api_artifact`; never invent.
- Keep docs in sync with serializer validation.
- Delegate file contents to `django-senior-programmer`.

# Examples

Input:

```yaml
api_artifact: { serializers: [OrderSerializer], viewsets: [OrderViewSet] }
```

Output (abridged):

```yaml
api_docs_artifact:
  annotations: ["@extend_schema(tags=['orders']) on OrderViewSet.create"]
  schema_setup: "SpectacularAPIView + /api/schema/swagger-ui/"
```
