---
name: image-prompt-generator
description: For raster/photoreal assets that cannot be authored as vectors, produce a detailed, model-ready image-generation prompt plus parameters (size, aspect, negative prompt, style refs) from the asset spec. Bridges to an external image model; produces a spec, not pixels.
version: 1.0.0
category: asset
tags:
  - asset
  - prompt
  - raster
  - image-generation
model: inherit
invokes: []
inputs:
  - raster_items
  - style
  - options
outputs:
  - prompt_specs
---

# Goal

Turn each raster/photoreal asset request into a precise, ready-to-run prompt specification
for an external image-generation model. This skill does not render images; it produces the
prompt and parameters so any connected model can render them later.

# Inputs

```yaml
raster_items:
  - { id: raster-hero, subject: "hero banner, mountains at dawn", size: 1600x600 }
style: { palette: [ "#111827", "#3B82F6" ], mood: cinematic }
options:
  target_model: generic   # generic | <specific model name>
```

# Output

```yaml
prompt_specs:
  - id: raster-hero
    prompt: <detailed positive prompt>
    negative_prompt: <what to avoid>
    params: { width: 1600, height: 600, aspect: "8:3", steps: <suggested>, seed: <optional> }
    style_refs: [<palette/mood cues>]
    usage: <where the rendered image is intended to go>
```

# Workflow

## Step 1 — Expand the subject
Write a detailed positive prompt: subject, composition, lighting, palette, mood, and any
brand cues from `style`.

## Step 2 — Add negatives & params
Add a negative prompt (artifacts, text, watermarks) and dimension/aspect params from the
requested size.

## Step 3 — Tailor to target
If `target_model` is specific, phrase params in that model's conventions; otherwise keep
them generic.

## Step 4 — Return
Return `prompt_specs`. Stop. Rendering is out of scope.

# Rules

- Never claim to produce an image; the output is a prompt spec only.
- Prompts must be self-contained and unambiguous so any model can render consistently.
- Encode palette/brand from `style` into the prompt so results match other assets.
- Do not embed private or sensitive content in prompts.

# Examples

Input:

```yaml
raster_items: [ { id: raster-hero, subject: "hero banner, mountains at dawn", size: 1600x600 } ]
style: { palette: [ "#111827", "#3B82F6" ], mood: cinematic }
options: { target_model: generic }
```

Output:

```yaml
prompt_specs:
  - id: raster-hero
    prompt: "Wide cinematic hero banner of layered mountains at dawn, soft volumetric light, cool blue-and-charcoal palette (#111827, #3B82F6), subtle mist, high detail, no text."
    negative_prompt: "text, watermark, logo, people, low resolution, jpeg artifacts"
    params: { width: 1600, height: 600, aspect: "8:3", steps: 30 }
    style_refs: [ "palette #111827/#3B82F6", "mood: cinematic" ]
    usage: "Landing page hero background."
```
