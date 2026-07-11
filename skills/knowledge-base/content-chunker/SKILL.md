---
name: content-chunker
description: Segment a merged document corpus into retrievable, self-contained chunks with source provenance and topic hints. First structuring stage of the knowledge-base pipeline.
version: 1.0.0
category: knowledge-base
tags:
  - knowledge-base
  - chunking
  - segmentation
model: inherit
invokes: []
inputs:
  - corpus
  - options
outputs:
  - chunks
---

# Goal

Break a corpus into coherent, self-contained chunks that can be independently retrieved and
cited. This skill segments only; it does not index, summarize, or answer.

# Inputs

```yaml
corpus:
  documents: [ { source: handbook.pdf, content: [<text blocks flattened from docs-analyze structured_document>, ...] }, ... ]
options:
  target_size: paragraph   # paragraph | section | fixed-tokens
  overlap: false
```

# Output

```yaml
chunks:
  - id: <stable ref, e.g. K-0007>
    text: <self-contained chunk>
    source: <source document>
    location: <section/page if available>
    topic_hint: <short tag>
```

# Workflow

## Step 1 — Segment
Split each document at the requested granularity, keeping chunks self-contained (avoid
splitting mid-idea).

## Step 2 — Attach provenance
Give each chunk a stable ID, its source document, and location when available.

## Step 3 — Tag
Add a short topic hint to aid indexing.

## Step 4 — Return
Return `chunks`. Stop.

# Rules

- Segment faithfully; do not paraphrase, summarize, or merge unrelated content.
- Every chunk carries source provenance for later citation.
- Keep chunks self-contained; prefer semantic boundaries over fixed cuts unless
  `fixed-tokens` is requested.
- Do not deduplicate across sources here; the indexer decides relationships.

# Examples

Input:

```yaml
corpus: { documents: [ { source: handbook.pdf, content: [ "배포는 매주 화요일 진행한다.", "롤백은 이전 태그로 되돌린다." ] } ] }
options: { target_size: paragraph }
```

Output:

```yaml
chunks:
  - { id: K-0001, text: "배포는 매주 화요일 진행한다.", source: handbook.pdf, location: "§3", topic_hint: 배포 }
  - { id: K-0002, text: "롤백은 이전 태그로 되돌린다.", source: handbook.pdf, location: "§3", topic_hint: 배포 }
```
