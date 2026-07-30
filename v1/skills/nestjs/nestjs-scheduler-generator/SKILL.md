---
name: nestjs-scheduler-generator
description: Generate scheduled tasks for a feature using @nestjs/schedule (cron/interval/timeout). Schedule triggers only — bulk/background jobs are nestjs-queue-generator. NestJS peer of scheduler-generator.
version: 1.0.0
category: backend
tags:
  - nestjs
  - scheduler
  - cron
model: inherit
invokes:
  - nestjs-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - scheduler_artifact
---

# Goal

Produce scheduled triggers for the feature in NestJS using `@nestjs/schedule`
(`@Cron`/`@Interval`/`@Timeout`). Triggers only — heavy work is delegated to queued jobs.
Delegates code to `nestjs-senior-programmer`.

# Inputs

```yaml
feature: { id, name }
application_blueprint: { schedules: [ { name, cron } ] }
```

# Output

```yaml
scheduler_artifact:
  tasks: [ { name, trigger: cron|interval, expr, action } ]
```

# Workflow

## Step 1 — Define triggers
Create `@Cron`/`@Interval` handlers per the required schedules.

## Step 2 — Delegate heavy work
For long/bulk work, enqueue to a BullMQ job (`nestjs-queue-generator`) rather than running
inline in the scheduled handler.

## Step 3 — Delegate & return
Delegate to `nestjs-senior-programmer`; return `scheduler_artifact`.

# Rules

- Scheduling triggers only; bulk/background processing is `nestjs-queue-generator`.
- Keep scheduled handlers thin; offload heavy work to queues.
- Follow the blueprint's schedule definitions; never invent schedules.
- Delegate file contents to `nestjs-senior-programmer`.

# Examples

Input:

```yaml
application_blueprint: { schedules: [ { name: expire-carts, cron: "0 * * * *" } ] }
```

Output (abridged):

```yaml
scheduler_artifact:
  tasks: [ { name: expire-carts, trigger: cron, expr: "0 * * * *", action: "enqueue cart-expiry job" } ]
```
