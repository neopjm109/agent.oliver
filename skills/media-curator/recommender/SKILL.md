---
name: recommender
description: Rank and select candidate titles against the taste profile, applying hard filters and producing the top picks with a reason for each. Recommendation stage of the media-curator pipeline.
version: 1.0.0
category: media-curator
tags:
  - media-curator
  - recommendation
  - ranking
model: inherit
invokes: []
inputs:
  - candidates
  - taste_profile
  - curation_request
outputs:
  - recommendations
---

# Goal

Score candidates by fit to the taste profile, drop any that fail hard filters, and return the
top `count` with a concise reason each. This skill ranks provided candidates; it does not find
new titles or plan order.

# Inputs

```yaml
candidates: [ { title, meta, source_ref } ]
taste_profile: { affinities, aversions, hard_filters }
curation_request: { count }
```

# Output

```yaml
recommendations:
  - title: <name>
    why: <reason tied to affinities>
    meta: { ... }
    source_ref: <url>
```

# Workflow

## Step 1 — Apply hard filters
Drop candidates violating rating/runtime/availability filters.

## Step 2 — Score to taste
Rank remaining by affinity match minus aversion hits.

## Step 3 — Select & justify
Take the top `count`; write a reason tied to the taste signals.

## Step 4 — Return
Return `recommendations`. Stop.

# Rules

- Only rank provided candidates; never introduce titles not in the list.
- Hard filters are absolute — never recommend a title that fails one.
- Reasons must cite actual taste affinities, not generic praise.
- Preserve `source_ref` for each pick.

# Examples

Input:

```yaml
candidates: [ { title: "마더", meta: { creator: "봉준호", genre: [스릴러], availability: ["넷플릭스"] }, source_ref: "https://..." } ]
taste_profile: { affinities: [ { signal: "감독:봉준호", weight: high } ], aversions: ["고어"], hard_filters: { availability: ["넷플릭스"] } }
curation_request: { count: 1 }
```

Output:

```yaml
recommendations:
  - { title: "마더", why: "선호 감독(봉준호) + 심리 스릴러, 넷플릭스 가용, 고어 없음", meta: { creator: "봉준호" }, source_ref: "https://..." }
```
