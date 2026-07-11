---
name: news-search
description: Search recent news articles related to a topic and return article metadata only, without interpreting or summarizing the news. Use to discover recent-event sources for the research pipeline.
version: 1.0.0
category: research
tags:
  - research
  - search
  - news
  - source-discovery
model: inherit
invokes: []
inputs:
  - topic
  - options
outputs:
  - news_results
---

# Goal

Locate recent news articles relevant to a topic and return news metadata only. This skill
does not summarize, interpret, or predict.

# Inputs

```yaml
topic: "OpenAI"
options:
  date_range: last_30_days  # optional
  region: global            # optional
```

# Output

```yaml
news_results:
  search_query: <final query used>
  results:
    - title: <title>
      publisher: <publisher>
      url: <url>
      published_date: <date>
      snippet: <short snippet>
  notes: [<observation about the search itself>]
```

# Workflow

## Step 1 — Search recent news
Search recent news for the topic within the requested date range.

## Step 2 — Filter and dedupe
Prefer reputable publishers; remove duplicate stories reporting the same event.

## Step 3 — Return
Return article metadata. Stop.

# Rules

- Prefer Reuters, AP, Bloomberg, BBC, and official press releases.
- Avoid opinion articles, rumors, aggregator spam, and clickbait.
- Do not summarize news, interpret events, predict outcomes, or judge credibility beyond
  obvious quality filters.
- Notes contain only search observations (e.g. breaking news, multiple publishers, older
  coverage detected).

# Examples

Input:

```yaml
topic: "OpenAI new model release"
options: { date_range: last_30_days }
```

Output:

```yaml
news_results:
  search_query: "OpenAI new model release"
  results:
    - title: "OpenAI announces new model"
      publisher: "Reuters"
      url: "https://www.reuters.com/technology/..."
      published_date: 2026-06-25
      snippet: "OpenAI unveiled a new model on Thursday..."
  notes:
    - "Multiple publishers reporting the same event."
    - "One aggregator-spam duplicate removed."
```
