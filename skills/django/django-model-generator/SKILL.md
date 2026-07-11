---
name: django-model-generator
description: Generate the Django model layer for a feature — models, managers/querysets, and business rules — from the blueprint domain model. Django peer of domain-generator.
version: 1.0.0
category: backend
tags:
  - django
  - model
  - orm
model: inherit
invokes:
  - django-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - model_artifact
---

# Goal

Produce the feature's model layer in Django from the stack-neutral domain model: models,
custom managers/querysets, and business rules (fat models where appropriate). Delegates code
to `django-senior-programmer`.

# Inputs

```yaml
feature: { id, name, stories }
application_blueprint: { domain_model, database_schema }
```

# Output

```yaml
model_artifact:
  models: [<Django model + fields + relations>]
  managers: [<custom manager/queryset>]
  rules: [<invariant/method on model>]
```

# Workflow

## Step 1 — Map the domain model
Translate blueprint entities/relations into Django models with correct field types/relations.

## Step 2 — Encode rules
Place invariants/business methods on models or managers (not views).

## Step 3 — Delegate & return
Delegate implementation to `django-senior-programmer`; return `model_artifact`.

# Rules

- Follow the blueprint domain model exactly; never invent models or fields.
- Business logic in models/managers/services; keep it out of views.
- Use Django ORM relations (FK/M2M) per the design; add `Meta` where needed.
- Delegate file contents to `django-senior-programmer`.

# Examples

Input:

```yaml
application_blueprint: { domain_model: { Order: { items, total }, OrderItem: {...} } }
```

Output (abridged):

```yaml
model_artifact:
  models: [Order (items → related OrderItem), OrderItem]
  managers: [OrderManager.create_with_items()]
  rules: ["total = sum(item.subtotal)"]
```
