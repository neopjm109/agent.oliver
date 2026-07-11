---
name: nestjs-notification-generator
description: Generate notification delivery for a NestJS feature — email/SMS/push via provider adapters, with templates and retry. NestJS peer of notification-generator.
version: 1.0.0
category: backend
tags:
  - nestjs
  - notification
  - email
  - push
model: inherit
invokes:
  - nestjs-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - notification_artifact
---

# Goal

Produce notification delivery for the feature in NestJS: email/SMS/push via provider adapters
with templates and retry. Delegates code to `nestjs-senior-programmer`.

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
  senders: [<provider adapter + retry>]
  triggers: [<event → notification>]
```

# Workflow

## Step 1 — Channels & templates
Set up the required channels and message templates.

## Step 2 — Senders & triggers
Implement provider adapters with retry; wire triggers (often via queued jobs/events).

## Step 3 — Delegate & return
Delegate to `nestjs-senior-programmer`; return `notification_artifact`.

# Rules

- Email/SMS/push only; generic external HTTP is `nestjs-integration-generator`; file/object storage
  is `nestjs-file-storage-generator`.
- Send asynchronously (queue) for reliability; add retry/backoff.
- Never hardcode provider secrets; bind from config.
- Delegate file contents to `nestjs-senior-programmer`.

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
  senders: [SmtpAdapter (retry 3)]
  triggers: ["order.placed → send order-confirm"]
```
