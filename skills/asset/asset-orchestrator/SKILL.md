---
name: asset-orchestrator
description: Coordinate the end-to-end visual-asset pipeline that turns an asset brief into concrete 2D assets — SVG icons, sprite sheets, and placeholder images — plus a usage manifest. Never authors assets itself; it resolves the brief into a spec and routes each asset to the right generator (vector/procedural to icon/sprite/placeholder generators, raster/photoreal to a connected image tool or an image-prompt spec). Entrypoint of the asset domain.
version: 1.0.0
category: asset
tags:
  - asset
  - orchestrator
  - image
  - sprite
  - svg
  - pipeline
  - entrypoint
model: inherit
invokes:
  - docs-analyze-docx
  - docs-analyze-pdf
  - docs-analyze-pptx
  - asset-brief-analyzer
  - icon-generator
  - sprite-sheet-generator
  - placeholder-image-generator
  - image-prompt-generator
  - asset-manifest-generator
inputs:
  - asset_request
  - brief_documents
  - options
outputs:
  - asset_bundle
---

# Goal

Produce a set of 2D visual assets and a manifest by orchestrating specialized asset skills.
This skill **never draws assets directly** — it resolves the brief into a spec, routes each
asset to the right generator by type, and assembles the result.

Capability boundary: vector and procedural assets (SVG icons, geometric sprites, gradient/
placeholder images, pixel-art matrices) are authored directly and deterministically. Raster
or photoreal assets require a connected image-generation tool; when none is available the
pipeline routes those to `image-prompt-generator`, which emits a ready-to-run prompt spec
instead of pixels.

# Inputs

```yaml
asset_request:
  assets:
    - { kind: icon, names: [home, search, cart], style: line }
    - { kind: sprite-sheet, subject: "coin", frames: 6, style: pixel }
    - { kind: placeholder, purpose: avatar, count: 5, size: 128x128 }
    - { kind: raster, subject: "hero banner, mountains at dawn", size: 1600x600 }
  palette: [ "#111827", "#3B82F6", "#F9FAFB" ]   # optional
  format_pref: svg          # svg | png-matrix | data-uri
brief_documents: [brand-guide.pdf]   # optional
options:
  out_dir: public/assets    # optional target path for the manifest
  image_backend: none       # none | <tool name>  — set when a raster tool is connected
```

# Output

```yaml
asset_bundle:
  assets:
    - { id, kind, format, content_or_path, size, generator }
  prompt_specs: [ { id, subject, prompt, params } ]   # for raster when backend=none
  manifest: <from asset-manifest-generator>
```

# Workflow

## Step 1 — Analyze the brief
If `brief_documents` are provided, invoke the matching `docs-analyze-*` skill to extract
brand/style material. Invoke `asset-brief-analyzer` to normalize the request + brief into a
structured asset spec (kinds, counts, sizes, palette, style).

## Step 2 — Route by asset kind
For each spec item:
- `icon` → `icon-generator` (SVG)
- `sprite-sheet` → `sprite-sheet-generator`
- `placeholder` → `placeholder-image-generator`
- `raster`/photoreal → if `image_backend` is a connected tool, delegate to it via that
  tool; otherwise `image-prompt-generator` (emit prompt spec).

## Step 3 — Assemble manifest
Invoke `asset-manifest-generator` with the produced assets/prompt specs **and the analyzed
`asset_brief` from Step 1**, so it produces the file/usage manifest and runs format/naming,
**brief-coverage** (every requested asset present, none invented), and spec-reference checks.

## Step 4 — Return
Return `asset_bundle`. The pipeline ends here.

# Rules

- This skill only coordinates. Delegate every asset; never author SVG or prompts directly.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Never claim a raster/photoreal image was produced when `image_backend: none` — such items
  MUST come back as prompt specs, and the summary must say so.
- Boundary: this domain produces actual image files/markup. Use `design/*` for design
  systems, tokens, and wireframes (specs, not final imagery); asset consumes those as style
  input and feeds `web/*` (e.g. `public/`).
- Apply the palette and style consistently across all generated assets.
- Error handling: if a generator fails for one item, continue with the rest and record the
  failed item in the manifest.

# Examples

Input:

```yaml
asset_request:
  assets:
    - { kind: icon, names: [home, search], style: line }
    - { kind: raster, subject: "hero banner, mountains at dawn", size: 1600x600 }
  palette: [ "#111827", "#3B82F6" ]
options: { out_dir: public/assets, image_backend: none }
```

Output (abridged):

```
✔ brief   → spec: 2 icons (line), 1 raster (1600x600)
✔ icon    → home.svg, search.svg (line, 24x24)
↪ raster  → no image backend → prompt spec emitted (not rendered)
✔ manifest→ 2 files + 1 prompt-spec, palette applied

Bundle: 2 SVG icons under public/assets/icons/
Prompt specs: 1 (hero-banner) — hand to an image model to render.
```
