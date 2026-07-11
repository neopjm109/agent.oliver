---
name: string-extractor
description: Extract translatable strings from a source (i18n catalog, source code, or string list) into a normalized key→string catalog, isolating placeholders and non-translatable tokens. First stage of the localization pipeline.
version: 1.0.0
category: localization
tags:
  - localization
  - extraction
  - i18n
  - strings
model: inherit
invokes: []
inputs:
  - source
  - options
outputs:
  - source_catalog
---

# Goal

Produce a clean source-locale catalog of translatable strings, each with a stable key and
its placeholders/tokens identified so translation never corrupts them. This skill extracts
only; it does not translate.

# Inputs

```yaml
source:
  kind: i18n-catalog | source-code | string-list
  content: <catalog, code, or list>
options:
  format: icu   # informs placeholder syntax
```

# Output

```yaml
source_catalog:
  locale: <source locale>
  entries:
    - key: <stable key>
      text: <source string>
      placeholders: [<{count}, %s, {name}>, ...]
      translatable: true | false   # false for pure tokens/urls/ids
```

# Workflow

## Step 1 — Collect strings
Pull user-facing strings from the source. For code, find i18n call sites / annotated
strings; for catalogs, read keys directly.

## Step 2 — Isolate placeholders
Detect placeholders/interpolation and ICU/gettext tokens; record them per entry.

## Step 3 — Mark non-translatables
Flag entries that are pure tokens, URLs, or identifiers as `translatable: false`.

## Step 4 — Return
Return `source_catalog`. Stop.

# Rules

- Extract faithfully; never alter source strings or invent keys.
- Every placeholder must be captured so downstream stages preserve it.
- Do not translate; only identify and structure.
- Stable keys: reuse existing catalog keys; for code, derive deterministic keys.

# Examples

Input:

```yaml
source: { kind: i18n-catalog, content: { "cart.count": "{count}개 상품", "app.url": "https://x.io" } }
options: { format: icu }
```

Output:

```yaml
source_catalog:
  locale: ko
  entries:
    - { key: "cart.count", text: "{count}개 상품", placeholders: ["{count}"], translatable: true }
    - { key: "app.url", text: "https://x.io", placeholders: [], translatable: false }
```
