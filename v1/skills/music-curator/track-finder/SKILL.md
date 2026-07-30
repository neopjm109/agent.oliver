---
name: track-finder
description: Turn research results into candidate tracks with metadata (artist, duration, BPM/energy, explicit flag), deduplicated. Candidate stage of the music-curator pipeline.
version: 1.0.0
category: music-curator
tags:
  - music-curator
  - candidates
  - tracks
model: inherit
invokes: []
inputs:
  - research_summary
  - music_profile
outputs:
  - track_candidates
---

# Goal

Convert a research summary about matching music into clean candidate tracks with the metadata
the sequencer and validator need. This skill structures found tracks; it does not order them
or invent data.

# Inputs

```yaml
research_summary: { key_facts: [...], sources: [...] }   # from research-orchestrator
music_profile: { affinities }
```

# Output

```yaml
track_candidates:
  - title: <track>
    artist: <artist>
    meta: { duration, bpm_or_energy, genre: [...], explicit: bool }
    source_ref: <url>
```

# Workflow

## Step 1 — Extract tracks
Pull distinct tracks/artists from the research summary.

## Step 2 — Attach metadata
Record duration, BPM/energy, genre, and explicit flag as stated in research.

## Step 3 — Dedupe
Merge duplicates; keep the source reference.

## Step 4 — Return
Return `track_candidates`. Stop.

# Rules

- Use only tracks/metadata present in the research; never invent songs, BPM, or flags.
- Keep `source_ref` for every candidate.
- Mark unknown metadata as null rather than guessing.
- Do not sequence or filter to taste (downstream).

# Examples

Input:

```yaml
research_summary: { key_facts: ["Tycho - 'Awake' (앰비언트, 약 5분, instrumental)"], sources: ["https://..."] }
music_profile: { affinities: { genres: [앰비언트] } }
```

Output:

```yaml
track_candidates:
  - { title: "Awake", artist: "Tycho", meta: { duration: "5:00", bpm_or_energy: "mid-low", genre: [앰비언트], explicit: false }, source_ref: "https://..." }
```
