---
name: playlist-sequencer
description: Select and order candidate tracks into an energy arc with smooth tempo/key transitions, hitting the duration target and honoring hard filters. Sequencing stage of the music-curator pipeline.
version: 1.0.0
category: music-curator
tags:
  - music-curator
  - sequencing
  - energy-arc
model: inherit
invokes: []
inputs:
  - track_candidates
  - music_profile
  - options
outputs:
  - sequenced_playlist
---

# Goal

Choose from the candidates and order them so the playlist flows: a coherent energy arc, smooth
transitions, and a total near the duration target, dropping tracks that fail hard filters. This
skill selects and orders; it does not find tracks or write notes.

# Inputs

```yaml
track_candidates: [ { title, artist, meta: { duration, bpm_or_energy, explicit } } ]
music_profile: { energy: { arc, target_bpm_range }, hard_filters: { explicit, duration_target } }
options: {}
```

# Output

```yaml
sequenced_playlist:
  tracks: [ { order, title, artist, duration, bpm_or_energy, explicit } ]
  total_duration: <sum>
  arc_note: <how energy moves across the set>
```

# Workflow

## Step 1 — Filter
Drop candidates failing hard filters (explicit, wildly off-energy).

## Step 2 — Order by arc
Sequence per `energy.arc`, smoothing BPM/energy transitions between neighbors.

## Step 3 — Hit duration
Add/trim tracks so `total_duration` approaches `duration_target`.

## Step 4 — Return
Return `sequenced_playlist`. Stop.

# Rules

- Only use provided candidates; never invent tracks.
- Never include a track violating a hard filter (e.g. explicit when disallowed).
- Avoid jarring energy jumps between adjacent tracks.
- Approach the duration target; do not wildly overshoot/undershoot.

# Examples

Input:

```yaml
track_candidates: [ { title: "Awake", artist: "Tycho", meta: { duration: "5:00", bpm_or_energy: "mid-low", explicit: false } }, { title: "A Walk", artist: "Tycho", meta: { duration: "5:10", bpm_or_energy: "mid", explicit: false } } ]
music_profile: { energy: { arc: steady, target_bpm_range: "60-90" }, hard_filters: { explicit: false, duration_target: "10분" } }
```

Output:

```yaml
sequenced_playlist:
  tracks:
    - { order: 1, title: "Awake", artist: "Tycho", duration: "5:00", bpm_or_energy: "mid-low", explicit: false }
    - { order: 2, title: "A Walk", artist: "Tycho", duration: "5:10", bpm_or_energy: "mid", explicit: false }
  total_duration: "10:10"
  arc_note: "완만한 mid-low → mid 유지, 급변 없음"
```
