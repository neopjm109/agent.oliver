---
name: sprite-sheet-generator
description: Produce a 2D sprite sheet — animation frames laid out in an atlas with frame coordinates — as SVG or a pixel-art color matrix. Authors vector/procedural sprites directly; complex raster/shaded sprites are emitted as a prompt spec instead.
version: 1.0.0
category: asset
tags:
  - asset
  - sprite
  - sprite-sheet
  - pixel-art
  - animation
model: inherit
invokes: []
inputs:
  - sprite_items
  - style
  - options
outputs:
  - sprites
---

# Goal

Generate 2D sprite sheets: a set of frames for a subject laid out in a grid atlas, with a
frame map (index → x/y/w/h) usable by a game/animation runtime. Vector and pixel-art
sprites are authored directly; shaded/photoreal sprites are not drawn here.

# Inputs

```yaml
sprite_items:
  - { id: coin, subject: "spinning coin", frames: 6, frame_size: 32x32, style: pixel }
style: { palette: [ "#F59E0B", "#B45309" ] }
options:
  layout: horizontal   # horizontal | grid
```

# Output

```yaml
sprites:
  - id: coin
    format: svg | png-matrix | prompt-spec
    sheet: <SVG markup, or {palette, frames:[<matrix>]} for png-matrix>
    frame_map: [ { index: 0, x: 0, y: 0, w: 32, h: 32 }, ... ]
    note: <e.g. "shaded sprite → prompt spec; render with an image model">
```

# Workflow

## Step 1 — Decide representation
- Simple geometric sprite → SVG frames.
- Pixel-art → a color-index matrix per frame plus the palette (a trivial script converts to
  PNG).
- Shaded/photoreal → do not draw; return `format: prompt-spec` with a per-frame prompt.

## Step 2 — Lay out the atlas
Place frames per `options.layout`; compute the `frame_map` coordinates.

## Step 3 — Author frames
Produce each frame in the chosen representation, keeping motion coherent across frames.

## Step 4 — Return
Return `sprites`. Stop.

# Rules

- Never claim a shaded/photoreal sprite was rendered; return a prompt spec for those.
- `frame_map` must exactly match the produced sheet dimensions and frame count.
- Keep the palette fixed across all frames of a sprite for animation consistency.
- Pixel-art matrices must reference palette indices, not raw colors, for compactness.

# Examples

Input:

```yaml
sprite_items: [ { id: coin, subject: "spinning coin", frames: 4, frame_size: 8x8, style: pixel } ]
style: { palette: [ "#00000000", "#F59E0B", "#B45309" ] }
options: { layout: horizontal }
```

Output (abridged):

```yaml
sprites:
  - id: coin
    format: png-matrix
    sheet:
      palette: [ "#00000000", "#F59E0B", "#B45309" ]
      frames:
        - [[0,1,1,0],[1,2,2,1],[1,2,2,1],[0,1,1,0]]   # frame 0 (4x4 shown)
        - [[0,0,1,0],[0,1,2,1],[0,1,2,1],[0,0,1,0]]   # frame 1 (narrower = rotating)
    frame_map: [ { index: 0, x: 0, y: 0, w: 8, h: 8 }, { index: 1, x: 8, y: 0, w: 8, h: 8 } ]
    note: "Pixel-art matrix; convert palette indices to PNG frames."
```
