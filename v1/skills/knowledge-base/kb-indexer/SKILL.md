---
name: kb-indexer
description: Build a topic taxonomy and tag index over chunks, grouping related content and mapping topics to their supporting chunk IDs. Organizing stage of the knowledge-base pipeline.
version: 1.0.0
category: knowledge-base
tags:
  - knowledge-base
  - index
  - taxonomy
  - organization
model: inherit
invokes: []
inputs:
  - chunks
  - options
outputs:
  - index
---

# Goal

Organize chunks into a navigable topic structure so artifacts and readers can find relevant
content. This skill indexes only; it does not author FAQ, onboarding, or glossary content.

# Inputs

```yaml
chunks: [ { id, text, source, topic_hint } ]
options:
  max_depth: 2   # taxonomy depth
```

# Output

```yaml
index:
  topics:
    - name: <topic>
      subtopics: [<name>, ...]
      chunk_ids: [K-0001, ...]
  tags: { <tag>: [K-000x, ...] }
  orphans: [<chunk id with no clear topic>, ...]
```

# Workflow

## Step 1 — Cluster
Group chunks into topics using topic hints and content similarity; derive subtopics up to
`max_depth`.

## Step 2 — Tag
Assign cross-cutting tags that span topics.

## Step 3 — Flag orphans
List chunks that fit no topic so coverage gaps are visible.

## Step 4 — Return
Return `index`. Stop.

# Rules

- Organize only; never rewrite chunk content or generate answers.
- Every chunk is either placed in a topic or listed as an orphan (no silent drops).
- Keep the taxonomy shallow and navigable; respect `max_depth`.
- Topic/tag names must reflect actual chunk content, not assumptions.

# Examples

Input:

```yaml
chunks: [ { id: K-0001, text: "배포는 매주 화요일.", topic_hint: 배포 }, { id: K-0002, text: "롤백은 이전 태그.", topic_hint: 배포 } ]
options: { max_depth: 2 }
```

Output:

```yaml
index:
  topics:
    - { name: 배포, subtopics: [롤백], chunk_ids: [K-0001, K-0002] }
  tags: { 운영: [K-0001, K-0002] }
  orphans: []
```
