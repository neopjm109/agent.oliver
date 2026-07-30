---
name: placeholder-image-generator
description: Generate placeholder/sample images (avatars, thumbnails, banners, backgrounds) as SVG or data-URI using solid fills, gradients, initials, or geometric patterns. Deterministic; requires no external image model.
version: 1.0.0
category: asset
tags:
  - asset
  - placeholder
  - sample
  - svg
  - data-uri
model: inherit
invokes: []
inputs:
  - placeholder_items
  - style
outputs:
  - placeholders
---

# Goal

Produce lightweight placeholder/sample images for use while real imagery is unavailable:
avatars (initials/monogram), thumbnails, banners, and patterned backgrounds. Output is SVG
or a data-URI; no raster model is involved.

# Inputs

```yaml
placeholder_items:
  - { id: av-1, purpose: avatar, size: 128x128, label: "JP" }
  - { id: banner-1, purpose: banner, size: 1200x300, label: "Coming soon" }
style: { palette: [ "#3B82F6", "#F9FAFB" ], shape: rounded }
```

# Output

```yaml
placeholders:
  - { id, purpose, size, format: svg | data-uri, content: <SVG or data-URI> }
```

# Workflow

## Step 1 — Choose a motif
Pick per purpose: avatar → initials on a color block; banner → gradient + centered label;
thumbnail → geometric pattern; background → repeating pattern/gradient.

## Step 2 — Render as SVG
Compose the motif at the requested size using the palette; center any label text.

## Step 3 — Optionally inline
If a data-URI is requested, base64-encode the SVG for direct `src` embedding.

## Step 4 — Return
Return `placeholders`. Stop.

# Rules

- Author valid, self-contained SVG; no external fonts/images (use system font stacks).
- Derive avatar colors deterministically from the label so the same input yields the same
  image.
- Keep file size small; avoid gradients with excessive stops.
- Clearly a placeholder — do not attempt photoreal content here (route that to
  `image-prompt-generator`).

# Examples

Input:

```yaml
placeholder_items: [ { id: av-1, purpose: avatar, size: 128x128, label: "JP" } ]
style: { palette: [ "#3B82F6", "#F9FAFB" ], shape: rounded }
```

Output:

```yaml
placeholders:
  - id: av-1
    purpose: avatar
    size: 128x128
    format: svg
    content: >
      <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
        <rect width="128" height="128" rx="16" fill="#3B82F6"/>
        <text x="64" y="64" dy=".35em" text-anchor="middle" font-family="system-ui,sans-serif"
              font-size="56" fill="#F9FAFB">JP</text>
      </svg>
```
