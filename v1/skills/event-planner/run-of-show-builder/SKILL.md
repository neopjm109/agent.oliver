---
name: run-of-show-builder
description: Build the event's timeline (run-of-show) and a preparation checklist, sequencing arrival, food, activities, and wind-down within the event duration. Timeline stage of the event-planner pipeline.
version: 1.0.0
category: event-planner
tags:
  - event-planner
  - run-of-show
  - timeline
  - checklist
model: inherit
invokes: []
inputs:
  - menu_activities
  - event_spec
  - theme
outputs:
  - run_of_show
---

# Goal

Sequence the event into a timed run-of-show and produce a prep checklist so the host knows
what happens when and what to do beforehand. This skill sequences; it does not create menu or
activities.

# Inputs

```yaml
menu_activities: { menu, activities: [ { name, when_hint } ] }
event_spec: { duration, guests }
theme: { concept }
```

# Output

```yaml
run_of_show:
  timeline: [ { time, segment, detail, duration_min } ]
  prep_checklist: [ { task, when: day-before|day-of, owner? } ]
  total_span: <hours>
```

# Workflow

## Step 1 — Sequence segments
Order arrival → mingling → food → activities → cake/highlight → wind-down within `duration`.

## Step 2 — Time each segment
Assign start times and durations; keep the total within the event span.

## Step 3 — Prep checklist
Derive day-before and day-of tasks (shopping, setup, cooking) from menu/theme.

## Step 4 — Return
Return `run_of_show`. Stop.

# Rules

- Total timeline must fit the stated `duration`; leave buffer between segments.
- Only sequence provided menu/activities; do not invent new ones.
- Checklist tasks must map to actual menu/theme/activity needs.
- Place the highlight (e.g. cake) at a sensible peak, not the very start/end.

# Examples

Input:

```yaml
menu_activities: { activities: [ { name: 포토존, when_hint: 초반 }, { name: 케이크 & 축하, when_hint: 중반 } ] }
event_spec: { duration: 4, guests: 12 }
theme: { concept: "따뜻한 홈파티" }
```

Output:

```yaml
run_of_show:
  timeline:
    - { time: "18:00", segment: 도착·환영, detail: "웰컴 드링크·포토존", duration_min: 40 }
    - { time: "18:40", segment: 식사, detail: "핑거푸드", duration_min: 60 }
    - { time: "19:40", segment: 하이라이트, detail: "케이크 & 축하", duration_min: 30 }
    - { time: "20:10", segment: 자유 시간·마무리, detail: "음악·정리", duration_min: 110 }
  prep_checklist:
    - { task: "장보기·음료 준비", when: day-before }
    - { task: "가랜드·조명 세팅", when: day-of }
  total_span: 4
```
