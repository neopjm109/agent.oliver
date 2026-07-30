---
name: media-curator-orchestrator
description: Coordinate the end-to-end watch/read curation pipeline that turns a taste profile into ranked film/TV/book recommendations with a suggested consumption order, checked against constraints. Reuses the research domain for real titles. Entrypoint of the media-curator domain.
version: 1.0.0
category: media-curator
tags:
  - media-curator
  - orchestrator
  - recommendation
  - film
  - books
  - pipeline
  - entrypoint
model: inherit
invokes:
  - research-orchestrator
  - taste-profiler
  - title-finder
  - recommender
  - watch-order-planner
  - media-fit-validator
inputs:
  - curation_request
  - options
outputs:
  - curation
---

# Goal

Produce a curated watch/read list by orchestrating specialized media-curator skills. This
skill **never recommends from memory directly** — it gathers real titles via research,
profiles taste, ranks recommendations, plans an order, and validates fit. Curation content,
not code.

# Inputs

```yaml
curation_request:
  medium: film            # film | tv | book | mixed
  likes: ["느와르", "봉준호", "심리 스릴러"]
  dislikes: ["고어"]
  constraints: { max_runtime_per: "2h30m", rating_ceiling: "15+", availability: ["넷플릭스"] }
  count: 5
options:
  language: ko
```

# Output

```yaml
curation:
  recommendations: [ { title, why, meta } ]
  order: [<suggested sequence>]
  fit: <pass/fail report>
  sources: [<url>]
```

# Workflow

## Step 1 — Find real titles
Invoke `research-orchestrator` to surface real, current titles matching the likes and
constraints (with sources).

## Step 2 — Profile taste
Invoke `taste-profiler` to structure likes/dislikes/constraints into a preference model.

## Step 3 — Structure candidates
Invoke `title-finder` to turn research results into candidate titles with metadata.

## Step 4 — Recommend
Invoke `recommender` to rank/select candidates to the taste model.

## Step 5 — Order & validate
Invoke `watch-order-planner` (sequence + runtime budget) and `media-fit-validator`
(constraints); if fit fails, return to `recommender` once, then re-check.

## Step 6 — Return
Return `curation`. The pipeline ends here.

# Rules

- This skill only coordinates. Delegate every stage; never invent titles, ratings, or
  availability — those come from research (sourced).
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Never present unsourced titles/metadata as fact; availability/ratings can change — label
  as of the research.
- Never generate code. Boundary: media-curator handles watch/read (film/TV/books); music
  playlists are `music-curator`.
- Error handling: if research fails, stop and report insufficient info; if a stage fails,
  return partial curation and mark it.

# Examples

Input:

```yaml
curation_request: { medium: film, likes: ["봉준호", "심리 스릴러"], dislikes: ["고어"], constraints: { availability: ["넷플릭스"] }, count: 3 }
options: { language: ko }
```

Output (abridged):

```
✔ research → 후보 실제 영화 목록 (출처)
✔ taste    → 감독 취향 + 스릴러 선호, 고어 회피
✔ titles   → 6 후보 메타 구조화
✔ recommend→ 상위 3 선정
✔ order    → 몰입도 순 배열
✔ fit      → pass (고어 없음·넷플릭스 가용)

Curation: 봉준호 취향 스릴러 3편 — 넷플릭스 가용 기준.
```
