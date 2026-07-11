---
name: summarize
description: Produce a concise, structured, source-cited summary using only verified information from prior research stages, without new research, fact-checking, or outside knowledge. Final stage of the research pipeline.
version: 1.0.0
category: research
tags:
  - research
  - summary
  - synthesis
  - final-output
model: inherit
invokes: []
inputs:
  - fact_check_result
  - source_evaluation
  - options
outputs:
  - research_summary
---

# Goal

Generate a clear, concise summary using only information provided by upstream research
skills. This skill does not perform research, fact checking, or source validation — it
reorganizes verified information into a human-readable summary.

# Inputs

```yaml
fact_check_result: { ... }   # verified claims and evidence
source_evaluation: { ... }   # validated sources
options:
  target_audience: developers  # optional
  summary_length: short        # optional
  output_format: markdown      # optional
```

# Output

```yaml
research_summary:
  summary: <concise summary using only verified facts>
  key_points: [<point>, ...]
  important_facts: [<verified fact, unmodified>, ...]
  open_questions: [<unresolved item>, ...]  # or "None."
  sources: [<url>, ...]
```

# Workflow

## Step 1 — Receive verified facts
Receive verified facts; ignore rejected or unverified information.

## Step 2 — Group and dedupe
Group related facts and remove duplicated statements, preserving original meaning.

## Step 3 — Compose
Produce a concise summary that preserves important technical details.

## Step 4 — Attach sources
Include all referenced, validated sources. Stop.

# Rules

- Only use information provided as input. Never search, add missing facts, guess, infer
  conclusions, fill knowledge gaps, or introduce outside knowledge.
- Preserve original meaning: do not change technical meanings, strengthen or weaken claims,
  merge unrelated facts, or omit critical limitations.
- Never include unverified claims, rejected facts, speculation, predictions, opinions, or
  recommendations.
- Write in a neutral tone; avoid marketing, subjective, or emotional wording.
- Every summarized statement must be traceable to at least one validated source; do not
  summarize information whose source is unknown.
- If available information is insufficient, state "Insufficient verified information"; do
  not attempt to complete the answer.
- Do not perform new research, source validation, fact checking, comparison, ranking, or
  answer questions beyond the provided facts.

# Examples

Input:

```yaml
fact_check_result:
  claims:
    - claim: "Virtual Threads require Java 21."
      status: Supported
      confidence: High
    - claim: "Spring Boot 3.4 supports Virtual Threads."
      status: Supported
      confidence: High
source_evaluation:
  sources:
    - url: "https://docs.spring.io/..."
    - url: "https://docs.oracle.com/..."
```

Output:

```yaml
research_summary:
  summary: >
    Spring Boot 3.4 supports Virtual Threads, which are provided by Java 21 (Project Loom).
    Virtual Threads require Java 21.
  key_points:
    - "Spring Boot 3.4 supports Virtual Threads."
    - "Virtual Threads require Java 21."
  important_facts:
    - "Spring Boot 3.4 supports Virtual Threads. [docs.spring.io]"
    - "Virtual Threads require Java 21. [docs.oracle.com]"
  open_questions: "None."
  sources:
    - "https://docs.spring.io/..."
    - "https://docs.oracle.com/..."
```
