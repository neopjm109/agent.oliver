---
name: trip-planner-orchestrator
description: Coordinate the end-to-end trip-planning pipeline that turns a travel request into a day-by-day itinerary with logistics, budget, and packing list, checked for feasibility. Reuses the research domain for real destination facts. Entrypoint of the trip-planner domain.
version: 1.0.0
category: trip-planner
tags:
  - trip-planner
  - orchestrator
  - travel
  - itinerary
  - pipeline
  - entrypoint
model: inherit
invokes:
  - research-orchestrator
  - destination-profiler
  - itinerary-builder
  - logistics-planner
  - budget-estimator
  - packing-list-generator
  - trip-feasibility-validator
inputs:
  - trip_request
  - options
outputs:
  - trip_plan
---

# Goal

Produce a runnable trip plan by orchestrating specialized trip-planning skills. This skill
**never plans directly** — it gathers destination facts (via the research domain), sequences
profiling, itinerary, logistics, budget, and packing, validates feasibility, and returns the
plan. It produces a plan/checklist; live prices and bookings require external tools and are
flagged as estimates.

# Inputs

```yaml
trip_request:
  destination: "교토, 일본"
  dates: { start: "2026-10-10", days: 4 }
  party: { adults: 2 }
  interests: [사찰, 음식, 단풍]
  pace: relaxed        # relaxed | balanced | packed
  budget_ceiling: { amount: 2000000, currency: KRW }   # optional
options:
  language: ko
  home_city: "서울"
```

# Output

```yaml
trip_plan:
  destination_profile: <structured facts>
  itinerary: [ { day, items } ]
  logistics: <transport/lodging sequencing>
  budget: <estimate by category>
  packing_list: [<item>, ...]
  feasibility: <pass/fail report>
```

# Workflow

## Step 1 — Research the destination
Invoke `research-orchestrator` for real, sourced facts (attractions, seasons, transit,
safety, opening patterns) about the destination and dates.

## Step 2 — Profile
Invoke `destination-profiler` to structure the research into travel-relevant facts.

## Step 3 — Build the itinerary
Invoke `itinerary-builder` for a day-by-day plan matching `interests` and `pace`.

## Step 4 — Logistics & budget
Invoke `logistics-planner` (transport/lodging/transfers) and `budget-estimator` (cost by
category, within any `budget_ceiling`).

## Step 5 — Packing
Invoke `packing-list-generator` from destination, season, and activities.

## Step 6 — Validate feasibility
Invoke `trip-feasibility-validator` (travel times, opening hours, over-packed days); if it
fails, return flagged days to `itinerary-builder` once, then re-check.

## Step 7 — Return
Return `trip_plan`. The pipeline ends here.

# Rules

- This skill only coordinates. Delegate every stage; never research, profile, plan, budget,
  or pack directly.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Destination facts must come from `research-orchestrator` (sourced); never invent
  attractions, prices, or transit that research did not surface.
- Prices/bookings are estimates unless a live tool provides them — label them as such.
- Never generate code; this domain produces a travel plan.
- Error handling: if research fails, stop and report insufficient info. If a downstream stage
  fails, return the partial plan and mark the incomplete stage.

# Examples

Input:

```yaml
trip_request: { destination: "교토, 일본", dates: { start: "2026-10-10", days: 4 }, party: { adults: 2 }, interests: [사찰, 음식, 단풍], pace: relaxed }
options: { language: ko, home_city: "서울" }
```

Output (abridged):

```
✔ research   → 교토 10월 단풍 시기·주요 사찰·버스/전철 정보 (출처 인용)
✔ profile    → 4개 권역(동산/아라시야마/후시미/시내), 단풍 피크 중순
✔ itinerary  → 4일 (권역별 묶음, relaxed 페이스)
✔ logistics  → 간사이공항→교토 하루카, 시내 버스 1일권 ×N
✔ budget     → 약 ₩1,750,000 (숙박/교통/식비/입장료) *추정
✔ packing    → 가을 레이어링·우산·편한 신발
✔ feasibility→ pass

Trip Plan: 교토 4일 — 권역 묶음으로 이동 최소화, 단풍 피크 반영.
```
