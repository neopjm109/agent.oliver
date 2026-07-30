---
name: code-change-orchestrator
description: Routes a change request against an existing codebase to the right operation — modify (behavior change), refactor (behavior-preserving cleanup), or delete (removal + reference cleanup) — and delegates to code-modifier / code-refactorer / code-remover. Use when editing code that already exists, not when generating new code from scratch.
version: 1.0.0
category: code-change
tags:
  - orchestrator
  - code-change
  - modify
  - refactor
  - delete
model: inherit
invokes:
  - code-modifier
  - code-refactorer
  - code-remover
inputs:
  - change_request
  - target_stack
outputs:
  - change_summary
---

# Goal

Turn a natural-language change request against an **existing** codebase into the correct
operation and route it. This skill **never edits code directly** — it classifies the
request, picks the operation(s), passes a change contract to the worker, and reports the
result. It is the counterpart of the generation orchestrators (`*-backend-orchestrator`,
`frontend-orchestrator`), which only *create* code; this one *changes* code that is
already there.

Distinguish the three operations by intent, not by the words used:

- **modify** — the observable behavior should change (fix a bug, add a branch, change a
  rule, alter an endpoint's response). → `code-modifier`
- **refactor** — behavior must stay identical; only the structure improves (extract,
  rename, dedupe, replace a deprecated API). → `code-refactorer`
- **delete** — a symbol / file / feature should be removed, and everything that referenced
  it must be cleaned up. → `code-remover`

A single request may decompose into a sequence (e.g. *refactor first, then modify*).

# Inputs

```yaml
change_request:
  intent: <free-text; e.g. "orders over $10k should require manager approval">
  target: <optional hint — file, symbol, feature, or module>
  scope: single-file | feature | module   # optional
target_stack:
  backend: spring        # spring | nestjs | django
  frontend: nextjs       # nextjs (typescript) | flutter | tauri
```

# Output

```yaml
change_summary:
  operation: modify | refactor | delete | sequence
  worker: code-modifier | code-refactorer | code-remover
  files_touched: [...]
  references_updated: [...]   # callers, tests, DI, routes, FKs
  verification: pass | fail | not-run
```

# Workflow

## Step 1 — Classify intent
Decide the operation from the request's intent. If behavior changes → modify. If the ask
is "clean up / restructure / rename / dedupe / upgrade API" with no behavior change →
refactor. If the ask is "remove / delete / drop / retire" → delete. Ambiguous requests
(e.g. "improve X") default to asking for clarification rather than guessing.

## Step 2 — Resolve stack routing
Map `target_stack` to the implementation delegate the worker will use:
`spring → spring-senior-programmer`, `nestjs → nestjs-senior-programmer`,
`django → django-senior-programmer`, `nextjs → typescript-senior-programmer`,
`flutter → flutter-senior-programmer` (desktop/Tauri UI reuses the `nextjs` delegate).
All five stacks are wired; the worker selects the delegate from `change_contract.stack`.

## Step 3 — Decompose if needed
If the request implies more than one operation, order them safely: refactor → modify →
delete (never delete something a later step still needs; never mix a refactor and a
behavior change in one worker call).

## Step 4 — Delegate
Invoke the chosen worker(s) with a change contract (`operation`, `target`, `change`,
`stack`). Each worker reads the existing code, plans the minimal change, and delegates the
actual code writing to the stack's senior-programmer.

## Step 5 — Assemble summary
Merge worker outputs into `change_summary`, listing files touched, references updated, and
verification result.

# Rules

- Never edit code directly; always delegate to a worker.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Do not fall back to a generator (`*-generator`) for changes — generators create new code
  and will overwrite instead of edit. Existing-code changes always go through a worker.
- Keep operations separated: a behavior change is `code-modifier`, a behavior-preserving
  cleanup is `code-refactorer`. Never bundle them into one worker call.
- Deletion of data or schema (rows, tables, columns) is destructive — require explicit
  confirmation in the request before routing to `code-remover`.
- If the intent is genuinely ambiguous (which file? behavior change or cleanup?), report
  back for clarification instead of guessing.

# Examples

Input:

```yaml
change_request:
  intent: "Orders over $10,000 must require manager approval before they are placed."
  target: OrderService.placeOrder
target_stack: { backend: spring }
```

Output (abridged):

```
▶ classify   → modify (observable behavior changes)
▶ route      → code-modifier, delegate = spring-senior-programmer
✔ modifier   → OrderService.placeOrder: added approval gate (amount > 10_000)
✔ propagate  → OrderServiceTest: +2 cases (approval required / not required)
✔ verify     → build ok, existing tests green
── change_summary
  operation: modify
  files_touched: [OrderService.java, OrderServiceTest.java]
  references_updated: [OrderServiceTest]
  verification: pass
```
