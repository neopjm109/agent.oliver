---
name: web-search
description: Search the web and return relevant sources (metadata only) without summarizing, reading, or interpreting content. Use to discover general-knowledge sources for the research pipeline.
version: 1.0.0
category: research
tags:
  - research
  - search
  - web
  - source-discovery
model: inherit
invokes: []
inputs:
  - search_query
  - options
outputs:
  - search_results
---

# Goal

Discover web sources relevant to a query and return their metadata. This skill only
discovers sources — it does not read entire pages, summarize, analyze, compare, verify, or
answer the user's question. Those tasks belong to downstream skills.

# Inputs

```yaml
search_query: "Spring Boot Virtual Threads"
options:
  language: en          # optional
  region: global        # optional
  time_range: any       # optional
  trusted_domains: []   # optional
  num_results: 10       # optional
```

# Output

```yaml
search_results:
  search_query: <final query used>
  results:
    - title: <title>
      url: <url>
      source: <domain/publisher>
      published_date: <date if available>
      snippet: <short engine-provided snippet>
  notes: [<observation about the search itself>]
```

# Workflow

## Step 1 — Understand intent
Understand the search intent; refine the query only if necessary, keeping the original
intent unchanged.

## Step 2 — Search
Execute one or more web searches. Generate a small number of alternative queries only if
the original is ambiguous.

## Step 3 — Collect and dedupe
Collect the most relevant results. Remove duplicate URLs; when multiple URLs reference the
same content, keep the original or official source and drop mirrors.

## Step 4 — Return
Return collected search metadata and notes. Stop.

# Rules

- Return only search metadata: title, URL, source, date, snippet, notes.
- Do not read entire pages, summarize, compare, verify facts, or answer the question.
- Source priority (prefer, in order): official documentation, official organization sites,
  government sites, academic papers, standards organizations, vendor docs, well-known
  technical publications, reputable news organizations.
- Avoid SEO content farms, AI-generated sites, clickbait, low-quality blogs, duplicates.
- Notes contain only observations about the search (e.g. few results, outdated, duplicates
  detected). No summaries, opinions, recommendations, speculation, or invented data.

# Examples

Input:

```yaml
search_query: "Spring Boot Virtual Threads"
options: { num_results: 3 }
```

Output:

```yaml
search_results:
  search_query: "Spring Boot Virtual Threads Java 21"
  results:
    - title: "Virtual Threads :: Spring Boot"
      url: "https://docs.spring.io/spring-boot/reference/features/virtual-threads.html"
      source: docs.spring.io
      published_date: 2024-11-01
      snippet: "Enable virtual threads by setting spring.threads.virtual.enabled to true..."
    - title: "Virtual Threads (Project Loom) — JDK 21"
      url: "https://docs.oracle.com/en/java/javase/21/core/virtual-threads.html"
      source: docs.oracle.com
      published_date: 2023-09-19
      snippet: "Virtual threads are lightweight threads introduced in Java 21..."
  notes:
    - "Official documentation found for both Spring Boot and the JDK."
    - "One duplicate mirror of the Spring page removed."
```
