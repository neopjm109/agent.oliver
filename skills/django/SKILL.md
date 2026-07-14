---
name: django
description: Short entry point for the django category. Orchestrates the Django + DRF backend implementation for a feature by coordinating model, API, auth, signals, celery, cache, scheduler, task, migration, settings, observability, notification, storage, channels, api-docs, and test generators. Selected by backend-orchestrator when target_stack.backend is django. Invoke as '/django'; delegates to django-backend-orchestrator.
version: 1.0.0
category: django
tags:
  - django
  - entrypoint
model: inherit
invokes:
  - django-backend-orchestrator
---

# Goal

This is the **short entry point for the `django` category**. Start here, but let
`django-backend-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `django-backend-orchestrator` needs.
2. Run `django-backend-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
