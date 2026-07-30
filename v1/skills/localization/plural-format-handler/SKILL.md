---
name: plural-format-handler
description: Apply locale-correct plural categories and number/date/currency formats to translated catalog entries, producing ICU (or target-format) messages. Runs after translation.
version: 1.0.0
category: localization
tags:
  - localization
  - plural
  - icu
  - formatting
model: inherit
invokes: []
inputs:
  - translated_catalogs
  - source_catalog
  - options
outputs:
  - formatted_catalogs
---

# Goal

Make translated messages grammatically and numerically correct per locale by adding the
right plural categories and number/date/currency formatting. This skill restructures message
form; it does not retranslate meaning.

# Inputs

```yaml
translated_catalogs: { en: {...}, ja: {...} }
source_catalog: { entries: [ { key, placeholders } ] }
options:
  format: icu   # icu | i18next | gettext
```

# Output

```yaml
formatted_catalogs:
  en: { <key>: <message with correct plural/format> }
  ja: { <key>: <message> }
  applied: [ { locale, key, change } ]
```

# Workflow

## Step 1 — Identify count/number placeholders
Find entries whose placeholders drive plurality or number/date formatting.

## Step 2 — Apply locale plural categories
Add the locale's CLDR plural categories (e.g. en: one/other; ja: other; ar: six forms) in
the target `format`.

## Step 3 — Apply number/date/currency formats
Set locale-appropriate formatting tokens for numbers, dates, and currency.

## Step 4 — Return
Return `formatted_catalogs` with an `applied` log. Stop.

# Rules

- Use correct CLDR plural categories per locale; never assume English's one/other everywhere.
- Preserve placeholders and meaning; only change message structure/format, not the wording.
- Emit valid syntax for the target `format` (e.g. well-formed ICU messageformat).
- Leave entries without count/number placeholders unchanged.

# Examples

Input:

```yaml
translated_catalogs: { en: { "cart.count": "{count} items" } }
source_catalog: { entries: [ { key: "cart.count", placeholders: ["{count}"] } ] }
options: { format: icu }
```

Output:

```yaml
formatted_catalogs:
  en: { "cart.count": "{count, plural, one {# item} other {# items}}" }
  applied: [ { locale: en, key: "cart.count", change: "added ICU plural (one/other)" } ]
```
