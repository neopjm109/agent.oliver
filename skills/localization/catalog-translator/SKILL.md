---
name: catalog-translator
description: Translate a source-locale string catalog into target locales, preserving placeholders and applying a glossary, producing one catalog per locale. Translation stage of the localization pipeline.
version: 1.0.0
category: localization
tags:
  - localization
  - translation
  - catalog
model: inherit
invokes: []
inputs:
  - source_catalog
  - l10n_request
  - options
outputs:
  - translated_catalogs
---

# Goal

Translate each translatable entry into every target locale while keeping placeholders and
tokens intact and honoring glossary terms. This skill translates catalog strings; prose
documents are handled by `docwriting/doc-translator`.

# Inputs

```yaml
source_catalog: { locale: ko, entries: [ { key, text, placeholders, translatable } ] }
l10n_request: { target_locales: [en, ja] }
options:
  glossary: { "결제": "payment" }
```

# Output

```yaml
translated_catalogs:
  en: { <key>: <translated string with placeholders intact> }
  ja: { <key>: <translated string> }
  skipped: [ { key, reason } ]   # non-translatable entries copied verbatim
```

# Workflow

## Step 1 — Translate per locale
For each target locale, translate each `translatable` entry naturally and register-
appropriately.

## Step 2 — Preserve placeholders & glossary
Keep every placeholder/token exactly; apply glossary terms consistently.

## Step 3 — Copy non-translatables
Copy `translatable: false` entries verbatim; list them in `skipped`.

## Step 4 — Return
Return `translated_catalogs`. Stop. Plural/format specifics are handled downstream.

# Rules

- Preserve every placeholder and token exactly; never translate or reorder variable names.
- Apply the glossary consistently; otherwise pick one canonical term per locale and keep it.
- Do not add, drop, or merge keys; one source key → one entry per locale.
- Translate strings only; leave plural/format restructuring to `plural-format-handler`.

# Examples

Input:

```yaml
source_catalog: { locale: ko, entries: [ { key: "cart.count", text: "{count}개 상품", placeholders: ["{count}"], translatable: true } ] }
l10n_request: { target_locales: [en, ja] }
options: { glossary: {} }
```

Output:

```yaml
translated_catalogs:
  en: { "cart.count": "{count} items" }
  ja: { "cart.count": "{count}個の商品" }
  skipped: []
```
