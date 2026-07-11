---
name: django-notification-generator
description: Generate notification delivery for a Django feature — email/SMS/push via backends/adapters, with templates and async sending via Celery. Django peer of notification-generator.
version: 1.0.0
category: backend
tags:
  - django
  - notification
  - email
  - push
model: inherit
invokes:
  - django-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - notification_artifact
---

# Goal

Produce notification delivery for the feature in Django: email/SMS/push via backends/adapters
with templates, sent asynchronously via Celery. Delegates code to `django-senior-programmer`.

# Inputs

```yaml
feature: { id, name }
application_blueprint: { notifications: [ { channel, event, template } ] }
```

# Output

```yaml
notification_artifact:
  channels: [email | sms | push]
  templates: [<template ref>]
  senders: [<backend/adapter + retry>]
  triggers: [<signal/event → notification via Celery>]
```

# Workflow

## Step 1 — Channels & templates
Set up channels (email backend/SMS/push adapter) and message templates.

## Step 2 — Async senders & triggers
Send via Celery tasks with retry; wire triggers from signals/events.

## Step 3 — Delegate & return
Delegate to `django-senior-programmer`; return `notification_artifact`.

# Rules

- Email/SMS/push only; generic external HTTP is `django-integration-generator`; file/object storage
  is `django-storage-generator`.
- Send asynchronously via Celery for reliability; add retry.
- Never hardcode provider secrets; bind from settings/env.
- Delegate file contents to `django-senior-programmer`.

# Examples

Input:

```yaml
application_blueprint: { notifications: [ { channel: email, event: order.placed, template: order-confirm } ] }
```

Output (abridged):

```yaml
notification_artifact:
  channels: [email]
  templates: [order-confirm]
  senders: [EmailBackend via send_order_email task (retry 3)]
  triggers: ["post_save(Order) → send_order_email.delay"]
```
