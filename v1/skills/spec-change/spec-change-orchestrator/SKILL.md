---
name: spec-change-orchestrator
description: Routes a change request against an existing design spec (blueprint — architecture/domain/database/API/events; or design — tokens/system/flows) to modify (revise the spec element and ripple it into dependent code) or delete (remove the spec element and cascade-remove dependent code), and delegates to spec-modifier / spec-remover. Use when a contract changed and both the spec and the code generated from it must move together.
version: 1.0.0
category: spec-change
tags:
  - orchestrator
  - spec-change
  - blueprint
  - design
  - ripple
model: inherit
invokes:
  - spec-modifier
  - spec-remover
inputs:
  - spec_change_request
  - spec_domain
outputs:
  - spec_change_summary
---

# Goal

Turn a change request against an **existing** design spec into the correct operation and
route it. A spec is a contract that generated code depends on, so a spec change is inherently
two-stage: revise the spec, then **ripple** the change into the code produced from it. This
skill **never edits specs or code directly**; it classifies the request, picks the operation,
and delegates. It bridges L2 (blueprint/design specs) and L3 (code): spec revision goes to the
blueprint/design generators, and code propagation goes to `code-change`.

Specs are contracts, not prose — the operations are:

- **modify** — a spec element changed (add a field, change an endpoint, change a token); revise
  it and update every code artifact generated from it. → `spec-modifier`
- **delete** — a spec element is removed (drop an entity, endpoint, token); remove it and
  cascade-remove the dependent code. → `spec-remover`

Both end with two gates: the **spec gate** (`blueprint-validator` / `design-validator`) before
rippling, and the **code gate** (`validation-orchestrator`) after.

# Inputs

```yaml
spec_change_request:
  intent: <free-text; e.g. "add a `tier` field to the User entity">
  target: <spec element — entity / endpoint / event / token / component>
  operation: modify | delete    # optional hint; classified if absent
  new_source: <the changed requirement, when modifying>
spec_domain: blueprint          # blueprint | design
```

# Output

```yaml
spec_change_summary:
  operation: modify | delete
  worker: spec-modifier | spec-remover
  spec_touched: [<spec elements revised/removed>]
  code_rippled: [<code artifacts updated via code-change>]
  blocked_by: [<live references that blocked a delete, if any>]  # from spec-remover; empty when not blocked
  spec_gate: pass | fail        # blueprint-validator / design-validator
  code_gate: pass | fail        # validation-orchestrator
```

# Workflow

## Step 1 — Classify operation
If a spec element is removed → delete. If it changes → modify. A "rename an entity" is a
modify (revise + ripple) that touches every downstream reference.

## Step 2 — Resolve domain
`blueprint` → the changed element is revised via architecture/domain-model/database/api-spec/
event-topology generators and gated by `blueprint-validator`; downstream code is backend.
`design` → revised via design-tokens/system/ux-flow/wireframe/figma and gated by
`design-validator`; downstream code is frontend.

## Step 3 — Delegate
Invoke the worker with a change contract (`operation`, `spec_domain`, `target`, `new_source`).
The worker revises the spec, gates it, ripples to code via `code-change`, and gates the code.

## Step 4 — Assemble summary
Merge the worker output into `spec_change_summary`, including both gate verdicts.

# Rules

- Never edit specs or code directly; always delegate.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- A spec change is not complete until it has rippled to code and the code gate passes — never
  leave the spec and code out of sync.
- Do not fall back to `blueprint-orchestrator` / `design-orchestrator` for changes — a full
  re-design discards accurate spec elements and forces a full regen of code. Use a worker.
- Both gates must pass: spec gate before rippling (a broken spec must not reach code), code
  gate after; a `fail` at either is reported, not hidden.
- Deleting a spec element is destructive to dependent code — require an explicit delete intent
  and cascade or block, never leave dangling code.

# Examples

Input:

```yaml
spec_change_request:
  intent: "Add a NOT NULL `tier` field (enum FREE/PRO) to the User entity."
  target: User
  operation: modify
spec_domain: blueprint
```

Output (abridged):

```
▶ classify → modify (domain-model element changes)
▶ route    → spec-modifier (blueprint)
✔ spec     → domain-model +User.tier; database +users.tier; api-spec User DTO +tier
✔ spec gate→ blueprint-validator: pass (domain↔db↔api aligned)
✔ ripple   → code-change: User entity, UserDTO, migration, mapper updated
✔ code gate→ validation-orchestrator: pass
── spec_change_summary
  operation: modify
  spec_touched: [domain_model.User, database_schema.users, api_specification.User]
  code_rippled: [User.java, UserResponse.java, V7__add_user_tier.sql, UserMapper]
  spec_gate: pass
  code_gate: pass
```
