---
name: media-fit-validator
description: Validate the curation against the user's hard constraints — content rating, per-item runtime, availability, and aversions — returning a pass/fail report. Final check of the media-curator pipeline.
version: 1.0.0
category: media-curator
tags:
  - media-curator
  - fit
  - validation
model: inherit
invokes: []
inputs:
  - recommendations
  - taste_profile
  - curation_request
outputs:
  - fit_report
---

# Goal

Confirm every recommendation respects the user's hard constraints and aversions before it is
presented, returning a deterministic pass/fail verdict. This validates fit; it does not
re-recommend.

# Inputs

Validated inputs (produced upstream): `recommendations`, `taste_profile`, `curation_request`.

# Scope

- Rating ceiling (nothing above the allowed rating)
- Runtime/length limit (per-item within the cap)
- Availability (each pick available on an allowed platform/source)
- Aversions (no pick strongly matches a stated aversion)

Out of scope: subjective taste match quality, ranking order.

# Checks

1. Every pick's rating is within `hard_filters.rating_ceiling` (when set).
2. Every pick's runtime/length is within `hard_filters.max_runtime_per` (when set).
3. Every pick is available on an allowed source (when availability is constrained).
4. No pick strongly matches a listed aversion.

# Pass/Fail Criteria

- **pass**: all picks satisfy every hard filter and avoid aversions.
- **fail**: any rating/runtime/availability breach or aversion hit.

# Output Schema

```yaml
fit_report:
  result: pass | fail
  issues:
    - { title: <name>, area: rating | runtime | availability | aversion, detail: <what>, fix: <suggestion> }
  stats: { picks: <n>, issues: <n> }
```

# Rules

- Report issues and fixes only; never re-rank or replace picks (recommender does that).
- Deterministic verdict: any hard-filter breach or aversion hit forces `fail`.
- Judge availability/ratings as of the research; note that they can change.
- Do not assess subjective taste quality; only the checkable constraints.

# Examples

Input:

```yaml
recommendations: [ { title: "X", meta: { rating: "청불", availability: ["디즈니+"] } } ]
taste_profile: { hard_filters: { rating_ceiling: "15+", availability: ["넷플릭스"] }, aversions: [] }
```

Output:

```yaml
fit_report:
  result: fail
  issues:
    - { title: "X", area: rating, detail: "청불 > 허용 15+", fix: "등급 내 대체작으로 교체" }
    - { title: "X", area: availability, detail: "넷플릭스 미제공(디즈니+ 전용)", fix: "넷플릭스 가용작으로 교체" }
  stats: { picks: 1, issues: 2 }
```
