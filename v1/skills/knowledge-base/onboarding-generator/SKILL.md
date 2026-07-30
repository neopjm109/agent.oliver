---
name: onboarding-generator
description: Assemble an ordered onboarding path (sequenced steps with content and source citations) for a target audience from indexed chunks. Artifact stage of the knowledge-base pipeline.
version: 1.0.0
category: knowledge-base
tags:
  - knowledge-base
  - onboarding
  - learning-path
model: inherit
invokes: []
inputs:
  - index
  - chunks
  - options
outputs:
  - onboarding
---

# Goal

Produce a logically ordered onboarding path from the corpus for a specific audience, each
step grounded in cited chunks. This skill sequences and grounds existing content; it does
not invent procedures.

# Inputs

```yaml
index: { topics: [...] }
chunks: [ { id, text, source } ]
options:
  audience: new-engineer
  language: ko
```

# Output

```yaml
onboarding:                       # only grounded, cited steps go here
  - step: <n>
    title: <step title>
    content: <what to do/know, grounded in chunks>
    source_refs: [K-0001, ...]
gaps:                             # logical-but-uncovered steps live HERE, not in `onboarding`
  - { title: <missing step>, needs_source: true, note: "source needed" }
```

# Workflow

## Step 1 — Sequence topics
Order topics into a sensible learning progression for the audience (setup → basics →
workflows → policies).

## Step 2 — Ground each step
Write each step from supporting chunks and cite them.

## Step 3 — Mark gaps
Where a logical step has no corpus support, record it in the separate `gaps` list
(`needs_source: true`) rather than inventing content or emitting an empty/uncited step into
`onboarding`. Keeping gaps out of the main `onboarding` list keeps every real step cited and
avoids tripping `knowledge-base-validator`'s uncited-entry check on an honest placeholder.

## Step 4 — Return
Return `onboarding`. Stop.

# Rules

- Every step's content is grounded in cited chunks; never fabricate procedures.
- Mark missing steps as gaps so coverage is transparent.
- Order for the audience; keep steps actionable.
- Do not duplicate the full FAQ; onboarding is a guided path, not a Q&A list.

# Examples

Input:

```yaml
index: { topics: [ { name: 환경설정, chunk_ids: [K-0003] }, { name: 배포, chunk_ids: [K-0001] } ] }
chunks: [ { id: K-0003, text: "사내 VPN을 먼저 설치한다.", source: handbook.pdf }, { id: K-0001, text: "배포는 매주 화요일.", source: handbook.pdf } ]
options: { audience: new-engineer, language: ko }
```

Output:

```yaml
onboarding:
  - { step: 1, title: "환경 설정", content: "사내 VPN을 먼저 설치합니다.", source_refs: [K-0003] }
  - { step: 2, title: "배포 주기 이해", content: "배포는 매주 화요일 진행됩니다.", source_refs: [K-0001] }
```
