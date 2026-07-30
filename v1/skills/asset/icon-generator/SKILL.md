---
name: icon-generator
description: Author a set of SVG icons directly from names and a style/palette, producing clean, optimized, consistently-sized vector markup. Deterministic; requires no external image model.
version: 1.0.0
category: asset
tags:
  - asset
  - icon
  - svg
  - vector
model: inherit
invokes: []
inputs:
  - icon_items
  - style
outputs:
  - icons
---

# Goal

Produce SVG icon markup for each requested icon, matching a shared style, stroke, and
palette. Icons are authored directly as vector markup — no raster model is involved.

# Inputs

```yaml
icon_items:
  - { id: icon-home, name: home, size: 24x24 }
  - { id: icon-search, name: search, size: 24x24 }
style: { stroke: line, stroke_width: 2, color: "#111827" }
```

# Output

```yaml
icons:
  - { id, name, size, svg: <optimized SVG markup> }
```

# Workflow

## Step 1 — Set the canvas
Use a consistent `viewBox` (e.g. `0 0 24 24`) and target size for every icon in the set.

## Step 2 — Draw each icon
Author recognizable, minimal vector paths for each name using the shared stroke width and
color. Keep the visual weight consistent across the set.

## Step 3 — Optimize
Remove redundant precision and metadata; keep markup compact and valid.

## Step 4 — Return
Return the `icons` list. Stop.

# Rules

- Author valid, self-contained SVG; no external references, scripts, or raster embeds.
- Keep the whole set visually consistent (same viewBox, stroke width, corner style).
- Use `currentColor` for the stroke/fill when the icon should inherit CSS color, unless a
  fixed palette color is required.
- Only produce the requested icons; do not invent extra ones.

# Examples

Input:

```yaml
icon_items: [ { id: icon-home, name: home, size: 24x24 } ]
style: { stroke: line, stroke_width: 2, color: currentColor }
```

Output:

```yaml
icons:
  - id: icon-home
    name: home
    size: 24x24
    svg: >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"
           fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
           stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>
```
