---
name: music-curator-orchestrator
description: Coordinate the end-to-end playlist-curation pipeline that turns a mood/occasion and taste into a sequenced playlist of real tracks with an energy arc, validated for flow and duration. Reuses the research domain for real tracks. Entrypoint of the music-curator domain.
version: 1.0.0
category: music-curator
tags:
  - music-curator
  - orchestrator
  - playlist
  - music
  - pipeline
  - entrypoint
model: inherit
invokes:
  - research-orchestrator
  - music-taste-profiler
  - track-finder
  - playlist-sequencer
  - playlist-annotator
  - playlist-flow-validator
inputs:
  - playlist_request
  - options
outputs:
  - playlist
---

# Goal

Produce a sequenced playlist by orchestrating specialized music-curator skills. This skill
**never invents tracks from memory** — it gathers real tracks via research, profiles taste,
sequences an energy arc, annotates, and validates flow/duration. Curation content, not code.

# Inputs

```yaml
playlist_request:
  occasion: "집중 작업"
  mood: ["차분한", "몽환적"]
  genres: ["앰비언트", "로파이"]
  seeds: ["Bonobo", "Tycho"]      # optional reference artists/tracks
  duration_target: "90분"
  constraints: { explicit: false }
options:
  language: ko
```

# Output

```yaml
playlist:
  tracks: [ { order, title, artist, note } ]
  energy_arc: <shape description>
  total_duration: <sum>
  flow: <pass/fail report>
  sources: [<url>]
```

# Workflow

## Step 1 — Find real tracks
Invoke `research-orchestrator` to surface real tracks/artists matching the mood, genres, and
seeds (with sources).

## Step 2 — Profile taste
Invoke `music-taste-profiler` to structure mood/genre/energy/tempo into a preference model.

## Step 3 — Structure candidates
Invoke `track-finder` to turn research into candidate tracks with metadata (BPM, key,
duration, explicit).

## Step 4 — Sequence
Invoke `playlist-sequencer` to order tracks into an energy arc with smooth transitions.

## Step 5 — Annotate & validate
Invoke `playlist-annotator` (liner notes) and `playlist-flow-validator` (duration, arc,
explicit filter); if flow fails, return to `playlist-sequencer` once, then re-check.

## Step 6 — Return
Return `playlist`. The pipeline ends here.

# Rules

- This skill only coordinates. Delegate every stage; never invent tracks/artists/metadata —
  those come from research (sourced).
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Honor constraints (e.g. `explicit: false`) as hard limits.
- Never generate code. Boundary: music-curator handles listening/playlists; film/TV/books are
  `media-curator`.
- Error handling: if research fails, stop and report; if a stage fails, return partial playlist
  and mark it.

# Examples

Input:

```yaml
playlist_request: { occasion: "집중 작업", mood: ["차분한"], genres: ["앰비언트", "로파이"], seeds: ["Tycho"], duration_target: "90분", constraints: { explicit: false } }
options: { language: ko }
```

Output (abridged):

```
✔ research → 후보 실제 트랙 목록 (출처)
✔ taste    → 차분·저BPM·인스트루멘털 선호
✔ tracks   → 24 후보 (BPM/길이/explicit)
✔ sequence → 90분 완만한 상승-유지 아크
✔ flow     → pass (explicit 없음·목표 시간 근접)

Playlist: 집중 작업 90분 — 앰비언트/로파이, explicit 없음.
```
