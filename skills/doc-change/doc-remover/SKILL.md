---
name: doc-remover
description: Remove a section from an existing prose document without leaving broken references — reverse-reference scan (TOC entries, internal cross-links, "see section X" mentions), cascade or block, fix every inbound reference, then re-run doc-style-checker. Refuses to remove a section other sections still depend on unless cascade is explicit.
version: 1.0.0
category: doc-change
tags:
  - doc-change
  - delete
  - cross-reference
  - documentation
model: inherit
invokes:
  - doc-outline-generator
  - doc-draft-generator
  - doc-style-checker
  - pricing-generator
  - proposal-drafter
  - proposal-validator
inputs:
  - doc_remove_contract
outputs:
  - doc_remove_result
---

# Goal

Remove a section that already exists — **without leaving dangling references**. In a
document, a deleted section orphans its TOC entry, internal links, and every "see section X"
mention. This skill maps the reference graph first, removes only what is safe, cascades or
re-points the rest, fixes the structure, and re-runs `doc-style-checker` so the result is a
deterministic pass.

# Inputs

```yaml
doc_remove_contract:
  doc_domain: docwriting     # docwriting | proposal
  doc_type: user-guide       # docwriting doc types, or proposal
  target: <section / heading to remove; or a proposal scope-item>
  cascade: false             # true = also remove dependent sections; false = block if live refs
  existing_document: <the current document with its sections>
  style_guide: default
```

# Output

```yaml
doc_remove_result:
  removed: [<sections removed>]
  repointed: [<cross-references redirected to a surviving section>]
  blocked_by: [<live references that prevented removal, if any>]
  references_updated: [<TOC entries / links fixed; or estimate/pricing lines dropped>]
  gate: pass | fail          # doc-style-checker (+ proposal-validator for proposals)
```

# Workflow

## Step 1 — Resolve the target
Pin the exact section(s) to remove, including any subsections nested under the target heading.

## Step 2 — Reverse-reference scan (the danger zone)
Find every reference to the target. For **docwriting** sections:
- the TOC / outline entry for the section
- internal links and anchors pointing at it
- "see section X" / "as described in X" prose mentions
- sections whose content depends on it (a step that assumes the removed section ran)

For a **proposal** scope-item the reference graph is: its effort estimate line, its pricing
breakdown line (and the affected total), and the proposal sections that describe it (scope,
schedule, pricing). Removing an item must drop all of these together.

## Step 3 — Classify each reference
For each: **cascade-delete** (a subsection that exists only under the target),
**re-point** (redirect a link to a surviving section that now covers it), or **block**
(a section still depends on the target's content). If any is `block` and `cascade` is false,
stop and report `blocked_by` — remove nothing.

## Step 4 — Remove and reconcile
- **docwriting** — delete the target, apply cascade/re-point decisions, invoke
  `doc-outline-generator` to rebuild the TOC, and `doc-draft-generator` to fix the prose of
  sections that referred to the removed one (e.g. drop or reword a "see refunds" sentence).
- **proposal** — drop the scope item plus its estimate and pricing lines, invoke
  `pricing-generator` to recompute the total, then `proposal-drafter` to re-assemble the
  affected scope/schedule/pricing sections.

## Step 5 — Gate
Re-run the domain gate: **docwriting** → `doc-style-checker` (no dangling cross-reference, no
orphan TOC entry, no unresolved "see X"). **proposal** → `proposal-validator` (no orphan
pricing line, total reconciles, coverage still honest) plus `doc-style-checker`. Report the
verdict; a `fail` blocks completion.

# Rules

- Never remove a section other sections still depend on unless `cascade: true` — otherwise
  report `blocked_by` and stop.
- Removing a section removes its TOC entry and fixes every inbound cross-link/mention in the
  same pass; a leftover "see section X" fails the style gate.
- Re-point links to a surviving section only when it genuinely covers the reference; never
  leave a link pointing at nothing.
- Deletion is not modification — "replace section X with Y" is a `doc-modifier` revision of Y
  plus a `doc-remover` delete of X, sequenced delete-last by the orchestrator.
- For a proposal, removing a scope item drops its estimate and pricing lines and recomputes
  the total in the same pass; a leftover orphan price fails `proposal-validator`.
- Every run ends with the domain gate (`doc-style-checker`; proposals also `proposal-validator`);
  complete only on `pass`.

# Examples

Input:

```yaml
doc_remove_contract:
  doc_type: user-guide
  target: "Legacy Coupon Redemption (retired)"
  cascade: true
  existing_document: <12-section payment guide; 2 sections link to coupons>
```

Output (abridged):

```
▶ reverse-ref scan
  ├ TOC entry "Legacy Coupon Redemption"            → remove
  ├ "Checkout" §: "see Coupon Redemption"           → re-point? no survivor → drop the sentence
  └ "FAQ" §: "How do I use a coupon?"               → cascade-delete (only about coupons)
▶ remove → 1 section + 1 FAQ entry dropped; TOC rebuilt (doc-outline-generator)
▶ prose  → doc-draft-generator removes the dangling "see" sentence in Checkout
▶ style  → doc-style-checker: pass (no dangling cross-reference)
── doc_remove_result
  removed: ["Legacy Coupon Redemption", "FAQ: coupons"]
  repointed: []
  blocked_by: []
  references_updated: ["TOC", "Checkout cross-link"]
  gate: pass
```
