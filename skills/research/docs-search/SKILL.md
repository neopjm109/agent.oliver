---
name: docs-search
description: Search official documentation and technical reference sites for relevant documentation pages (metadata only) without reading or summarizing them. Use to discover authoritative docs for the research pipeline.
version: 1.0.0
category: research
tags:
  - research
  - search
  - documentation
  - source-discovery
model: inherit
invokes: []
inputs:
  - query
  - options
outputs:
  - documentation_results
---

# Goal

Locate official documentation relevant to a request and return documentation pages only.
This skill does not read, summarize, or interpret documentation — those tasks belong to
downstream skills.

# Inputs

```yaml
query: "Spring Boot 3.5"   # product, framework, library, or API
options:
  version: "3.5"   # optional
```

# Output

```yaml
documentation_results:
  search_query: <final query used>
  results:
    - title: <title>
      url: <url>
      organization: <owning org/vendor>
      doc_version: <version if available>
      section: <section title if available>
  notes: [<observation about the search itself>]
```

# Workflow

## Step 1 — Identify technology
Identify the product, framework, library, or API and any version.

## Step 2 — Search official docs
Search official documentation sites. Prefer vendor documentation; ignore community
articles.

## Step 3 — Return
Return documentation URLs and metadata only. Stop.

# Rules

- Prefer, in order: official documentation, standards specifications, official API
  references.
- Avoid blogs, tutorials, Medium, Stack Overflow, AI-generated sites.
- Do not read pages, explain APIs, or summarize documentation.
- Notes contain only search observations (e.g. multiple versions detected, deprecated docs).

# Examples

Input:

```yaml
query: "Spring Boot 3.5 configuration properties"
options: { version: "3.5" }
```

Output:

```yaml
documentation_results:
  search_query: "Spring Boot 3.5 application properties reference"
  results:
    - title: "Common Application Properties"
      url: "https://docs.spring.io/spring-boot/3.5/appendix/application-properties/index.html"
      organization: "Spring / VMware"
      doc_version: "3.5"
      section: "Appendix — Application Properties"
  notes:
    - "Official documentation found."
    - "Older 3.4 version also present; excluded per requested version 3.5."
```
