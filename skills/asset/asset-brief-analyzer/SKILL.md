---
name: asset-brief-analyzer
description: Normalize an asset request (plus any brand/style brief) into a structured, per-item asset spec — kind, count, dimensions, palette, style, and required format. First stage of the asset pipeline.
version: 1.0.0
category: asset
tags:
  - asset
  - brief
  - spec
  - normalization
model: inherit
invokes: []
inputs:
  - asset_request
  - brief_material
  - options
outputs:
  - asset_spec
---

# Goal

Turn a loose asset request and optional brand material into a precise, per-item spec that
downstream generators can execute deterministically. This skill specifies only; it does not
create any asset.

# Inputs

```yaml
asset_request: { assets: [...], palette: [...], format_pref: svg }
brief_material: { facts: [<extracted brand/style statement>, ...] }   # optional
options:
  default_icon_size: 24x24
```

# Output

```yaml
asset_spec:
  palette: [ "#111827", "#3B82F6" ]
  style: { tone: minimal, stroke: line }
  items:
    - { id: icon-home, kind: icon, name: home, size: 24x24, format: svg, style: line }
    - { id: raster-hero, kind: raster, subject: "...", size: 1600x600, needs_backend: true }
```

# Workflow

## Step 1 — Resolve palette & style
Merge request palette/style with any brand material; fill missing values from `options`
defaults. Record the final palette once at spec level.

## Step 2 — Expand items
Expand each requested asset into concrete spec items (a 3-name icon request → 3 items),
assigning stable IDs and sizes.

## Step 3 — Flag backend need
Mark `needs_backend: true` for raster/photoreal items that cannot be authored as vector/
procedural.

## Step 4 — Return
Return `asset_spec`. Stop.

# Rules

- Specify only; never generate SVG, sprites, or prompts.
- Every item gets a stable ID, a concrete size, and a target format.
- Do not invent brand values not present in request or brief; fall back to documented
  defaults and note the fallback.
- Mark raster/photoreal items with `needs_backend` so routing is unambiguous.

# Examples

Input:

```yaml
asset_request:
  assets:
    - { kind: icon, names: [home, search], style: line }
    - { kind: raster, subject: "hero banner", size: 1600x600 }
  palette: [ "#111827", "#3B82F6" ]
options: { default_icon_size: 24x24 }
```

Output:

```yaml
asset_spec:
  palette: [ "#111827", "#3B82F6" ]
  style: { tone: minimal, stroke: line }
  items:
    - { id: icon-home, kind: icon, name: home, size: 24x24, format: svg, style: line, needs_backend: false }
    - { id: icon-search, kind: icon, name: search, size: 24x24, format: svg, style: line, needs_backend: false }
    - { id: raster-hero, kind: raster, subject: "hero banner", size: 1600x600, needs_backend: true }
```
