---
name: repo-initializer
description: Initialize a git repository for the generated app — git init, stack-aware .gitignore, an initial commit on main, the first work branch, and protected-branch configuration — under the branch-safe operating contract. Operational (runs git).
version: 1.0.0
category: vcs
tags:
  - vcs
  - git
  - init
  - gitignore
  - operational
model: inherit
invokes: []
inputs:
  - repo_init_request
  - target_stack
outputs:
  - repo_scaffold
---

# Goal

Turn a freshly scaffolded project directory into a working git repository: `git init`, a
stack-aware `.gitignore`, an initial commit on `main`, the first work branch, and protected-branch
settings. **Operational** — it runs git — but strictly under the branch-safe contract (initial
commit is the only commit allowed on `main`; feature work happens on the created work branch).

# Inputs

```yaml
repo_init_request:
  work_branch: feat/FEAT-ORDER        # first work branch created off main
  protected: [main]
  initial_commit: "chore: initial scaffold"
target_stack: { backend: spring, clients: [web], database: mariadb }
```

# Output

```yaml
repo_scaffold:
  - .gitignore                        # stack-aware (Gradle/Node/Python + OS/IDE)
  - initial commit on main            # the scaffold snapshot
  - work branch feat/FEAT-ORDER       # checked out, ready for feature commits
  - protected-branch note             # main marked write-forbidden for later ops
```

# Workflow

## Step 1 — Verify preconditions
Confirm the directory is not already a repo (`git rev-parse` fails) and the scaffold exists.

## Step 2 — Initialize
`git init`; write a `.gitignore` composed from `target_stack` (e.g. `build/`, `node_modules/`,
`.next/`, `__pycache__/`, plus OS/IDE entries).

## Step 3 — Initial commit on main
Stage the scaffold and make the single initial commit on `main` — the only commit this layer
places on a protected branch.

## Step 4 — Create work branch
Create and check out `work_branch` off `main`; record protected branches for later operators.

# Rules

- The initial scaffold commit is the ONLY commit allowed on a protected branch; all further work is on the work branch.
- Never force, never rewrite; abort if the directory is already a git repo (report, do not reinit).
- `.gitignore` is derived from `target_stack`; never commit build output, dependencies, or secrets.
- VCS init only — code scaffolding is the `*-initializer` skills (`spring`/`nestjs`/`django`/`nextjs`/`tauri`/`flutter-initializer`); this runs after them, on their `project_scaffold`.
- Runs git for init/first-commit/branch only; feature commits are `commit-applier`, integration is `branch-integrator`.

# Examples

Input:

```yaml
repo_init_request: { work_branch: feat/FEAT-ORDER, protected: [main] }
target_stack: { backend: spring, clients: [web] }
```

Output (abridged):

```bash
git init
# .gitignore: build/, .gradle/, node_modules/, web/.next/, .idea/, .DS_Store
git add -A && git commit -m "chore: initial scaffold"        # on main (only protected-branch commit)
git switch -c feat/FEAT-ORDER                                 # work branch ready
```
