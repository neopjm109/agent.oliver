---
name: logistics-planner
description: Plan the trip's logistics — arrival/departure transfers, inter-zone transport, and lodging placement — so the itinerary connects smoothly. Logistics stage of the trip-planner pipeline.
version: 1.0.0
category: trip-planner
tags:
  - trip-planner
  - logistics
  - transport
  - lodging
model: inherit
invokes: []
inputs:
  - itinerary
  - destination_profile
  - trip_request
outputs:
  - logistics
---

# Goal

Work out how the traveler physically moves through the itinerary: airport/station transfers,
transport between zones/days, and where to base lodging. This skill sequences movement; it
does not price it (that is `budget-estimator`) or book anything.

# Inputs

```yaml
itinerary: [ { day, zone } ]
destination_profile: { transit, zones }
trip_request: { home_city, dates }
```

# Output

```yaml
logistics:
  arrival: <airport/station → first base, mode & rough time>
  departure: <last base → departure point>
  lodging: [ { base_area, covers_days, why } ]
  transfers: [ { day, from_zone, to_zone, mode, est_time } ]
  passes: [<recommended transit pass>]
```

# Workflow

## Step 1 — Base lodging
Choose lodging area(s) central to the itinerary's zones to reduce daily travel.

## Step 2 — Connect arrival/departure
Plan transfers from `home_city`'s arrival point to the base and back.

## Step 3 — Inter-zone transfers
For each day, note transport mode and rough time between zones; recommend passes.

## Step 4 — Return
Return `logistics`. Stop.

# Rules

- Use only transit modes from the destination profile; never invent lines/routes.
- Minimize lodging changes; justify each base with `why`.
- Provide rough times only, labeled as estimates (no live schedules unless tool-provided).
- Do not estimate cost or make bookings.

# Examples

Input:

```yaml
itinerary: [ { day: 1, zone: "동산" }, { day: 2, zone: "아라시야마" } ]
destination_profile: { transit: ["전철", "버스 1일권"] }
trip_request: { home_city: "서울", dates: { days: 2 } }
```

Output:

```yaml
logistics:
  arrival: "간사이공항 → 교토역 하루카 특급 약 75분"
  departure: "교토역 → 간사이공항 하루카 약 75분"
  lodging: [ { base_area: "교토역 인근", covers_days: [1,2], why: "전철 환승 허브, 권역 접근 균등" } ]
  transfers: [ { day: 2, from_zone: "교토역", to_zone: "아라시야마", mode: "JR 사가노선", est_time: "약 20분" } ]
  passes: ["버스 1일권(동산 권역일)", "IC카드"]
```
