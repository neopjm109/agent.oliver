---
name: django-settings-generator
description: Generate feature-level Django settings/config — env-bound values, app registration, and per-environment overrides — layered on the base settings split. Django peer of config-properties-generator.
version: 1.0.0
category: backend
tags:
  - django
  - settings
  - config
model: inherit
invokes:
  - django-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - settings_artifact
---

# Goal

Produce feature-level configuration for Django: env-bound settings values, app registration
in `INSTALLED_APPS`, and any per-environment overrides, layered on the base settings from the
initializer. Delegates code to `django-senior-programmer`.

# Inputs

```yaml
feature: { id, name }
application_blueprint: { config: { keys: [ { name, type, default } ] } }
```

# Output

```yaml
settings_artifact:
  installed_apps: [<app to register>]
  settings_keys: [ { key, source: env, default } ]
  env_bindings: [<ENV_VAR → setting>]
```

# Workflow

## Step 1 — Register the app
Add the feature app to `INSTALLED_APPS` if new.

## Step 2 — Env-bound settings
Define feature settings sourced from env with sane defaults and validation.

## Step 3 — Delegate & return
Delegate to `django-senior-programmer`; return `settings_artifact`.

# Rules

- Feature-level config only; base settings split/DRF wiring is `django-initializer`.
- Bind sensitive values from env; never hardcode secrets in settings.
- Keep per-environment overrides in the settings split (base/dev/prod).
- Delegate file contents to `django-senior-programmer`.

# Examples

Input:

```yaml
application_blueprint: { config: { keys: [ { name: ORDER_TTL, type: int, default: 300 } ] } }
```

Output (abridged):

```yaml
settings_artifact:
  installed_apps: ["apps.order"]
  settings_keys: [ { key: ORDER_TTL, source: env, default: 300 } ]
  env_bindings: ["ORDER_TTL → settings.ORDER_TTL"]
```
