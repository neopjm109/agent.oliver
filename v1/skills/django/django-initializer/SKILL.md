---
name: django-initializer
description: Scaffold a Django + DRF project once — project/apps layout, settings split, DRF config, database wiring, and tooling (pytest/ruff) — before feature generation. Django peer of spring-initializer.
version: 1.0.0
category: backend
tags:
  - django
  - initializer
  - scaffold
model: inherit
invokes:
  - django-senior-programmer
inputs:
  - application_blueprint
  - target_stack
outputs:
  - project_scaffold
---

# Goal

Create the one-time Django project skeleton so feature generators have a consistent base:
project + apps layout, split settings, DRF configuration, database wiring, and tooling.
Implementation is delegated to `django-senior-programmer`. Runs once, before the feature loop.

# Inputs

```yaml
application_blueprint: { architecture, database }
target_stack: { backend: django, database: MariaDB }
```

# Output

```yaml
project_scaffold:
  structure: "project/{settings/, urls.py, asgi.py, wsgi.py}, apps/"
  drf: "REST_FRAMEWORK config (auth, pagination, renderers)"
  database: "ENGINE wired to target DB"
  tooling: "pytest + pytest-django, ruff, requirements, manage.py"
```

# Workflow

## Step 1 — Project & apps layout
Create the project package, a split `settings/` (base/dev/prod), and an `apps/` area.

## Step 2 — DRF & database
Configure DRF defaults and wire the database ENGINE to the target DB.

## Step 3 — Tooling
Add pytest/pytest-django, ruff, requirements, and manage.py entry.

## Step 4 — Return
Return `project_scaffold`. Stop.

# Rules

- Scaffold only; do not generate feature models/API (that is the generators' job).
- Provide base settings; feature-level/env config layering is `django-settings-generator`.
- Run once per project, before the feature loop.
- Delegate concrete file contents to `django-senior-programmer`.

# Examples

Input:

```yaml
target_stack: { backend: django, database: MariaDB }
```

Output (abridged):

```yaml
project_scaffold:
  structure: "config/settings/{base,dev,prod}.py, apps/"
  drf: "DEFAULT_AUTHENTICATION_CLASSES, PageNumberPagination"
  database: "ENGINE=django.db.backends.mysql → MariaDB"
  tooling: "pytest-django, ruff, requirements.txt, manage.py"
```
