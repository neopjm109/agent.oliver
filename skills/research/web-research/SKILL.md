---
name: web-research
description: Read web pages from search results and extract factual statements with source attribution, without summarizing, comparing, verifying, or answering. Use to gather raw facts for the research pipeline.
version: 1.0.0
category: research
tags:
  - research
  - extraction
  - facts
  - web
model: inherit
invokes: []
inputs:
  - search_results
  - options
outputs:
  - extracted_facts
---

# Goal

Extract factual information from web pages returned by prior search results, preserving
source attribution. This skill does not summarize, compare, verify, or answer the user's
question — those tasks belong to downstream skills.

# Inputs

```yaml
search_results:   # from web-search / docs-search / github-search / news-search
  - url: "https://spring.io/..."
    title: "..."
options:
  research_focus: "Virtual Threads version requirements"  # optional
  keywords: [Java, Loom]  # optional
  extraction_depth: standard  # optional
```

# Output

```yaml
extracted_facts:
  research_topic: <topic>
  sources:
    - url: <url>
      title: <title>
      facts: [<single objective statement>, ...]
  unverified_claims: [<statement not confirmable from the source alone>, ...]
  missing_information: [<expected but not found>, ...]
  source_coverage:
    processed: <n>
    accessible: <n>
    failed: <n>
```

# Workflow

## Step 1 — Receive sources
Receive the search results.

## Step 2 — Open and read
Open each source; ignore inaccessible pages. Read content, ignoring ads and unrelated
sections.

## Step 3 — Extract facts
Extract single-idea factual statements. Separate facts from opinions. Preserve source
attribution for every fact.

## Step 4 — Return
Return structured research data with coverage counts. Stop.

# Rules

- Extract only information explicitly stated in the source. Never infer, guess, fill gaps,
  rewrite meaning, or combine facts into conclusions.
- Each fact contains one idea only. Good: "Virtual Threads require Java 21." Bad: "Spring
  Boot fully supports Virtual Threads and therefore apps become much faster."
- Do not extract opinions, recommendations, marketing/promotional claims, or subjective
  descriptions.
- Every fact stays attached to its source; never merge facts from multiple sources.
- Statements not confirmable within the source go under `unverified_claims`, not facts.
- If requested information is absent, report "Not found in available sources"; never answer
  from prior knowledge.
- Do not include summaries, final answers, comparisons, rankings, or speculation.

# Examples

Input:

```yaml
search_results:
  - url: "https://docs.oracle.com/en/java/javase/21/core/virtual-threads.html"
    title: "Virtual Threads — JDK 21"
options: { research_focus: "Virtual Threads version requirements" }
```

Output:

```yaml
extracted_facts:
  research_topic: "Spring Boot Virtual Threads"
  sources:
    - url: "https://docs.oracle.com/en/java/javase/21/core/virtual-threads.html"
      title: "Virtual Threads — JDK 21"
      facts:
        - "Virtual threads were introduced in Java 21."
        - "Virtual threads are lightweight threads managed by the JVM."
  unverified_claims: []
  missing_information:
    - "Whether Spring Boot 3.4 auto-configures virtual threads (not on this page)."
  source_coverage:
    processed: 1
    accessible: 1
    failed: 0
```
