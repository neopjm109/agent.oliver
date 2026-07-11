---
name: nestjs-observability-generator
description: Generate observability for a NestJS feature — structured logging (pino), metrics, tracing (OpenTelemetry), and health checks (Terminus). NestJS peer of observability-generator.
version: 1.0.0
category: backend
tags:
  - nestjs
  - observability
  - logging
  - metrics
model: inherit
invokes:
  - nestjs-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - observability_artifact
---

# Goal

Produce observability for the feature in NestJS: structured logging (pino), metrics, tracing
(OpenTelemetry), and health indicators (Terminus). Delegates code to `nestjs-senior-programmer`.

# Inputs

```yaml
feature: { id, name }
application_blueprint: { observability: { metrics: [...], health: [...] } }
```

# Output

```yaml
observability_artifact:
  logging: <structured pino logger config>
  metrics: [<counter/histogram>]
  tracing: <OTel spans on key paths>
  health: [<Terminus indicator>]
```

# Workflow

## Step 1 — Logging
Configure structured pino logging with request context.

## Step 2 — Metrics & tracing
Add metrics for key operations and OTel tracing on request/DB/broker spans.

## Step 3 — Health
Add Terminus health indicators (DB, broker, cache).

## Step 4 — Delegate & return
Delegate to `nestjs-senior-programmer`; return `observability_artifact`.

# Rules

- Base bootstrap/logging is `nestjs-initializer`; this adds feature-level observability.
- Emit structured logs (no string concatenation); include correlation IDs.
- Cover the health of the feature's external dependencies.
- Delegate file contents to `nestjs-senior-programmer`.

# Examples

Input:

```yaml
application_blueprint: { observability: { metrics: [orders_placed_total], health: [db] } }
```

Output (abridged):

```yaml
observability_artifact:
  logging: "pino, request-id interceptor"
  metrics: [orders_placed_total (counter)]
  tracing: "OTel span on OrderService.place"
  health: [TypeOrmHealthIndicator]
```
