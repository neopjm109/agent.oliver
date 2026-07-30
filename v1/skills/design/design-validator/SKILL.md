---
name: design-validator
description: Validate the design spec set for internal consistency — every design-system component and component-spec references defined tokens, every component-spec maps to a defined system component, tokens have no duplicate/conflicting definitions, and every UX-flow node maps to a wireframed screen with no dangling transition — returning a deterministic pass/fail report. Design-time spec gate (distinct from validator/frontend-validator, which checks generated UI code).
version: 1.0.0
category: design
tags:
  - design
  - validation
  - consistency
  - spec-gate
model: inherit
invokes: []
inputs:
  - design_system_bundle
outputs:
  - validation_result
---

# Goal

Verify that the design specs agree with each other before any UI code is generated from
them, returning a deterministic pass/fail verdict with specific violations. This validates
the **spec set** (tokens, design system, UX flows, wireframes, component specs) for internal
consistency; it does not generate specs, and it does not validate generated UI code — that is
`validator/frontend-validator`. Catching a mismatch here prevents rippling a broken design
contract into frontend code.

# Scope

- Component↔token alignment (every `design_system` component style, and every `component_spec` token_map entry, references a token defined in `design_tokens`)
- Component-spec↔system alignment (every `component_spec` maps to a component defined in `design_system`, or is explicitly marked new)
- Token integrity (no duplicate or conflicting token definitions)
- Flow/screen connectivity (every `ux_flow` node's screen has a defined `wireframe`; every edge connects declared nodes; no dangling)

Out of scope: visual aesthetics/quality, generated-code conformance (see `validator/frontend-validator`),
accessibility audit.

# Checks

1. Every `design_system` component — and every `component_spec` `token_map` entry — references
   only tokens that exist in `design_tokens`.
2. Every `component_spec` maps to a component defined in `design_system` (or is explicitly
   marked new).
3. No token name is defined twice with conflicting values.
4. Every `ux_flow` node's `screen` has a corresponding `wireframe`, and every edge connects
   declared nodes; no dangling node or transition.

# Pass/Fail Criteria

- **pass**: all checks succeed.
- **fail**: any undefined token reference, a `component_spec` mapping to an undefined system
  component, a conflicting token, a `ux_flow` node whose screen has no wireframe, or a dangling
  node/edge.

# Output Schema

```yaml
validation_result:
  result: pass | fail
  violations:
    - { area: token | component | flow, ref: <name>, issue: <what failed> }
  stats: { tokens: <n>, components: <n>, screens: <n>, dangling: <n> }
```

# Rules

- Report violations only; never modify the design specs.
- Deterministic verdict: any single violation forces `fail`.
- Check specs against each other, not against generated code or outside assumptions.
- Do not judge visual quality or code conformance — out of scope.

# Examples

Input:

```yaml
design_system_bundle:
  design_tokens: { semantic: [background, primary, muted, border, destructive] }  # no "surface"
  design_system: { components: [Button(uses: primary), Alert(uses: destructive)] }
  component_spec: { UserCard: { maps_to: Card, token_map: [primary, surface] } }  # Card undefined; 'surface' undefined
  wireframe: { screens: [Checkout, Cart] }                 # defined screens (one wireframe each)
  ux_flow: { nodes: [{ id: n1, screen: Checkout }, { id: n2, screen: Confirm }], edges: [n1 -> n2] }  # Confirm has no wireframe
```

Output:

```yaml
validation_result:
  result: fail
  violations:
    - { area: token, ref: surface, issue: "component_spec 'UserCard' token_map references undefined token 'surface'" }
    - { area: component, ref: Card, issue: "component_spec 'UserCard' maps to undefined system component 'Card'" }
    - { area: flow, ref: Confirm, issue: "ux_flow node 'n2' references screen 'Confirm' with no wireframe (dangling)" }
  stats: { tokens: 5, components: 2, screens: 2, dangling: 1 }
```
