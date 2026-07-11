---
name: django-celery-generator
description: Generate Celery async tasks and broker wiring for a feature (async work and broker-based messaging). Async/broker only — in-process reactions are django-signals-generator. Django peer of messaging-generator.
version: 1.0.0
category: backend
tags:
  - django
  - celery
  - async
  - messaging
model: inherit
invokes:
  - django-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - celery_artifact
---

# Goal

Produce Celery tasks and broker wiring for the feature: asynchronous work and broker-based
message publish/consume per the event topology, with retry/idempotency. Delegates code to
`django-senior-programmer`.

# Inputs

```yaml
feature: { id, name }
application_blueprint: { event_topology: { broker_messages: [...], transport } }
```

# Output

```yaml
celery_artifact:
  tasks: [ { name, retry, idempotent } ]
  broker: <transport (Redis/RabbitMQ)>
  producers: [<where enqueued/published>]
  consumers: [<task/consumer handler>]
```

# Workflow

## Step 1 — Define tasks
Create Celery tasks for async work and broker consumers per the topology.

## Step 2 — Producers & reliability
Add enqueue/publish points; set retry/backoff and make tasks idempotent.

## Step 3 — Delegate & return
Delegate to `django-senior-programmer`; return `celery_artifact`.

# Rules

- Async/broker only; in-process reactions are `django-signals-generator`; client-facing
  real-time is `django-channels-generator`.
- Scheduled triggering of tasks is `django-scheduler-generator` (Celery beat).
- Make tasks idempotent; configure retry/backoff.
- Delegate file contents to `django-senior-programmer`.

# Examples

Input:

```yaml
application_blueprint: { event_topology: { transport: redis, broker_messages: [OrderShipped] } }
```

Output (abridged):

```yaml
celery_artifact:
  tasks: [ { name: send_order_email, retry: 3, idempotent: true } ]
  broker: redis
  producers: ["signal receiver → send_order_email.delay(order_id)"]
  consumers: ["order_shipped consumer → update read model"]
```
