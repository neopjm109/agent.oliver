---
name: source-validation
description: Evaluate the credibility, authority, and quality of information sources, independently per source, without validating the factual accuracy of their content. Use before fact-checking in the research pipeline.
version: 1.0.0
category: research
tags:
  - research
  - source-credibility
  - validation
  - quality
model: inherit
invokes: []
inputs:
  - extracted_facts
  - options
outputs:
  - source_evaluation
---

# Goal

Assess the reliability of information sources collected during web research. This skill
evaluates the credibility of the source itself, not whether its content is true. It does
not perform fact checking.

# Inputs

```yaml
extracted_facts:   # research results incl. source URLs and metadata
  sources:
    - url: "https://spring.io"
    - url: "https://medium.com/@someone/..."
options:
  evaluation_criteria: []  # optional
```

# Output

```yaml
source_evaluation:
  sources:
    - url: <url>
      title: <title>
      credibility: High | Medium | Low
      authority: <Official Documentation | Government | Academic | Standards Organization |
                  Vendor | News | Technical Blog | Community | Personal Blog | Unknown>
      reasons: [<positive or negative indicator>, ...]
      recommended_usage: Primary Source | Supporting Source | Background Only | Avoid
  overall:
    high: <n>
    medium: <n>
    low: <n>
  warnings: [<e.g. only one authoritative source found>, ...]
```

# Workflow

## Step 1 — Receive sources
Receive the researched sources.

## Step 2 — Evaluate independently
Evaluate each source on its own: identify category, assess authority, transparency, and
recency if relevant; detect promotional or low-quality content.

## Step 3 — Assign and record
Assign a credibility level, record reasons, and set recommended usage.

## Step 4 — Return
Return the per-source evaluation, overall counts, and warnings.

# Rules

- Evaluate publisher, organization, author, references, publication quality, transparency,
  update history, and editorial standards. Do not evaluate factual correctness.
- Credibility levels: High (official docs, government, standards orgs, academic/peer-
  reviewed); Medium (major news, vendor docs, recognized technical blogs, established
  educational sites); Low (anonymous blogs, AI content farms, clickbait, SEO pages,
  unmoderated community content).
- Positive indicators: official domain, named org/author, references, publication date,
  update history, editorial process. Negative: anonymous ownership, excessive ads, no
  references, promotional language, AI spam, misleading titles.
- Evaluate every source independently; do not compare sources.
- Do not verify facts, decide which claim is correct, summarize, conclude, recommend
  products, or answer the user's question.

# Examples

Input:

```yaml
extracted_facts:
  sources:
    - url: "https://docs.spring.io/spring-boot/..."
    - url: "https://random-blog.example.com/spring-tips"
```

Output:

```yaml
source_evaluation:
  sources:
    - url: "https://docs.spring.io/spring-boot/..."
      title: "Spring Boot Reference"
      credibility: High
      authority: Official Documentation
      reasons: ["Official domain", "Maintained by vendor", "Versioned"]
      recommended_usage: Primary Source
    - url: "https://random-blog.example.com/spring-tips"
      title: "Spring Tips"
      credibility: Low
      authority: Personal Blog
      reasons: ["Anonymous author", "No references", "Excessive advertisements"]
      recommended_usage: Avoid
  overall: { high: 1, medium: 0, low: 1 }
  warnings: ["Only one authoritative source found."]
```
