---
name: music-taste-profiler
description: Structure a music request — mood, genres, occasion, energy/tempo target, and seed artists — into a preference model with hard constraints. First structuring stage of the music-curator pipeline.
version: 1.0.0
category: music-curator
tags:
  - music-curator
  - taste
  - preferences
model: inherit
invokes: []
inputs:
  - playlist_request
outputs:
  - music_profile
---

# Goal

Turn a playlist request into a structured preference model the sequencer and validator can use:
mood/genre affinities, target energy/tempo, and hard constraints. This skill models taste; it
does not find or order tracks.

# Inputs

```yaml
playlist_request: { occasion, mood: [...], genres: [...], seeds: [...], duration_target, constraints: {...} }
```

# Output

```yaml
music_profile:
  affinities: { genres: [...], moods: [...], seed_artists: [...] }
  energy: { target_bpm_range, arc: rising|steady|wind-down }
  hard_filters: { explicit: bool, duration_target, instrumental_pref? }
  occasion: <carried from the request when given (used for the playlist title)>
```

# Workflow

## Step 1 — Model affinities
Capture genres, moods, and seed artists as positive signals.

## Step 2 — Set energy target
Derive a BPM range and energy arc from occasion/mood (e.g. 집중 → low, steady).

## Step 3 — Separate hard filters
Move explicit/duration/instrumental preferences into `hard_filters`.

## Step 4 — Return
Return `music_profile`. Stop.

# Rules

- Model only stated preferences; do not assume genres not given.
- Keep hard filters (explicit/duration) separate from soft preferences.
- Map occasion→energy sensibly (focus=low steady, party=high rising).
- Do not find or order tracks (downstream).

# Examples

Input:

```yaml
playlist_request: { occasion: "집중 작업", mood: ["차분한"], genres: ["앰비언트", "로파이"], seeds: ["Tycho"], duration_target: "90분", constraints: { explicit: false } }
```

Output:

```yaml
music_profile:
  affinities: { genres: [앰비언트, 로파이], moods: [차분한], seed_artists: [Tycho] }
  energy: { target_bpm_range: "60-90", arc: steady }
  hard_filters: { explicit: false, duration_target: "90분", instrumental_pref: true }
```
