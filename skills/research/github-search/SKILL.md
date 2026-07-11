---
name: github-search
description: Search GitHub repositories and project metadata (metadata only) without analyzing repository contents or source code. Use to discover open-source projects for the research pipeline.
version: 1.0.0
category: research
tags:
  - research
  - search
  - github
  - open-source
  - source-discovery
model: inherit
invokes: []
inputs:
  - query
  - options
outputs:
  - repository_results
---

# Goal

Locate relevant GitHub repositories and return repository metadata only. This skill does
not analyze source code, read READMEs, or explain implementation.

# Inputs

```yaml
query: "Spring AI"   # repository name, library, framework, or organization
options: {}
```

# Output

```yaml
repository_results:
  search_query: <final query used>
  results:
    - repository: <repo name>
      organization: <owner org>
      url: <url>
      description: <repo description>
      stars: <count if available>
      last_updated: <date if available>
  notes: [<observation about the search itself>]
```

# Workflow

## Step 1 — Search GitHub
Search GitHub for the query.

## Step 2 — Prefer originals
Prefer official/organization repositories; ignore forks when the original exists.

## Step 3 — Collect and return
Collect metadata and return the repository list. Stop.

# Rules

- Prefer official repositories, organization repositories, and verified maintainers.
- Avoid personal forks, mirrors, archived repositories, and demo repositories unless
  explicitly requested.
- Do not analyze source code, read README contents, explain implementation, or draw
  conclusions.

# Examples

Input:

```yaml
query: "Spring AI"
```

Output:

```yaml
repository_results:
  search_query: "spring-ai"
  results:
    - repository: "spring-ai"
      organization: "spring-projects"
      url: "https://github.com/spring-projects/spring-ai"
      description: "An Application Framework for AI Engineering."
      stars: 4200
      last_updated: 2026-06-20
  notes:
    - "Official repository found."
    - "Multiple personal forks detected and excluded."
```
