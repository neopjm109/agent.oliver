---
name: watch-order-planner
description: Sequence the recommended titles into a suggested consumption order (by mood arc, chronology, or escalating intensity) within a total runtime/time budget. Ordering stage of the media-curator pipeline.
version: 1.0.0
category: media-curator
tags:
  - media-curator
  - order
  - sequencing
model: inherit
invokes: []
inputs:
  - recommendations
  - curation_request
  - options
outputs:
  - watch_order
---

# Goal

Arrange the picks into a satisfying order and note the total time commitment, so the user
knows what to start with and how long it all takes. This skill orders provided picks; it does
not add or drop titles.

# Inputs

```yaml
recommendations: [ { title, meta: { runtime_or_length } } ]
curation_request: { medium }
options:
  strategy: mood-arc   # mood-arc | chronological | escalating | standalone-first
  time_budget: "한 주말"
```

# Output

```yaml
watch_order:
  sequence: [ { order, title, note } ]
  total_time: <sum of runtimes/lengths>
  fits_budget: yes | no | unknown
```

# Workflow

## Step 1 — Choose ordering
Sequence per `options.strategy` (e.g. standalone → heavier, or chronological for series).

## Step 2 — Sum time
Total the runtimes/lengths; compare to `time_budget` if given.

## Step 3 — Annotate
Add a short note per item (why here in the order).

## Step 4 — Return
Return `watch_order`. Stop.

# Rules

- Order only the provided recommendations; never add/drop titles.
- Sum time honestly from metadata; mark `unknown` when lengths are missing.
- Keep the ordering rationale consistent with the chosen strategy.
- Do not re-recommend or re-filter (upstream owns that).

# Examples

Input:

```yaml
recommendations: [ { title: "마더", meta: { runtime_or_length: "129분" } }, { title: "살인의 추억", meta: { runtime_or_length: "131분" } } ]
options: { strategy: escalating, time_budget: "한 주말" }
```

Output:

```yaml
watch_order:
  sequence:
    - { order: 1, title: "살인의 추억", note: "고전 명작으로 워밍업" }
    - { order: 2, title: "마더", note: "심리 강도 상승으로 마무리" }
  total_time: "약 4시간 20분"
  fits_budget: yes
```
