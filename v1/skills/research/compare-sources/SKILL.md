---
name: compare-sources
description: Compare facts extracted from multiple sources and identify agreements, differences, overlaps, and unique claims, without deciding which source is correct or fact-checking. Use before fact-check in the research pipeline.
version: 1.0.0
category: research
tags:
  - research
  - comparison
  - agreements
  - conflicts
model: inherit
invokes: []
inputs:
  - extracted_facts
  - options
outputs:
  - comparison_result
---

# Goal

Compare information collected from multiple research sources and identify agreements,
differences, overlaps, and unique claims. This skill does not determine which source is
correct and does not perform fact checking.

# Inputs

```yaml
extracted_facts:   # from web-research
  research_topic: "Spring Boot Virtual Threads"
  sources: [ ... ]
options:
  comparison_focus: "version requirements"  # optional
```

# Output

```yaml
comparison_result:
  comparison_topic: <topic>
  agreements:
    - statement: <consistent statement>
      supporting_sources: [<url>, ...]
  differences:
    - source_a: <url>
      source_b: <url>
      statements: [<differing statement A>, <differing statement B>]
  unique_information:
    - statement: <fact in only one source>
      source: <url>
  coverage: [<observation about which source covers what>, ...]
  possible_conflicts: [<statement that may need fact-checking>, ...]
```

# Workflow

## Step 1 — Receive facts
Receive the extracted facts.

## Step 2 — Group and detect
Group similar statements; detect duplicate information.

## Step 3 — Classify
Identify agreements, differences, and unique statements. Preserve source attribution.

## Step 4 — Return
Report possible conflicts (without resolving them) and return the comparison. Stop.

# Rules

- Only compare information. Never decide which statement is correct, judge source quality,
  verify facts, conclude, or recommend a source.
- Treat information as an agreement only when multiple independent sources express the same
  meaning; minor wording differences are acceptable.
- Report differences objectively; do not interpret why they differ or attempt reconciliation.
- Information found in only one source is not automatically incorrect — report it as unique.
- Every statement retains its original source; never merge across sources without
  attribution.
- Missing information in one source but present in another is a coverage difference, not a
  contradiction.

# Examples

Input:

```yaml
extracted_facts:
  research_topic: "Spring Boot Virtual Threads"
  sources:
    - url: "https://docs.spring.io/..."
      facts: ["Virtual Threads require Java 21.", "Enabled via spring.threads.virtual.enabled."]
    - url: "https://docs.oracle.com/..."
      facts: ["Virtual threads were introduced in Java 21."]
```

Output:

```yaml
comparison_result:
  comparison_topic: "Spring Boot Virtual Threads"
  agreements:
    - statement: "Virtual Threads are tied to Java 21."
      supporting_sources: ["https://docs.spring.io/...", "https://docs.oracle.com/..."]
  differences: []
  unique_information:
    - statement: "Enabled via spring.threads.virtual.enabled."
      source: "https://docs.spring.io/..."
  coverage:
    - "Enablement property described only by official Spring documentation."
  possible_conflicts: []
```
