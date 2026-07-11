---
name: nestjs-config-generator
description: Generate typed feature configuration for NestJS using ConfigModule — namespaced config with schema validation and injection. NestJS peer of config-properties-generator.
version: 1.0.0
category: backend
tags:
  - nestjs
  - config
  - configmodule
model: inherit
invokes:
  - nestjs-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - config_artifact
---

# Goal

Produce typed, validated feature configuration in NestJS: a namespaced config factory with
schema validation, injected where needed. Delegates code to `nestjs-senior-programmer`.

# Inputs

```yaml
feature: { id, name }
application_blueprint: { config: { keys: [ { name, type, default } ] } }
```

# Output

```yaml
config_artifact:
  namespace: <feature config namespace>
  schema: [ { key, type, required, default } ]
  injection: [<where injected>]
```

# Workflow

## Step 1 — Define namespace & schema
Create a `registerAs` config namespace and a validation schema for its keys.

## Step 2 — Inject
Inject the typed config into providers that need it.

## Step 3 — Delegate & return
Delegate to `nestjs-senior-programmer`; return `config_artifact`.

# Rules

- Feature-level typed config only; base ConfigModule/env wiring is `nestjs-initializer`.
- Validate config at startup; fail fast on missing required keys.
- Never hardcode secrets; bind from env.
- Delegate file contents to `nestjs-senior-programmer`.

# Examples

Input:

```yaml
application_blueprint: { config: { keys: [ { name: ORDER_TTL, type: number, default: 300 } ] } }
```

Output (abridged):

```yaml
config_artifact:
  namespace: order
  schema: [ { key: ttl, type: number, required: false, default: 300 } ]
  injection: ["OrderService ← ConfigType<order>"]
```
