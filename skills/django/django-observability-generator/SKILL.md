---
name: django-observability-generator
description: Generate observability for a Django feature — structured logging, metrics, tracing (OpenTelemetry), and health checks. Django peer of observability-generator.
version: 1.0.0
category: backend
tags:
  - django
  - observability
  - logging
  - metrics
model: inherit
invokes:
  - django-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - observability_artifact
---

# Goal

Produce observability for the feature in Django: structured logging config, metrics,
tracing (OpenTelemetry), and health endpoints. Delegates code to `django-senior-programmer`.

# Inputs

```yaml
feature: { id, name }
application_blueprint: { observability: { metrics: [...], health: [...] } }
```

# Output

```yaml
observability_artifact:
  logging: <structured LOGGING config / middleware>
  metrics: [<counter/histogram>]
  tracing: <OTel instrumentation on key paths>
  health: [<health check endpoint>]
```

# Workflow

## Step 1 — Logging
Configure structured logging (JSON) and request-context middleware.

## Step 2 — Metrics & tracing
Add metrics for key operations and OTel tracing on request/DB/task spans.

## Step 3 — Health
Add health checks for DB, cache, and broker.

## Step 4 — Delegate & return
Delegate to `django-senior-programmer`; return `observability_artifact`.

# Rules

- Base settings/logging skeleton is `django-initializer`; this adds feature-level observability.
- Emit structured logs with correlation IDs; avoid print/string logs.
- Cover the health of the feature's external dependencies.
- Delegate file contents to `django-senior-programmer`.

# Examples

Input:

```yaml
application_blueprint: { observability: { metrics: [orders_placed_total], health: [db] } }
```

Output (abridged):

```yaml
observability_artifact:
  logging: "JSON logging + request-id middleware"
  metrics: [orders_placed_total (counter)]
  tracing: "OTel span on OrderViewSet.create"
  health: ["/healthz (db, cache)"]
```
