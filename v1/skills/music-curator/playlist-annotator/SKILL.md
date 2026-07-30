---
name: playlist-annotator
description: Add liner notes to the sequenced playlist — a one-line reason per track and section labels for the arc — so the listener understands the flow. Annotation stage of the music-curator pipeline.
version: 1.0.0
category: music-curator
tags:
  - music-curator
  - annotation
  - liner-notes
model: inherit
invokes: []
inputs:
  - sequenced_playlist
  - music_profile
  - options
outputs:
  - annotated_playlist
---

# Goal

Enrich the ordered playlist with brief, useful notes: why each track sits where it does and
labels for the arc's sections. This skill annotates; it does not reorder or change tracks.

# Inputs

```yaml
sequenced_playlist: { tracks: [ { order, title, artist } ], arc_note }
music_profile: { affinities: { moods, ... }, energy, occasion? }   # occasion only if the profile carries it
options:
  language: ko
```

# Output

```yaml
annotated_playlist:
  title: <suggested playlist name>
  sections: [ { label, track_range } ]
  tracks: [ { order, title, artist, note } ]
```

# Workflow

## Step 1 — Name the playlist
Suggest a fitting title from the profile's mood/energy (and `occasion` when the profile carries it).

## Step 2 — Label sections
Group the arc into labeled sections (e.g. 워밍업 / 몰입 / 마무리).

## Step 3 — Note each track
Add a one-line reason per track (role in the flow).

## Step 4 — Return
Return `annotated_playlist`. Stop.

# Rules

- Do not reorder, add, or remove tracks; annotate the given sequence only.
- Keep notes to one concise line each.
- Section labels must match the actual energy arc.
- Base the title on the profile's mood/energy (and stated occasion when present), not invented themes.

# Examples

Input:

```yaml
sequenced_playlist: { tracks: [ { order: 1, title: "Awake", artist: "Tycho" } ], arc_note: "완만한 유지" }
music_profile: { occasion: "집중 작업" }
options: { language: ko }
```

Output:

```yaml
annotated_playlist:
  title: "딥 포커스 90"
  sections: [ { label: "몰입 유지", track_range: "1-N" } ]
  tracks: [ { order: 1, title: "Awake", artist: "Tycho", note: "잔잔한 진입으로 집중 시작" } ]
```
