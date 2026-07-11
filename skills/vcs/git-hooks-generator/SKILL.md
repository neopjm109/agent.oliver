---
name: git-hooks-generator
description: Generate local git hooks (pre-commit, commit-msg, pre-push) that mirror CI checks and enforce the branch-safe contract — lint/format, Conventional Commit validation, and a protected-branch commit guard. Local config, distinct from the CI pipeline.
version: 1.0.0
category: vcs
tags:
  - vcs
  - git
  - hooks
  - pre-commit
  - conventional-commits
model: inherit
invokes: []
inputs:
  - hooks_requirements
  - target_stack
outputs:
  - hooks_config
---

# Goal

Generate local git hooks that catch problems before they reach CI and enforce the branch-safe
operating contract: format/lint on staged files, Conventional Commit message validation, and a
guard that blocks direct commits to protected branches. This is **local** developer tooling,
distinct from `deployment/cicd-generator` (the CI pipeline).

# Inputs

```yaml
hooks_requirements:
  manager: pre-commit | husky | lefthook     # framework to wire hooks
  hooks: [pre-commit, commit-msg, pre-push]
  protected: [main, develop]                 # commit-msg/pre-commit guard target
target_stack: { backend: spring, clients: [web] }   # picks lint/format commands per stack
```

# Output

```yaml
hooks_config:
  - .pre-commit-config.yaml | .husky/* | lefthook.yml
  - pre-commit: format + lint staged files (per target_stack)
  - commit-msg: Conventional Commit validation
  - pre-push: block push to protected branches; run fast tests
```

# Workflow

## Step 1 — Select manager and hooks
Resolve the hook manager and which hooks to wire from requirements.

## Step 2 — Map checks to the stack
Choose format/lint commands per `target_stack` (spring→spotless/checkstyle, web→eslint/prettier,
django→ruff/black, etc.); mirror the CI checks so local and CI agree.

## Step 3 — Enforce the contract
Add a commit/push guard that refuses a direct commit or push to any `protected` branch, and a
commit-msg Conventional Commit check.

# Rules

- Hooks mirror CI checks (do not invent new gates); keep local and CI consistent.
- Include a protected-branch guard so the branch-safe contract is enforced at commit time.
- Local hooks only — the CI pipeline is `deployment/cicd-generator`.
- Emit config/scripts; never install or run git operations itself.

# Examples

Input:

```yaml
hooks_requirements: { manager: pre-commit, hooks: [pre-commit, commit-msg], protected: [main] }
target_stack: { backend: spring, clients: [web] }
```

Output (abridged):

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - { id: spotless, entry: ./gradlew spotlessApply, language: system }
      - { id: eslint, entry: pnpm --dir web lint, language: system }
      - { id: conventional-commit, stages: [commit-msg], entry: scripts/check-commit-msg.sh }
      - { id: protect-main, entry: scripts/block-protected-commit.sh, language: system }
```
