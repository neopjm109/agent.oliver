---
name: design-orchestrator
description: Orchestrates the design-time UI foundation — design tokens, design system, UX flows, wireframes, and Figma-to-component specs — feeding the frontend generators.
version: 1.0.0
category: orchestrator
tags:
  - orchestrator
  - design
  - design-system
  - tokens
  - ux
  - ui
model: inherit
invokes:
  - design-tokens-generator
  - design-system-generator
  - ux-flow-generator
  - wireframe-generator
  - figma-to-component
  - design-validator
inputs:
  - unified_requirements
  - application_blueprint
  - brand_inputs
outputs:
  - design_system
---

# Goal

Produce the design-time UI foundation for the application by orchestrating the `design/`
skills, then hand the result to the frontend generators. This skill **never generates
component code directly** — it delegates to the design generators and merges their artifacts.
It runs once at the app level for the shared foundation (tokens + system), and per-feature for
flows/wireframes. This closes the gap where `design/` skills were not invoked by any pipeline.

# Inputs

```yaml
unified_requirements: {...}          # from docs-analyze / app-orchestrator
application_blueprint: {...}          # optional; for feature/screen context
brand_inputs:                        # any one is optional
  brand_guidelines: {...}            # colors, typography, tone
  figma_variables: {...}             # exported Figma variables
  figma_url: https://figma.com/...   # a specific frame to bridge
per_feature:                         # optional; drives flows/wireframes
  features: [FEAT-ORDER, FEAT-USER]
```

# Output

```yaml
design_system:
  tokens: tailwind.config.ts + globals.css (from design-tokens-generator)
  system: components.json + variant contracts (from design-system-generator)
  ux_flows: [...]           # per-feature navigation flows (optional)
  wireframes: [...]         # per-screen low-fi structure (optional)
  component_specs: [...]    # Figma-bridged specs (optional)
  validation: <pass/fail + violations from design-validator>
```

# Workflow

## Step 1 — Generate tokens
Invoke `design-tokens-generator` from `brand_guidelines` or `figma_variables` → color/spacing/
typography/radius tokens (Tailwind config + CSS variables). This is the single source of truth.

## Step 2 — Generate the design system
Invoke `design-system-generator` (consumes the tokens) → shadcn/ui setup, conventions (CVA,
`cn()`), and primitive variant contracts. Must consume tokens, never redefine them.

## Step 3 — Generate UX flows (optional, per feature)
If feature requirements are present, invoke `ux-flow-generator` per feature → cross-screen
navigation/journey diagrams.

## Step 4 — Generate wireframes (optional, per screen)
For screens needing layout definition, invoke `wireframe-generator` (one screen per invocation).

## Step 5 — Bridge Figma (optional)
If a `figma_url` is provided, invoke `figma-to-component` → component specs mapped onto the tokens
and variant contracts from Steps 1–2.

## Step 5b — Validate spec consistency
Invoke `design-validator` to verify components reference defined tokens, screens reference
defined components, and flows connect to real screens before the frontend consumes them (pass/fail).

## Step 6 — Assemble artifact
Merge all outputs plus the validation verdict into `design_system` and hand it to
`frontend-orchestrator` as input.

# Rules

- Never generate component `.tsx` code; the design foundation is contracts/specs/artifacts only. Implementation belongs to `frontend-orchestrator`'s generators.
- Run tokens → system in order; the system consumes tokens and must not redefine token values.
- Token values (incl. light/dark) are owned here via `design-tokens-generator`; the runtime theme provider/switcher is `theme-generator` (frontend). Keep that boundary.
- `ux-flow-generator` handles cross-screen flows; `wireframe-generator` handles a single screen — one screen per invocation.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- The app-level foundation (tokens + system) is generated once and reused across features; do not regenerate per feature.

# Examples

Input:

```yaml
brand_inputs: { brand_guidelines: { primary: "#4F46E5", font: Inter } }
per_feature: { features: [FEAT-ORDER] }
```

Output (abridged):

```
✔ tokens      → tailwind.config.ts (indigo scale), globals.css (light/dark CSS vars)
✔ system      → components.json, lib/utils.ts, CVA contracts (button/input/card)
✔ ux-flow     → FEAT-ORDER: cart → checkout → confirm (+ error paths)
✔ wireframe   → /orders/new (form region + summary sidebar)
∅ figma       → skipped (no figma_url)
✔ assemble    → design_system (handed to frontend-orchestrator)
```
