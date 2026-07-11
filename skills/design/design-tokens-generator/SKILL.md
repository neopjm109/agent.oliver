---
name: design-tokens-generator
description: Generate design tokens (color, spacing, typography, radius) as a Tailwind theme config plus CSS variables from brand guidelines or Figma variables. Use when establishing the visual primitives that the design system and frontend build on.
version: 1.0.0
category: design
tags:
  - design-tokens
  - tailwind
  - css-variables
  - theming
  - figma
model: inherit
invokes: []
inputs:
  - brand_guidelines
  - figma_variables
outputs:
  - design_tokens
---

# Goal

Generate a single source of truth for the visual primitives of a product:
color, spacing, typography, radius, shadow, and z-index scales. The output is a
**Tailwind theme configuration plus a matching set of CSS custom properties**.

This skill produces **design artifacts only** — token definitions, not runtime
components. The `design-system-generator` consumes these tokens to define the
UI foundation, and `web/component-generator` implements the actual React
components. This skill never writes `.tsx` component code.

Either `brand_guidelines` (human/brand-provided) or `figma_variables`
(extracted via the Figma MCP `get_variable_defs`) may be supplied. When both are
present, Figma variables win for concrete values and brand guidelines fill gaps.

# Inputs

```yaml
brand_guidelines:
  primary_color: "#4F46E5"
  neutral_base: "#0F172A"
  font_family: "Inter"
  radius_style: rounded        # sharp | rounded | pill
  density: comfortable         # compact | comfortable
figma_variables:               # optional; from Figma MCP get_variable_defs
  Color/Primary/500: "#4F46E5"
  Color/Neutral/900: "#0F172A"
  Spacing/md: "16px"
  Radius/md: "8px"
```

# Output

```yaml
design_tokens:
  format: [tailwind_theme, css_variables]
  color_scales: [primary, neutral, semantic]     # 50..950 per scale
  spacing_scale: <named steps + rem values>
  typography_scale: <font family, sizes, line-heights, weights>
  radius_scale: <named steps>
  shadow_scale: <elevation levels>
  files:
    - tailwind.config.ts (theme.extend fragment)
    - globals.css (:root + .dark variable blocks)
```

# Workflow

## Step 1 — Collect source values

If `figma_variables` are present, call the Figma MCP `get_variable_defs` output
and normalize the `Color/*`, `Spacing/*`, `Radius/*`, `Type/*` collections into
canonical names. Otherwise read `brand_guidelines`. Record any missing scale so
Step 2 can synthesize it.

## Step 2 — Derive full scales

From each seed color, derive a full 50..950 tint/shade scale (perceptually even
lightness steps). Define semantic tokens (`background`, `foreground`, `primary`,
`muted`, `border`, `destructive`, etc.) as references into the raw scales, so
light/dark themes only remap semantics — never the raw palette.

Derive spacing (4px base grid), typography (modular scale, e.g. 1.25 ratio),
radius, and shadow scales, honoring `density` and `radius_style`.

## Step 3 — Emit CSS variables

Write `:root` and `.dark` blocks in `globals.css`. Semantic tokens are HSL
channel triplets (shadcn/ui convention, e.g. `--primary: 243 75% 59%;`) so
Tailwind can apply opacity modifiers.

## Step 4 — Emit Tailwind theme

Write a `theme.extend` fragment that maps `colors`, `spacing`, `borderRadius`,
`fontFamily`, `fontSize`, and `boxShadow` onto the CSS variables via
`hsl(var(--token))`. Do not hardcode hex values in the Tailwind config — always
point at the CSS variables so theming stays centralized.

# Rules

- Single source of truth: raw palette defined once; semantic tokens reference it.
- Use HSL channel triplets for color CSS variables (shadcn/ui compatible), and
  reference them in Tailwind via `hsl(var(--token))` to keep opacity modifiers.
- Always provide both a light (`:root`) and dark (`.dark`) theme block.
- Spacing on a 4px grid; expose rem values.
- Do NOT generate component code — that is `component-generator`'s job.
- Do NOT define component variant/size scales — that is `design-system-generator`.
- Token names are kebab/scale-based and stable; downstream skills key off them.

# Examples

Input:

```yaml
brand_guidelines:
  primary_color: "#4F46E5"
  neutral_base: "#0F172A"
  font_family: "Inter"
  radius_style: rounded
  density: comfortable
```

Output (abridged):

`globals.css`

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;
  --primary: 243 75% 59%;
  --primary-foreground: 0 0% 100%;
  --muted: 210 40% 96%;
  --border: 214 32% 91%;
  --radius: 0.5rem;
}
.dark {
  --background: 222 47% 11%;
  --foreground: 210 40% 98%;
  --primary: 243 75% 59%;
  --primary-foreground: 0 0% 100%;
  --muted: 217 33% 17%;
  --border: 217 33% 24%;
}
```

`tailwind.config.ts` (theme.extend fragment)

```ts
export const themeExtend = {
  colors: {
    background: "hsl(var(--background))",
    foreground: "hsl(var(--foreground))",
    primary: {
      DEFAULT: "hsl(var(--primary))",
      foreground: "hsl(var(--primary-foreground))",
    },
    muted: "hsl(var(--muted))",
    border: "hsl(var(--border))",
  },
  borderRadius: {
    lg: "var(--radius)",
    md: "calc(var(--radius) - 2px)",
    sm: "calc(var(--radius) - 4px)",
  },
  fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
} as const;
```
