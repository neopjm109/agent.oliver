---
name: localization-validator
description: Validate translated catalogs for missing keys, placeholder/ICU mismatches, untranslated entries, and format validity across locales, returning a pass/fail report. Final stage of the localization pipeline.
version: 1.0.0
category: localization
tags:
  - localization
  - validation
  - i18n
  - final-output
model: inherit
invokes: []
inputs:
  - formatted_catalogs
  - source_catalog
  - l10n_request
outputs:
  - validation_result
---

# Goal

Verify that every locale's catalog is complete, placeholder-safe, and syntactically valid
before use, returning a deterministic pass/fail verdict. This validates catalogs; it does not
translate or fix.

# Scope

- Key completeness (every source key present in every target locale)
- Placeholder parity (same placeholders/tokens as source, none added/dropped)
- Untranslated detection (target string identical to source where it should differ)
- Format validity (well-formed ICU/target message syntax)
- Plural-category correctness (an ICU `plural` entry uses exactly the CLDR plural categories
  valid for that target locale — not merely balanced braces)

Out of scope: translation quality/nuance, prose documents, runtime i18n code.

# Checks

1. Each target locale contains every translatable source key.
2. Each entry's placeholder set matches the source entry exactly.
3. No translatable entry is left equal to the source (excluding legitimate identical terms).
4. Messages parse as valid `format` (e.g. balanced ICU braces/plural forms).
5. Every ICU `plural` message uses exactly the CLDR plural categories for its target locale —
   `other` is always required, and no category outside the locale's CLDR set may appear. Common
   sets: `ko`/`ja`/`zh`/`vi`/`th` → {other}; `en`/`de`/`it`/`es`/`nl` → {one, other}; `fr`/`pt` →
   {one, many, other}; `ru`/`uk`/`pl` → {one, few, many, other}; `ar` → {zero, one, two, few, many,
   other}. A `plural` with an extra category (e.g. an `one` branch in `ko`) or missing `other` is a
   `plural-category-mismatch` — even when the ICU syntax is well-formed (check 4 passes). This is
   the check that syntactic validity alone does not guarantee.

# Pass/Fail Criteria

- **pass**: all checks succeed for all locales.
- **fail**: any missing key, placeholder mismatch, untranslated entry, invalid syntax, or a
  plural using categories that do not match the target locale's CLDR set.

# Output Schema

```yaml
validation_result:
  result: pass | fail
  issues:
    - { locale, key, issue: missing-key | placeholder-mismatch | untranslated | invalid-format | plural-category-mismatch }
  stats: { locales: <n>, keys: <n>, issues: <n> }
```

# Rules

- Report issues only; never translate or edit catalogs.
- Deterministic verdict: any single issue forces `fail`.
- Placeholder parity is exact — extra or missing tokens are always failures.
- Judge plural categories against the target locale's CLDR set, not the source's — e.g. an `en`
  source with `{one, other}` translated to `ko` must collapse to `{other}` only; keeping `one` is
  a `plural-category-mismatch`, not acceptable.
- Do not judge translation nuance/quality; only the checkable properties above.

# Examples

Input:

```yaml
formatted_catalogs: { en: { "cart.count": "{count} items" }, ja: { "cart.count": "{cnt}個" } }
source_catalog: { entries: [ { key: "cart.count", placeholders: ["{count}"], translatable: true } ] }
l10n_request: { target_locales: [en, ja] }
```

Output:

```yaml
validation_result:
  result: fail
  issues:
    - { locale: ja, key: "cart.count", issue: placeholder-mismatch }   # {cnt} ≠ {count}
  stats: { locales: 2, keys: 1, issues: 1 }
```

Plural-category (check 5) — well-formed ICU but wrong category set for the locale:

```yaml
formatted_catalogs:
  ko: { "cart.count": "{count, plural, one {#개} other {#개}}" }   # ko has no 'one' category
source_catalog: { entries: [ { key: "cart.count", placeholders: ["{count}"], translatable: true } ] }
l10n_request: { target_locales: [ko] }
```

```yaml
validation_result:
  result: fail
  issues:
    - { locale: ko, key: "cart.count", issue: plural-category-mismatch }   # 'one' not in ko CLDR set {other}
  stats: { locales: 1, keys: 1, issues: 1 }
```
