---
name: spec-modifier
description: Revise a design-spec element and ripple the change into the code generated from it — regenerate the affected spec part via the blueprint/design generator, gate it with the spec validator, map every dependent code artifact, propagate via code-change, then gate the code with validation-orchestrator. Keeps spec and code in sync; never regenerates the whole blueprint.
version: 1.0.0
category: spec-change
tags:
  - spec-change
  - modify
  - ripple
  - blueprint
  - design
model: inherit
invokes:
  - architecture-generator
  - domain-model-generator
  - database-generator
  - api-spec-generator
  - event-topology-generator
  - blueprint-validator
  - design-tokens-generator
  - design-system-generator
  - ux-flow-generator
  - wireframe-generator
  - figma-to-component
  - design-validator
  - code-change-orchestrator
  - validation-orchestrator
inputs:
  - spec_modify_contract
outputs:
  - spec_modify_result
---

# Goal

Change a spec element and carry the change all the way into the code that was generated from
it. A spec is a contract, so revising it in isolation would desync the codebase. This skill
revises only the affected spec part, verifies the spec still hangs together, maps the
downstream code, ripples the change via `code-change`, and verifies the code. It never
regenerates the whole blueprint or re-derives unaffected specs.

# Inputs

```yaml
spec_modify_contract:
  spec_domain: blueprint     # blueprint | design
  target: <spec element — entity / endpoint / event / token / component>
  new_source: <the changed requirement>
  existing_blueprint: <current spec set>          # blueprint domain
  existing_design_system: <current design specs>  # design domain
  target_stack: { backend: spring, frontend: nextjs }
```

# Output

```yaml
spec_modify_result:
  spec_revised: [<spec elements changed>]
  spec_gate: pass | fail
  code_rippled: [<code artifacts updated via code-change>]
  code_gate: pass | fail
  notes: <anything the caller should know>
```

# Workflow

## Step 1 — Locate the spec element
Read the current spec set and pin the element to change plus the specs cross-referencing it
(a domain entity is referenced by database and api-spec; a token is referenced by the design
system and screens).

## Step 2 — Revise the affected spec part
Regenerate only the changed element via its generator:
- **blueprint** — `domain-model-generator` (entity/aggregate), `database-generator` (schema),
  `api-spec-generator` (endpoint/DTO), `event-topology-generator` (event), or
  `architecture-generator` (module). Cascade within the spec set (a new entity field flows to
  the table and the DTO).
- **design** — `design-tokens-generator` (token), `design-system-generator` (component),
  `ux-flow-generator` / `wireframe-generator` / `figma-to-component` (screens). Cascade a token
  change into the components that use it.

## Step 3 — Spec gate
Run the spec validator — `blueprint-validator` (domain↔db↔api↔event↔module) or
`design-validator` (component↔token, screen↔component). A `fail` blocks rippling; a broken
spec must never reach code.

## Step 4 — Map downstream code impact
Determine which generated code was produced from the changed element: e.g. domain entity →
entity/DTO/mapper/migration; endpoint → controller/API client; token → theme/component styles.

## Step 5 — Ripple to code
Invoke `code-change-orchestrator` (operation `modify`) once per affected code artifact, with
the changed spec as the source of the required change and the right `target_stack`.

## Step 6 — Code gate
Invoke `validation-orchestrator` on the rippled code to confirm conformance to the revised
spec (architecture/backend/frontend validators). Report the verdict; a `fail` blocks completion.

# Rules

- Revise only the affected spec element and its in-spec cascade; never re-derive unaffected specs.
- The spec gate must pass before rippling — do not push a broken contract into code.
- Ripple to **every** code artifact generated from the changed element; leaving code on the old
  contract is a desync defect.
- Delegate all code edits to `code-change`; never edit code directly.
- Both gates must pass (spec then code); complete only when the code gate is `pass`.
- Spec elements that should be removed are **not** deleted here — route to `spec-remover`.

# Examples

Input:

```yaml
spec_modify_contract:
  spec_domain: blueprint
  target: Order
  new_source: "Order gains a `discountCode` optional field; endpoint returns it."
  target_stack: { backend: spring }
```

Output (abridged):

```
▶ revise  → domain-model Order +discountCode; database orders +discount_code; api-spec OrderDTO +discountCode
▶ spec gate → blueprint-validator: pass (domain↔db↔api aligned)
▶ impact  → Order.java, OrderResponse.java, OrderMapper, V8__add_discount_code.sql
▶ ripple  → code-change (modify) applies all four
▶ code gate → validation-orchestrator: pass
── spec_modify_result
  spec_revised: [domain_model.Order, database_schema.orders, api_specification.OrderDTO]
  spec_gate: pass
  code_rippled: [Order.java, OrderResponse.java, OrderMapper.java, V8__add_discount_code.sql]
  code_gate: pass
```
