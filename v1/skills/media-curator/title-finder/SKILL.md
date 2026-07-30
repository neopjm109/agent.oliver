---
name: title-finder
description: Turn research results into a structured list of candidate titles with metadata (year, creator, genre, runtime, rating, availability), deduplicated. Candidate stage of the media-curator pipeline.
version: 1.0.0
category: media-curator
tags:
  - media-curator
  - candidates
  - titles
model: inherit
invokes: []
inputs:
  - research_summary
  - curation_request
outputs:
  - candidates
---

# Goal

Convert a research summary about matching media into clean candidate entries with the
metadata the recommender and validator need. This skill structures found titles; it does not
rank them or invent data.

# Inputs

```yaml
research_summary: { key_facts: [...], sources: [...] }   # from research-orchestrator
curation_request: { medium }
```

# Output

```yaml
candidates:
  - title: <name>
    medium: film | tv | book
    meta: { year, creator, genre: [...], runtime_or_length, rating, availability: [...] }
    source_ref: <url>
```

# Workflow

## Step 1 — Extract titles
Pull distinct titles from the research summary.

## Step 2 — Attach metadata
Record year, creator, genre, runtime/length, rating, and availability as stated in research.

## Step 3 — Dedupe
Merge duplicate/re-listed titles; keep the source reference.

## Step 4 — Return
Return `candidates`. Stop.

# Rules

- Use only titles/metadata present in the research; never invent films, ratings, or
  availability.
- Keep `source_ref` for every candidate for traceability.
- Mark unknown metadata fields as null rather than guessing.
- Do not rank or filter to taste (that is `recommender`).

# Examples

Input:

```yaml
research_summary: { key_facts: ["'마더'(2009, 봉준호, 스릴러, 129분, 넷플릭스)"], sources: ["https://..."] }
curation_request: { medium: film }
```

Output:

```yaml
candidates:
  - { title: "마더", medium: film, meta: { year: 2009, creator: "봉준호", genre: [스릴러, 드라마], runtime_or_length: "129분", rating: "15+", availability: ["넷플릭스"] }, source_ref: "https://..." }
```
