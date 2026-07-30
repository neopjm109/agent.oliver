---
name: localization-orchestrator
description: Coordinate the end-to-end localization pipeline that extracts translatable strings from a source, translates them into target locales with plural/format handling, and validates the resulting catalogs. Use for product string/message localization, not prose documents. Entrypoint of the localization domain.
version: 1.0.0
category: localization
tags:
  - localization
  - orchestrator
  - i18n
  - translation
  - pipeline
  - entrypoint
model: inherit
invokes:
  - docs-analyze-xlsx
  - docs-analyze-markdown
  - string-extractor
  - catalog-translator
  - plural-format-handler
  - localization-validator
inputs:
  - l10n_request
  - source
  - options
outputs:
  - localization_bundle
---

# Goal

Produce validated translation catalogs by orchestrating specialized localization skills.
This skill **never translates directly** — it extracts strings, delegates translation and
plural/format handling, validates the catalogs, and returns them. It localizes product
strings/messages; for translating a finished prose document use `docwriting/doc-translator`.

# Inputs

```yaml
l10n_request:
  target_locales: [en, ja, zh-CN]
  source_locale: ko
source:
  kind: i18n-catalog          # i18n-catalog | source-code | string-list
  content: <messages.ko.json, or code paths, or inline strings>
options:
  format: icu                 # icu | i18next | gettext
  glossary: { "결제": "payment" }   # optional fixed terms
```

# Output

```yaml
localization_bundle:
  catalogs: { <locale>: { <key>: <translated string> } }
  validation: <from localization-validator>
  untranslated: [ { locale, key, reason } ]   # anything left untranslated
```

# Workflow

## Step 1 — Extract strings
If `source` is a document, invoke the matching `docs-analyze-*` skill. Invoke
`string-extractor` to produce a normalized key→source-string catalog, isolating placeholders
and non-translatable tokens.

## Step 2 — Translate
Invoke `catalog-translator` to translate the source catalog into each target locale, applying
the glossary.

## Step 3 — Handle plurals & formats
Invoke `plural-format-handler` to produce locale-correct plural categories and number/date
formats per the message `format`.

## Step 4 — Validate
Invoke `localization-validator` to check for missing keys, placeholder/ICU mismatches, and
untranslated entries.

## Step 5 — Return
Return `localization_bundle`. The pipeline ends here.

# Rules

- This skill only coordinates. Delegate every stage; never extract, translate, or validate
  directly.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Boundary: this localizes key-value string catalogs (with placeholders/plurals). Use
  `docwriting/doc-translator` for prose documents, and `web/i18n-generator` for the
  runtime i18n wiring/code — this domain produces the translated catalogs, not code.
- Preserve placeholders and markup exactly across all locales; never translate variable
  names or tokens.
- Error handling: if a locale fails, continue with the others and list failures in
  `untranslated`; if extraction fails, stop and report.

# Examples

Input:

```yaml
l10n_request: { target_locales: [en, ja], source_locale: ko }
source: { kind: i18n-catalog, content: { "cart.count": "{count}개 상품" } }
options: { format: icu, glossary: {} }
```

Output (abridged):

```
✔ extract  → 1 key, 1 placeholder ({count})
✔ translate→ en, ja
✔ plurals  → ICU plural forms per locale
✔ validate → pass (placeholders intact, 0 missing keys)

en: { "cart.count": "{count, plural, one {# item} other {# items}}" }
ja: { "cart.count": "{count}個の商品" }
```
