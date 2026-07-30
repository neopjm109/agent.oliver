---
name: design-system-generator
description: Generate the design system foundation — theme wiring, shadcn/ui base component conventions, and variant/size scales — from design tokens. Use to define the shared UI foundation that frontend component generation builds on.
version: 1.0.0
category: design
tags:
  - design-system
  - shadcn-ui
  - tailwind
  - variants
  - theming
model: inherit
invokes: []
inputs:
  - design_tokens
outputs:
  - design_system
---

# Goal

Generate the **design system foundation**: how the design tokens are wired into
a Tailwind + shadcn/ui setup, the base component conventions, and the canonical
variant/size scales (e.g. button `variant`/`size`, input states, surface
elevations) that every feature reuses.

This skill produces **design artifacts only** — conventions, a component
inventory, and variant contracts — **not** finished React components. It is the
UI foundation that `web/component-generator` implements against: this skill
says "Button supports variants default|secondary|outline|ghost|destructive and
sizes sm|default|lg|icon", and the component generator writes the `.tsx`.

# Inputs

```yaml
design_tokens:                 # from design-tokens-generator
  color_scales: [primary, neutral, semantic]
  spacing_scale: <steps>
  typography_scale: <steps>
  radius_scale: <steps>
  files: [tailwind.config.ts, globals.css]
```

# Output

```yaml
design_system:
  theme_wiring: <how tokens plug into tailwind.config + globals.css + cn() util>
  base_conventions:
    - class-variance-authority for variants
    - cn() (clsx + tailwind-merge) for class composition
    - forwardRef + asChild (Radix Slot) pattern
  component_inventory:            # foundation primitives to be implemented
    - button, input, label, card, badge, dialog, dropdown-menu, ...
  variant_scales:
    button: { variant: [...], size: [...] }
    badge: { variant: [...] }
  state_conventions: <hover/focus-visible/disabled/loading token usage>
  files:
    - components.json (shadcn/ui config)
    - lib/utils.ts convention (the standard clsx + tailwind-merge `cn()` helper — a scaffold wiring reference, not authored application code)
    - variant contracts (per primitive, as CVA specs)
```

# Workflow

## Step 1 — Wire the theme

Confirm `design_tokens` are in place, then define the shadcn/ui `components.json`
(style, base color, CSS variables = true, aliases) and the `cn()` utility. This
is wiring/convention, not component authoring.

## Step 2 — Define base conventions

Establish the shared authoring rules every primitive follows: `class-variance-authority`
for variants, `cn()` for merging, `React.forwardRef`, Radix `Slot`/`asChild`,
`focus-visible` rings using the `ring` token, disabled/loading states mapped to
tokens. These conventions are what `component-generator` must obey.

## Step 3 — Specify variant & size scales

For each foundation primitive, write the CVA variant contract: the set of
`variant` values, `size` values, and default variants, expressed purely in terms
of design tokens (e.g. `bg-primary text-primary-foreground`). Do not invent raw
colors — reference tokens only.

## Step 4 — Publish the component inventory

List the foundation primitives (aligned to the shadcn/ui set the product needs)
and mark which are direct shadcn adds vs. custom. Hand this inventory + the
variant contracts to `component-generator` as its build target.

# Rules

- Consume tokens; never redefine colors/spacing here (that is
  `design-tokens-generator`). Variant classes reference token-backed utilities.
- All variants expressed via `class-variance-authority`; compose with `cn()`.
- Every interactive primitive defines hover, `focus-visible`, disabled states.
- Produce **contracts/specs**, not final `.tsx` — implementation is
  `component-generator`'s responsibility.
- Do NOT design page/feature layouts (that is layout/page generators) or
  wireframes (that is `wireframe-generator`).
- Keep the primitive set minimal and composable; feature components compose
  primitives rather than duplicating them.

# Examples

Input:

```yaml
design_tokens:
  color_scales: [primary, neutral, semantic]
  radius_scale: [sm, md, lg]
  files: [tailwind.config.ts, globals.css]
```

Output (abridged):

`components.json`

```json
{
  "style": "default",
  "tailwind": { "config": "tailwind.config.ts", "css": "app/globals.css", "baseColor": "slate", "cssVariables": true },
  "aliases": { "components": "@/components", "utils": "@/lib/utils" }
}
```

Button variant contract (CVA spec, to be implemented by component-generator):

```ts
export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: { sm: "h-9 px-3", default: "h-10 px-4 py-2", lg: "h-11 px-8", icon: "h-10 w-10" },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);
```

Component inventory (foundation targets for component-generator):

```yaml
primitives: [button, input, label, card, badge, dialog, dropdown-menu, select, tabs, toast]
```
