---
name: taste-profiler
description: Structure a user's likes, dislikes, and constraints into a preference model (themes, tones, creators, hard filters) for ranking recommendations. First structuring stage of the media-curator pipeline.
version: 1.0.0
category: media-curator
tags:
  - media-curator
  - taste
  - preferences
model: inherit
invokes: []
inputs:
  - curation_request
outputs:
  - taste_profile
---

# Goal

Turn stated likes/dislikes/constraints into a structured preference model the recommender can
score against, separating soft preferences from hard filters. This skill models taste; it
does not find or rank titles.

# Inputs

```yaml
curation_request: { medium, likes: [...], dislikes: [...], constraints: {...} }
```

# Output

```yaml
taste_profile:
  affinities: [ { signal, weight: high|med } ]   # themes, tones, creators, genres
  aversions: [<what to avoid>]
  hard_filters: { rating_ceiling, max_runtime_per, availability: [...] }
```

# Workflow

## Step 1 — Extract affinities
Derive themes, tones, genres, and creators from `likes`, weighting strong signals.

## Step 2 — Extract aversions
List dislikes as soft-negative signals.

## Step 3 — Separate hard filters
Move rating/runtime/availability into `hard_filters` (non-negotiable).

## Step 4 — Return
Return `taste_profile`. Stop.

# Rules

- Model only stated preferences; do not assume tastes not given.
- Keep hard filters (rating/runtime/availability) separate from soft preferences.
- Do not find or rank titles (downstream).
- Weight signals honestly; a single mention is not necessarily "high".

# Examples

Input:

```yaml
curation_request: { medium: film, likes: ["봉준호", "심리 스릴러"], dislikes: ["고어"], constraints: { availability: ["넷플릭스"] } }
```

Output:

```yaml
taste_profile:
  affinities: [ { signal: "감독:봉준호", weight: high }, { signal: "장르:심리 스릴러", weight: high } ]
  aversions: ["고어/과도한 유혈"]
  hard_filters: { rating_ceiling: null, max_runtime_per: null, availability: ["넷플릭스"] }
```
