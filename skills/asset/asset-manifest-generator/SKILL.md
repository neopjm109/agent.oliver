---
name: asset-manifest-generator
description: Assemble a manifest of produced assets — file paths, kinds, dimensions, formats, and usage mapping — and validate naming/format/size consistency, brief coverage (every requested asset present, none invented), and spec-reference integrity. Final stage of the asset pipeline.
version: 1.0.0
category: asset
tags:
  - asset
  - manifest
  - validation
  - final-output
model: inherit
invokes: []
inputs:
  - produced_assets
  - prompt_specs
  - asset_brief
  - options
outputs:
  - manifest
---

# Goal

Produce a single manifest describing every produced asset and any pending prompt specs, and
validate that the set is consistent (naming, format, dimensions). Assembles and checks only;
it does not create assets.

# Inputs

```yaml
produced_assets: [ { id, kind, format, content_or_path, size } ]
prompt_specs: [ { id, subject } ]        # raster items not yet rendered
asset_brief:                             # the analyzed brief — the set of REQUESTED assets, to check coverage against
  items: [ { id, kind } ]                # every requested asset id the pipeline was asked to produce
options:
  out_dir: public/assets
  naming: kebab-case
```

# Output

```yaml
manifest:
  base_dir: <out_dir>
  entries:
    - { id, kind, path, format, size, status: ready | pending-render, brief_ref: <brief item id> }
  pending_render: [<id>, ...]            # ids that are prompt specs only
  checks:
    result: pass | fail
    issues: [ { id, issue } ]            # issue: dup-id | dup-path | bad-format | size-mismatch | missing-from-brief | not-in-brief | dangling-ref
    coverage: { requested: <n>, present: <n>, missing: [<id>], invented: [<id>] }
  usage_map: { <slot>: <asset id> }      # optional mapping to frontend slots
```

# Workflow

## Step 1 — Lay out paths
Assign each asset a path under `out_dir` following the `naming` convention and its kind
(icons/, sprites/, placeholders/, raster/).

## Step 2 — Record status
Mark authored assets `ready`; mark prompt-spec-only raster items `pending-render` and list
them in `pending_render`.

## Step 3 — Validate
Check, and force `checks.result: fail` on any violation:
- **Naming/format/size**: unique IDs, unique paths (following `naming`), valid formats, and each
  asset's size matches its spec.
- **Brief coverage**: every `asset_brief.items` id is present in `entries` (no requested asset
  missing), and every entry traces back to a brief item via `brief_ref` (no invented/orphan asset
  not requested by the brief).
- **Spec-reference integrity**: every entry resolves to a real source — a `produced_assets` id
  (`ready`) or a `prompt_specs` id (`pending-render`); no entry references a spec/prompt id that
  does not exist (no dangling `brief_ref`/`spec_ref`/`prompt_ref`).
These make coverage and reference integrity *mechanically enforced*, not merely asserted.

## Step 4 — Return
Return the `manifest`. Stop.

# Rules

- Assemble and validate only; never generate or modify asset content.
- `pending-render` items must never be reported as ready — keep the render gap explicit.
- Paths must be unique and follow the stated naming convention.
- Coverage is judged against `asset_brief.items`: a requested asset absent from `entries`
  (`missing-from-brief`) or an entry not requested by the brief (`not-in-brief`) each force `fail`.
- Every entry must reference a real produced asset / prompt spec; a dangling reference forces `fail`.
- Deterministic check result: any naming/format/size, coverage, or reference violation forces `fail`.

# Examples

Input:

```yaml
produced_assets:
  - { id: icon-home, kind: icon, format: svg, content_or_path: "<svg.../>", size: 24x24 }
prompt_specs:
  - { id: raster-hero, subject: "hero banner" }
asset_brief:
  items: [ { id: icon-home, kind: icon }, { id: raster-hero, kind: raster } ]
options: { out_dir: public/assets, naming: kebab-case }
```

Output:

```yaml
manifest:
  base_dir: public/assets
  entries:
    - { id: icon-home, kind: icon, path: public/assets/icons/home.svg, format: svg, size: 24x24, status: ready, brief_ref: icon-home }
    - { id: raster-hero, kind: raster, path: public/assets/raster/hero.png, format: png, size: 1600x600, status: pending-render, brief_ref: raster-hero }
  pending_render: [ raster-hero ]
  checks:
    result: pass
    issues: []
    coverage: { requested: 2, present: 2, missing: [], invented: [] }
  usage_map: { "nav.home-icon": icon-home, "landing.hero": raster-hero }
```

Fail example: brief also requests `icon-settings` but it is absent from `produced_assets`, and an
extra `icon-mystery` was produced that the brief never requested:

```yaml
  checks:
    result: fail
    issues:
      - { id: icon-settings, issue: missing-from-brief }
      - { id: icon-mystery, issue: not-in-brief }
    coverage: { requested: 3, present: 2, missing: [icon-settings], invented: [icon-mystery] }
```
