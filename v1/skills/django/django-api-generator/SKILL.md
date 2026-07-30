---
name: django-api-generator
description: Generate the DRF API layer for a feature — serializers, viewsets, and routers — from the blueprint api-spec. Thin viewsets only; no business logic. Django peer of api-generator.
version: 1.0.0
category: backend
tags:
  - django
  - api
  - drf
  - serializer
model: inherit
invokes:
  - django-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - api_artifact
---

# Goal

Produce the feature's HTTP API with Django REST Framework from the api-spec: serializers
(validation), viewsets/views, and router wiring. Viewsets stay thin and delegate to
models/managers. Delegates code to `django-senior-programmer`.

# Inputs

```yaml
feature: { id, name }
application_blueprint: { api_specification: { endpoints: [...] } }
```

# Output

```yaml
api_artifact:
  serializers: [<DRF serializer with validation>]
  viewsets: [<viewset/view with routes>]
  routers: [<url routing>]
```

# Workflow

## Step 1 — Serializers
For each resource, define a DRF serializer with field validation per the spec.

## Step 2 — Viewsets & routing
Add viewsets/views for the endpoints and register routers/urls.

## Step 3 — Delegate & return
Keep viewsets thin. Delegate to `django-senior-programmer`; return `api_artifact`.

# Rules

- Implement only endpoints present in the api-spec; never invent routes/fields.
- Viewsets thin — business logic in models/managers/services.
- Use DRF serializers for validation; respect the spec's request/response shapes.
- Runtime OpenAPI is `django-api-docs-generator` (drf-spectacular); the design contract is
  `api-spec-generator` (blueprint). Do not duplicate their roles.

# Examples

Input:

```yaml
application_blueprint: { api_specification: { endpoints: [ { method: POST, path: /orders, request: {items, customerId} } ] } }
```

Output (abridged):

```yaml
api_artifact:
  serializers: [OrderSerializer (items, customer_id validated)]
  viewsets: [OrderViewSet (create → OrderManager.create_with_items)]
  routers: ["router.register('orders', OrderViewSet)"]
```
