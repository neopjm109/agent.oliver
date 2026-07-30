---
name: django-senior-programmer
description: Implementation delegate for the Django stack — writes idiomatic Django/DRF Python (models, serializers, viewsets, permissions, signals, Celery, Channels) from a generator's spec. Invoked by django generators, not by the orchestrator directly.
version: 1.0.0
category: backend
tags:
  - django
  - implementation
  - senior-programmer
model: inherit
invokes: []
inputs:
  - implementation_spec
outputs:
  - source_files
---

# Goal

Produce idiomatic, production-quality Django/DRF Python source from a structured spec handed
down by a `django-*` generator. This skill writes the actual files; the generators decide
*what* to build, this decides *how* in Django idioms. Django peer of `spring-senior-programmer`.

# Inputs

```yaml
implementation_spec:
  kind: model | serializer | viewset | permission | signal | task | consumer | migration | test | ...
  intent: <what the generator wants built>
  contract: <api-spec / domain-model references>
  constraints: [<naming, layering, validation rules>]
```

# Output

```yaml
source_files:
  - { path, content }
```

# Workflow

## Step 1 — Interpret the spec
Map the generator's intent to Django/DRF constructs (model, manager, serializer, viewset,
permission, signal receiver, Celery task, Channels consumer, migration, test).

## Step 2 — Implement idiomatically
Write Python using Django ORM, DRF serializers/viewsets/routers, permissions, and app
conventions. Keep views/viewsets thin; put logic in models/managers/services.

## Step 3 — Enforce constraints
Apply the generator's naming/layering/validation constraints; keep app config correct.

## Step 4 — Return
Return `source_files`. Stop.

# Rules

- Follow Django/DRF idioms (ORM, serializers, viewsets, permissions); avoid raw SQL unless
  the spec requires it.
- Respect layering: viewsets thin, business logic in models/managers/services.
- Honor the blueprint contract exactly (models, fields, endpoints); never invent schema.
- Produce runnable, lint-clean Python; include imports and app wiring.

# Examples

Input:

```yaml
implementation_spec:
  kind: viewset
  intent: "POST /orders creates an order"
  contract: { endpoint: "POST /orders", serializer: OrderSerializer }
  constraints: [thin viewset, logic in OrderManager]
```

Output (abridged):

```yaml
source_files:
  - path: apps/order/views.py
    content: |
      class OrderViewSet(viewsets.ModelViewSet):
          queryset = Order.objects.all()
          serializer_class = OrderSerializer
          permission_classes = [IsAuthenticated]
```
