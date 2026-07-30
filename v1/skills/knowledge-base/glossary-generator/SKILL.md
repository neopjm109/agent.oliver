---
name: glossary-generator
description: Extract domain terms and define them from corpus chunks, producing a source-cited glossary. Artifact stage of the knowledge-base pipeline.
version: 1.0.0
category: knowledge-base
tags:
  - knowledge-base
  - glossary
  - terminology
model: inherit
invokes: []
inputs:
  - index
  - chunks
  - options
outputs:
  - glossary
---

# Goal

Identify the domain-specific terms in the corpus and define each from its supporting chunks,
with citations. This skill defines terms found in the corpus; it never invents definitions.

# Inputs

```yaml
index: { topics: [...] }
chunks: [ { id, text, source } ]
options:
  language: ko
```

# Output

```yaml
glossary:
  - term: <term>
    definition: <definition grounded in chunks>
    source_refs: [K-0001, ...]
    aliases: [<synonym>, ...]   # or []
```

# Workflow

## Step 1 — Collect terms
Find domain terms, acronyms, and product names appearing in chunks.

## Step 2 — Define from chunks
Write each definition from the chunk(s) that explain it; cite them.

## Step 3 — Merge aliases
Group synonyms/acronyms under one canonical term.

## Step 4 — Return
Return an alphabetically ordered `glossary`. Stop.

# Rules

- Define only terms the corpus explains; if a term is used but never defined, omit it or
  mark it undefined rather than guessing.
- Every definition cites its chunk IDs.
- Merge acronyms with their expansions under one entry.
- Keep definitions concise and corpus-faithful.

# Examples

Input:

```yaml
chunks: [ { id: K-0005, text: "MSA는 마이크로서비스 아키텍처를 의미하며 서비스를 독립 배포 단위로 나눈다.", source: handbook.pdf } ]
options: { language: ko }
```

Output:

```yaml
glossary:
  - term: "MSA"
    definition: "마이크로서비스 아키텍처. 서비스를 독립 배포 단위로 나누는 방식."
    source_refs: [K-0005]
    aliases: ["마이크로서비스 아키텍처"]
```
