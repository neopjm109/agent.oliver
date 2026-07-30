---
name: env-config-generator
description: Generate per-environment deployment configuration — env-var templates and secret injection mappings (dev/staging/prod) for the selected stack(s) (per target_stack).
version: 1.0.0
category: deployment
tags:
  - deployment
  - environment
  - env
  - secrets
  - configuration
model: inherit
invokes: []
inputs:
  - env_requirements
outputs:
  - env_config
---

# Goal

Generate per-environment deployment configuration for the selected backend stack and client(s)
(per `target_stack`): environment-variable templates (`.env.example`, per-env value matrices) and
secret-injection mappings that CI/CD and runtime read. This is **deployment/runtime env wiring** —
it is distinct from the stack's typed config binding (`config-properties-generator` /
`nestjs-config-generator` / `django-settings-generator`) and its base scaffold (`*-initializer`).
It supplies the values those consume.

# Inputs

```yaml
env_requirements:
  target_stack: { backend: spring, clients: [web] }   # var names below are stack-specific examples
  environments: [dev, staging, prod]
  apps:
    backend:                                            # spring shown; nestjs/django use their own env keys
      vars: [SPRING_PROFILES_ACTIVE, DB_URL, DB_USER, REDIS_HOST]
      secrets: [DB_PASSWORD, JWT_SECRET]
    web:                                                # web client (Next.js); desktop/mobile clients as selected
      vars: [NEXT_PUBLIC_API_BASE_URL]
      secrets: [SENTRY_DSN]
  secret_store: github-actions        # github-actions | vault | aws-ssm (reference only)
```

# Output

```yaml
env_config:
  - backend/.env.example              # non-secret keys with placeholder values
  - web/.env.example
  - env matrix: per-environment (dev/staging/prod) non-secret values
  - secret map: which secrets each env/app needs + where they come from (store reference)
```

# Workflow

## Step 1 — Inventory variables
List every runtime variable per app, splitting non-secret config from secrets.

## Step 2 — Template non-secret config
Emit `.env.example` per app and a per-environment value matrix (dev/staging/prod) for non-secrets.

## Step 3 — Map secrets
Produce a secret map: each secret keyed by app + environment, pointing at the secret store
(CI secrets / Vault / SSM) — values are never materialized here.

## Step 4 — Cross-check
Ensure the keys match what the backend (stack-specific, e.g. spring `SPRING_PROFILES_ACTIVE`,
DB/Redis) and the web client (`NEXT_PUBLIC_*`) actually consume, and what `cicd-generator` references.

# Rules

- Own deployment/runtime env wiring only; typed Java config binding is `config-properties-generator` and the base `application.yml` scaffold is `spring-initializer`.
- Never materialize secret values — reference a secret store; `.env.example` carries placeholders only.
- Frontend browser-exposed vars must use the `NEXT_PUBLIC_` prefix; never expose secrets to the client bundle.
- Keys must be consistent across `.env.example`, the env matrix, the secret map, and `cicd-generator`.
- Keep one canonical key name per concern across all environments; only values differ per env.

# Examples

Input:

```yaml
env_requirements:
  environments: [dev, prod]
  apps:
    backend: { vars: [SPRING_PROFILES_ACTIVE, DB_URL], secrets: [DB_PASSWORD, JWT_SECRET] }
    frontend: { vars: [NEXT_PUBLIC_API_BASE_URL], secrets: [] }
  secret_store: github-actions
```

Output (abridged):

```bash
# backend/.env.example
SPRING_PROFILES_ACTIVE=dev
DB_URL=jdbc:mariadb://localhost:3306/app
DB_PASSWORD=            # from secret store
JWT_SECRET=             # from secret store
```

```yaml
# env matrix + secret map
env_matrix:
  dev:  { backend: { SPRING_PROFILES_ACTIVE: dev,  DB_URL: jdbc:mariadb://dev-db:3306/app },  frontend: { NEXT_PUBLIC_API_BASE_URL: https://dev.api.example.com } }
  prod: { backend: { SPRING_PROFILES_ACTIVE: prod, DB_URL: jdbc:mariadb://prod-db:3306/app }, frontend: { NEXT_PUBLIC_API_BASE_URL: https://api.example.com } }
secret_map:
  prod: { backend: [DB_PASSWORD, JWT_SECRET] }   # source: github-actions environment 'prod'
```
