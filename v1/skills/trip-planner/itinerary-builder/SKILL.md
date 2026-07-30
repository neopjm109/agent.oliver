---
name: itinerary-builder
description: Build a day-by-day itinerary from the destination profile, grouping sights by zone to minimize travel and matching the requested interests and pace. Core planning stage of the trip-planner pipeline.
version: 1.0.0
category: trip-planner
tags:
  - trip-planner
  - itinerary
  - schedule
model: inherit
invokes: []
inputs:
  - destination_profile
  - trip_request
  - options
outputs:
  - itinerary
---

# Goal

Produce a realistic day-by-day plan: each day groups nearby sights, respects the requested
pace, and reflects the traveler's interests. This skill builds the schedule; logistics,
budget, and feasibility checks are downstream.

# Inputs

```yaml
destination_profile: { zones, sights, season }
trip_request: { dates: { days }, interests, pace }
options:
  day_start: "09:00"
```

# Output

```yaml
itinerary:
  - day: <n>
    zone: <primary zone that day>
    items:
      - { time, sight, activity, est_duration }
    meals: [<suggested area/type>]
    notes: <pace/season note>
```

# Workflow

## Step 1 — Assign zones to days
Give each day a primary zone to minimize inter-zone travel.

## Step 2 — Sequence sights
Order sights within the day by proximity and opening hours; match `interests`.

## Step 3 — Apply pace
Fit the number of items to `pace` (relaxed = fewer, packed = more); leave buffer.

## Step 4 — Return
Return `itinerary`. Stop.

# Rules

- Only use sights present in the profile; never invent stops.
- One primary zone per day where possible to reduce transit.
- Respect `pace`; do not over-schedule (leave meal/rest buffer).
- Order by opening hours so days are actually doable (validator will confirm).

# Examples

Input:

```yaml
destination_profile: { zones: [ { name: "동산", sights: ["기요미즈데라", "야사카 신사"] } ] }
trip_request: { dates: { days: 1 }, interests: [사찰], pace: relaxed }
options: { day_start: "09:00" }
```

Output:

```yaml
itinerary:
  - day: 1
    zone: "동산"
    items:
      - { time: "09:30", sight: "기요미즈데라", activity: "참배·단풍 감상", est_duration: "2h" }
      - { time: "12:00", sight: "니넨자카", activity: "점심·거리 산책", est_duration: "1.5h" }
      - { time: "14:30", sight: "야사카 신사", activity: "관람", est_duration: "1h" }
    meals: ["니넨자카 인근 소바"]
    notes: "relaxed 페이스, 도보 위주"
```
