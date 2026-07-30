---
name: figma-to-component
description: Read a Figma frame's design context via the Figma MCP and produce a React + Tailwind + shadcn/ui component spec that the frontend component-generator can implement. Use to turn a Figma design into an implementable spec, not into final code.
version: 1.0.0
category: design
tags:
  - figma
  - design-to-code
  - shadcn-ui
  - tailwind
  - component-spec
model: inherit
invokes: []
inputs:
  - figma_url
outputs:
  - component_spec
---

# Goal

Read a Figma frame's design context using the Figma MCP integration and produce
a **component specification** — structure, props, variants, layout, and the
design tokens each element maps to — for a React + Tailwind + shadcn/ui
component.

This skill produces a **design artifact (a spec), not final code**. It bridges a
Figma design to an implementable contract; `web/component-generator`
consumes the spec and writes the actual `.tsx`. This keeps a clean handoff:
figma-to-component owns "what the design is", component-generator owns "how it is
built".

# Inputs

```yaml
figma_url: "https://www.figma.com/design/<fileKey>/<name>?node-id=<nodeId>"
```

# Output

```yaml
component_spec:
  name: <PascalCase component name>
  source: { figma_url, node_id }
  structure: <element tree with roles>
  props: <inferred props + types>
  variants: <variant/size mapping to design-system scales>
  layout: <flex/grid, gaps, alignment in Tailwind terms>
  token_map: <figma variable -> design token -> tailwind utility>
  assets: <exported icons/images the implementer must place>
  states: <default/hover/focus/disabled/loading as observed or inferred>
  notes: <ambiguities for component-generator to resolve>
```

# Workflow

## Step 1 — Read design context

Call the Figma MCP `get_design_context` for the frame at `figma_url` (node id
from the URL). Call `get_variable_defs` to capture the design variables the frame
uses (colors, spacing, radius, type), and `get_screenshot` for a visual
reference. Use `get_metadata` first if the node id is missing or the frame is
large, to locate the right node.

## Step 2 — Derive structure and props

From the layout tree, build a semantic element tree (container, header, actions,
etc.). Infer props from repeated/parameterizable content (text slots, counts,
booleans for optional elements) and name the component in PascalCase.

## Step 3 — Map to design tokens

Translate each Figma variable to the project's design token and its Tailwind
utility (e.g. `Color/Primary/500` -> `--primary` -> `bg-primary`). Prefer mapping
to existing tokens/variant scales from `design-system-generator` over raw values;
flag any color/spacing that has no matching token.

## Step 4 — Assemble the spec

Express layout as Tailwind (flex/grid, gap, padding), map variants/sizes onto the
design-system scales, list required exported assets, and record states and open
questions. Emit the `component_spec`. Do not write `.tsx`.

# Rules

- Read from Figma via the MCP tools (`get_design_context`, `get_variable_defs`,
  `get_screenshot`, `get_metadata`); do not invent design values.
- Map to existing design tokens / variant scales first; flag unmatched values
  rather than hardcoding hex/px.
- Output a spec only — no final component code (that is `component-generator`).
- Use PascalCase component names and shadcn/ui primitives where a match exists.
- Record ambiguities explicitly in `notes` instead of guessing silently.
- Reference exported assets by name; do not embed binary data in the spec.

# Examples

Input:

```yaml
figma_url: "https://www.figma.com/design/abc123/App?node-id=42-108"
```

Workflow calls (Figma MCP):

```text
get_metadata(node-id=42-108)        -> confirm node = "UserCard" frame
get_design_context(node-id=42-108)  -> layout tree + styles
get_variable_defs(node-id=42-108)   -> { Color/Primary/500, Spacing/md, Radius/md }
get_screenshot(node-id=42-108)      -> visual reference
```

Output (abridged):

```yaml
component_spec:
  name: UserCard
  source: { figma_url: ".../node-id=42-108", node_id: "42:108" }
  structure:
    - Card (container)
      - Avatar (image)
      - div.header
        - h3  (name, prop: name)
        - span (role, prop: role)
      - Button (variant: outline, size: sm, label: "Message")
  props:
    name: string
    role: string
    avatarUrl: string
    onMessage: () => void
  variants: { uses design-system Button variant=outline size=sm }
  layout: "flex items-center gap-4 p-4 rounded-lg border"
  token_map:
    - { figma: "Color/Primary/500", token: "--primary", tw: "text-primary" }
    - { figma: "Spacing/md",        token: "--spacing-md", tw: "gap-4" }
    - { figma: "Radius/md",         token: "--radius",  tw: "rounded-lg" }
  assets: [avatar-placeholder.svg]
  states: { hover: "border-primary/40", focus: "ring-2 ring-ring" }
  notes: "Figma 'Message' button color has no matching token; mapped to outline variant."
```
