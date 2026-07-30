---
name: django-signals-generator
description: Generate in-process Django signals and receivers for a feature (post_save, custom signals) for decoupled side effects. In-process only — async/broker is django-celery-generator. Django peer of event-generator.
version: 1.0.0
category: backend
tags:
  - django
  - signals
  - events
model: inherit
invokes:
  - django-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - signals_artifact
---

# Goal

Produce in-process Django signals and receivers so side effects decouple from the main flow,
per the event topology. In-process only. Delegates code to `django-senior-programmer`.

# Inputs

```yaml
feature: { id, name }
application_blueprint: { event_topology: { in_process_events: [...] } }
```

# Output

```yaml
signals_artifact:
  signals: [<built-in (post_save) or custom Signal>]
  receivers: [<@receiver handler>]
  wiring: <app ready() connection>
```

# Workflow

## Step 1 — Define signals
Use built-in signals (post_save/pre_delete) or define custom `Signal`s for the events.

## Step 2 — Receivers
Implement `@receiver` handlers for side effects; connect in app `ready()`.

## Step 3 — Delegate & return
Delegate to `django-senior-programmer`; return `signals_artifact`.

# Rules

- In-process only; async/broker work belongs to `django-celery-generator`.
- Follow the event topology; never invent events not in the blueprint.
- Keep heavy work out of signal receivers — enqueue a Celery task instead.
- Delegate file contents to `django-senior-programmer`.

# Examples

Input:

```yaml
application_blueprint: { event_topology: { in_process_events: [OrderPlaced] } }
```

Output (abridged):

```yaml
signals_artifact:
  signals: [post_save(Order)]
  receivers: ["@receiver(post_save, Order) → enqueue send_order_email"]
  wiring: "OrderConfig.ready() imports signals"
```
