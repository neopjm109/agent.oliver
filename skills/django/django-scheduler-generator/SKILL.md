---
name: django-scheduler-generator
description: Generate scheduled tasks for a feature using Celery beat (periodic schedules). Schedule triggers only — bulk/one-off jobs are django-task-generator. Django peer of scheduler-generator.
version: 1.0.0
category: backend
tags:
  - django
  - scheduler
  - celery-beat
model: inherit
invokes:
  - django-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - scheduler_artifact
---

# Goal

Produce periodic schedules for the feature using Celery beat: cron/interval entries that
trigger Celery tasks. Triggers only — the work runs in Celery tasks. Delegates code to
`django-senior-programmer`.

# Inputs

```yaml
feature: { id, name }
application_blueprint: { schedules: [ { name, cron } ] }
```

# Output

```yaml
scheduler_artifact:
  beat_schedule: [ { name, schedule, task } ]
```

# Workflow

## Step 1 — Define beat entries
Create `CELERY_BEAT_SCHEDULE` entries (crontab/interval) per required schedules.

## Step 2 — Point to tasks
Each entry triggers a Celery task (from `django-celery-generator` / `django-task-generator`).

## Step 3 — Delegate & return
Delegate to `django-senior-programmer`; return `scheduler_artifact`.

# Rules

- Scheduling triggers only; bulk/one-off jobs are `django-task-generator`; async work runs
  in Celery tasks (`django-celery-generator`).
- Follow the blueprint's schedule definitions; never invent schedules.
- Keep the beat entry thin — it only triggers a task.
- Delegate file contents to `django-senior-programmer`.

# Examples

Input:

```yaml
application_blueprint: { schedules: [ { name: expire-carts, cron: "0 * * * *" } ] }
```

Output (abridged):

```yaml
scheduler_artifact:
  beat_schedule:
    - { name: expire-carts, schedule: "crontab(minute=0)", task: "apps.cart.tasks.expire_carts" }
```
