---
name: django-test-generator
description: Generate tests for a Django feature — pytest unit tests for models/managers and DRF API tests (APITestCase/APIClient) for endpoints. Django peer of spring-test-generator.
version: 1.0.0
category: backend
tags:
  - django
  - test
  - pytest
  - drf
model: inherit
invokes:
  - django-senior-programmer
inputs:
  - feature
  - backend_artifact
outputs:
  - test_artifact
---

# Goal

Produce tests for the feature in Django: pytest unit tests for models/managers (business
rules) and DRF API tests for endpoints, covering the feature's rules and routes. Delegates
code to `django-senior-programmer`.

# Inputs

```yaml
feature: { id, name, stories }
backend_artifact: { models, api, ... }   # what to test
```

# Output

```yaml
test_artifact:
  unit: [<test_*.py for models/managers>]
  api: [<APITestCase for endpoints>]
  coverage_targets: [<rule/endpoint covered>]
```

# Workflow

## Step 1 — Unit tests
Test model/manager business rules with pytest + pytest-django (DB fixtures).

## Step 2 — API tests
Test endpoints with DRF `APITestCase`/`APIClient`, including auth and validation cases.

## Step 3 — Delegate & return
Delegate to `django-senior-programmer`; return `test_artifact`.

# Rules

- Cover the feature's business rules and every generated endpoint.
- Unit tests target models/managers; API tests exercise the HTTP layer.
- Tests must be deterministic; stub external services.
- Delegate file contents to `django-senior-programmer`.

# Examples

Input:

```yaml
feature: { id: FEAT-ORDER, stories: [Order API, Order Domain] }
backend_artifact: { models: [Order], api: [OrderViewSet] }
```

Output (abridged):

```yaml
test_artifact:
  unit: [test_order_model.py (total = sum(items))]
  api: [test_order_api.py (POST /orders 201, 400 on empty items, 401 unauth)]
  coverage_targets: ["invariant: total", "POST /orders"]
```
