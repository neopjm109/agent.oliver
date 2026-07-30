---
name: packing-list-generator
description: Generate a packing list tailored to the destination's season, the planned activities, and trip length, grouped by category with rationale for special items. Packing stage of the trip-planner pipeline.
version: 1.0.0
category: trip-planner
tags:
  - trip-planner
  - packing
  - checklist
model: inherit
invokes: []
inputs:
  - destination_profile
  - itinerary
  - trip_request
outputs:
  - packing_list
---

# Goal

Produce a practical packing list matched to the weather/season, the activities in the
itinerary, and the trip length. This skill lists what to bring; it does not plan or budget.

# Inputs

```yaml
destination_profile: { season, safety_etiquette }
itinerary: [ { items: [ { activity } ] } ]
trip_request: { dates: { days }, party }
```

# Output

```yaml
packing_list:
  categories:
    - name: <clothing | documents | electronics | health | activity-specific>
      items: [ { item, note } ]
  special: [ { item, why } ]   # driven by season/activity/etiquette
```

# Workflow

## Step 1 — Base essentials
List documents, electronics, health, and toiletries scaled to trip length and party.

## Step 2 — Season-appropriate clothing
Match clothing to the profile's `season` (layers, rain gear, footwear).

## Step 3 — Activity & etiquette items
Add items driven by planned activities and local etiquette; explain special items.

## Step 4 — Return
Return `packing_list`. Stop.

# Rules

- Tailor to the actual season and activities; no generic one-size list.
- Explain special/unusual items via `why` (e.g. modest wear for temples).
- Scale quantities to trip length and party size.
- Do not plan the itinerary or estimate budget.

# Examples

Input:

```yaml
destination_profile: { season: "10월 중순 선선, 단풍", safety_etiquette: ["사찰 정숙"] }
itinerary: [ { items: [ { activity: "사찰·도보 관광" } ] } ]
trip_request: { dates: { days: 4 }, party: { adults: 2 } }
```

Output:

```yaml
packing_list:
  categories:
    - { name: clothing, items: [ { item: "가벼운 겉옷", note: "아침저녁 쌀쌀" }, { item: "편한 워킹화", note: "도보 관광 많음" } ] }
    - { name: documents, items: [ { item: "여권", note: "" }, { item: "IC카드/패스", note: "" } ] }
  special: [ { item: "접이식 우산", why: "가을 소나기 대비" }, { item: "무릎 덮는 하의", why: "일부 사찰 예절" } ]
```
