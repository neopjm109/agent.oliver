---
name: destination-profiler
description: Structure researched destination facts into a travel-relevant profile — regions/zones, seasonal notes, key sights, transit modes, and safety/etiquette — for itinerary planning. First structuring stage of the trip-planner pipeline.
version: 1.0.0
category: trip-planner
tags:
  - trip-planner
  - destination
  - profile
model: inherit
invokes: []
inputs:
  - research_summary
  - trip_request
outputs:
  - destination_profile
---

# Goal

Turn a research summary about a destination into a structured profile the itinerary builder
can use: geographic zones, seasonal context for the dates, key sights grouped by zone,
transit options, and safety/etiquette notes. This skill structures facts; it does not build
the itinerary.

# Inputs

```yaml
research_summary: { key_facts: [...], sources: [...] }   # from research-orchestrator
trip_request: { destination, dates, interests }
```

# Output

```yaml
destination_profile:
  zones: [ { name, sights: [...], travel_note } ]
  season: <weather/daylight/crowds for the dates>
  transit: [<mode + when to use>]
  sights: [ { name, zone, interest_tags, typical_hours } ]
  safety_etiquette: [<note>, ...]
  sources: [<url>, ...]
```

# Workflow

## Step 1 — Group by zone
Cluster key sights into geographic zones to minimize later travel.

## Step 2 — Add seasonal context
Summarize weather/daylight/crowds for the travel dates.

## Step 3 — Capture transit & etiquette
List transit modes and any safety/etiquette notes; carry source URLs.

## Step 4 — Return
Return `destination_profile`. Stop.

# Rules

- Use only facts from the research summary; never invent sights, hours, or transit.
- Preserve source URLs for traceability.
- Group sights by zone so itinerary planning can minimize transit.
- Do not build the itinerary or estimate budget.

# Examples

Input:

```yaml
research_summary: { key_facts: ["기요미즈데라는 동산 권역", "10월 중순 단풍 피크", "시내 버스 1일권 존재"], sources: ["https://..."] }
trip_request: { destination: "교토", dates: { start: "2026-10-10", days: 4 }, interests: [사찰, 단풍] }
```

Output:

```yaml
destination_profile:
  zones:
    - { name: "동산(히가시야마)", sights: ["기요미즈데라"], travel_note: "도보 관광 밀집" }
  season: "10월 중순 단풍 피크, 선선, 관광객 많음"
  transit: ["시내 버스 1일권(권역 내 이동)", "전철(권역 간 이동)"]
  sights: [ { name: "기요미즈데라", zone: "동산", interest_tags: [사찰, 단풍], typical_hours: "06:00-18:00" } ]
  safety_etiquette: ["사찰 내 정숙", "버스 후승전강"]
  sources: ["https://..."]
```
