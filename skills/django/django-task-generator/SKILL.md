---
name: django-task-generator
description: Generate bulk/one-off jobs for a feature as Django management commands (and/or batch Celery tasks) for data processing and admin operations. Bulk/one-off only. Django peer of batch-generator.
version: 1.0.0
category: backend
tags:
  - django
  - management-command
  - batch
  - jobs
model: inherit
invokes:
  - django-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - task_artifact
---

# Goal

Produce bulk and one-off jobs for the feature as Django management commands (and batch Celery
tasks where async), for data processing, backfills, and admin operations. Delegates code to
`django-senior-programmer`.

# Inputs

```yaml
feature: { id, name }
application_blueprint: { jobs: [ { name, bulk, admin } ] }
```

# Output

```yaml
task_artifact:
  commands: [<management command>]
  batch_tasks: [<Celery task for large async batches>]
  idempotency: [<how re-runs are safe>]
```

# Workflow

## Step 1 — Management commands
Implement `BaseCommand` subclasses for one-off/admin/backfill jobs with arguments.

## Step 2 — Batch tasks
For large async batches, add chunked Celery tasks.

## Step 3 — Delegate & return
Delegate to `django-senior-programmer`; return `task_artifact`.

# Rules

- Bulk/one-off jobs only; scheduled triggering is `django-scheduler-generator`; general async
  is `django-celery-generator`.
- Make jobs idempotent and resumable; process in chunks for large datasets.
- Provide clear command arguments and dry-run where destructive.
- Delegate file contents to `django-senior-programmer`.

# Examples

Input:

```yaml
application_blueprint: { jobs: [ { name: recompute-order-totals, bulk: true } ] }
```

Output (abridged):

```yaml
task_artifact:
  commands: ["python manage.py recompute_order_totals --since 2026-01"]
  batch_tasks: ["recompute_totals_chunk (Celery, 1000/chunk)"]
  idempotency: ["recompute is deterministic; safe to re-run"]
```
