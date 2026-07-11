---
name: deployment-orchestrator
description: Orchestrates non-container deployment artifacts — CI/CD pipelines and per-environment configuration — for the selected stack(s) (per target_stack), delegating the deploy target to user infrastructure.
version: 1.0.0
category: deployment
tags:
  - deployment
  - orchestrator
  - ci-cd
  - environment
model: inherit
invokes:
  - cicd-generator
  - env-config-generator
inputs:
  - generated_artifacts
  - deployment_requirements
outputs:
  - deployment_artifact
---

# Goal

Produce the deployment layer for the generated application without containerization: CI/CD
pipelines (build/test/deploy) plus reusable build/deploy scripts, and per-environment
configuration templates with secret injection. This skill **never generates application code**
— it delegates to the deployment generators and merges the results. The actual deploy target
(VM, PaaS, cloud) is left to the user's infrastructure; the pipeline invokes a configurable
deploy step/hook.

# Inputs

```yaml
generated_artifacts:
  backend: <per target_stack.backend — spring (Gradle) / nestjs (pnpm) / django (pip)>
  clients: <per target_stack.clients — web (Next.js) / desktop (Tauri) / mobile (Flutter)>
deployment_requirements:
  target_stack: { backend: spring, clients: [web] }
  ci_provider: github-actions
  environments: [dev, staging, prod]
  deploy_strategy: script-hook        # deploy target owned by user infra
  monorepo: true
```

# Output

```yaml
deployment_artifact:
  cicd: workflows + build/test/deploy scripts (from cicd-generator)
  env_config: per-environment env templates + secret mappings (from env-config-generator)
```

# Workflow

## Step 1 — Analyze deployment scope
Determine CI provider, target environments, monorepo vs split, and which apps/clients are deployed
(backend per `target_stack.backend`, clients per `target_stack.clients`) — thread the stack down to
`cicd-generator` / `env-config-generator`.

## Step 2 — Generate environment configuration
Invoke `env-config-generator` → per-environment (dev/staging/prod) env templates and secret
injection references for both apps. This must precede CI/CD so pipelines can reference the keys.

## Step 3 — Generate CI/CD
Invoke `cicd-generator` → build/test/deploy pipeline(s) and reusable scripts, wired to the
environment keys from Step 2, with a configurable deploy hook (target owned by user infra).

## Step 4 — Assemble artifact
Merge outputs into `deployment_artifact`.

# Rules

- Never generate application/business code; produce deployment configuration and scripts only.
- No containerization (Docker/K8s) — this pipeline builds native artifacts (JAR / Next.js build) and hands off deploy to a user-owned step.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Environment config is generated before CI/CD so the pipeline can reference the same keys/secrets.
- Never embed real secrets; pipelines and templates reference secret stores (CI secrets / env) only.
- Runs after generation/validation/review — deployment is the final, optional stage.

# Examples

Input:

```yaml
deployment_requirements: { ci_provider: github-actions, environments: [dev, prod], monorepo: true }
```

Output (abridged):

```
✔ env-config → .env.example (backend/frontend), env matrix: dev/prod, secret map (12 keys)
✔ cicd       → .github/workflows/ci.yml (build+test both apps),
               deploy.yml (per-env, deploy-hook), scripts/build.sh, scripts/deploy.sh
✔ assemble   → deployment_artifact
```
