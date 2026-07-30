---
name: code-refactorer
description: Improve the structure of existing code without changing its behavior — establish a test baseline, apply one behavior-preserving transformation (extract, rename, dedupe, replace deprecated API, split module), delegate the rewrite to the stack's senior-programmer, then prove behavior is unchanged. Use for cleanup and modernization, never for feature or bug changes.
version: 1.0.0
category: code-change
tags:
  - code-change
  - refactor
  - behavior-preserving
  - cleanup
model: inherit
invokes:
  - spring-senior-programmer
  - nestjs-senior-programmer
  - django-senior-programmer
  - typescript-senior-programmer
  - flutter-senior-programmer
  - validation-orchestrator
inputs:
  - refactor_contract
outputs:
  - refactor_result
---

# Goal

Improve the internal structure of existing code while keeping its observable behavior
**exactly the same**. Refactoring is code-only (prose and data are not refactored) and is
strictly separate from behavior changes — if the output should differ, that is
`code-modifier`, not this skill. The actual rewrite is delegated to the stack's
senior-programmer; this skill decides *what* transformation to apply and *proves* nothing
broke.

# Inputs

```yaml
refactor_contract:
  target: <file / class / method / module to restructure>
  kind: extract-method | rename | dedupe | replace-deprecated-api | split-module | inline
  goal: <what "better" means here, in one sentence>
  stack: spring        # spring | nestjs | django | nextjs | flutter
```

# Output

```yaml
refactor_result:
  transformation: <what was applied>
  public_api_stable: true | false   # false only when rename is the explicit goal
  behavior_baseline: <how behavior was pinned — existing tests / added characterization>
  verification: pass | fail
  files_touched: [...]
```

# Workflow

## Step 1 — Establish a behavior baseline
Find the tests that pin the target's current behavior. If coverage is missing, add
characterization tests that capture the *current* output first — you cannot refactor safely
without a net. Run them green before changing anything.

## Step 2 — Identify the transformation
Confirm the single `kind` of refactoring to apply and the exact scope. One transformation
type per pass — do not mix extract-method with a rename in the same call.

## Step 3 — Plan behavior-preserving change
Design the restructure so every input maps to the same output as before. For
`replace-deprecated-api`, map the old API's semantics onto the replacement precisely. For
`rename`, enumerate every reference that must move with it.

## Step 4 — Delegate the rewrite
Hand the contract to the stack's senior-programmer (`operation: refactor`) to produce the
restructured code, following the existing file's conventions. Stack → delegate: `spring →
spring-senior-programmer`, `nestjs → nestjs-senior-programmer`, `django →
django-senior-programmer`, `nextjs → typescript-senior-programmer` (also Tauri/desktop UI),
`flutter → flutter-senior-programmer`. Deprecated-API replacements are stack-specific
(e.g. Spring `WebSecurityConfigurerAdapter`, NestJS legacy decorators, Django
`url()`→`path()`, React class→function components, Flutter deprecated widgets).

## Step 5 — Prove behavior unchanged
Run the baseline tests again — they must pass without modification (except pure renames,
where references update but assertions stay semantically identical). Any test that needs a
*logic* change means behavior changed → the work is out of scope and must be rejected.

## Step 6 — Validate (gate)
Invoke `validation-orchestrator` to confirm the refactor conforms and all tests pass. This is
the deterministic gate — symmetric with data/doc/spec-change. Report the verdict; a `fail`
blocks completion.

# Rules

- No behavior change, ever. Same inputs must produce same outputs. If they wouldn't, this
  is the wrong skill — route to `code-modifier`.
- No new features, no bug fixes bundled in. Structure only.
- A test baseline must exist before refactoring; if absent, create characterization tests
  first.
- Baseline tests must pass unchanged afterward. Needing to edit an assertion's expected
  value is a red flag that behavior moved.
- Public API stays stable unless `kind: rename` is the explicit goal — then update every
  reference (callers, tests, DI, routes) in the same pass.
- One transformation kind per pass; keep diffs reviewable.

# Examples

Input:

```yaml
refactor_contract:
  target: OrderService.placeOrder
  kind: extract-method
  goal: "Pull the discount calculation into a private method to reduce method length."
  stack: spring
```

Output (abridged):

```java
// behavior identical; discount logic extracted
public OrderResponse placeOrder(PlaceOrderRequest request) {
    Money total = calculateTotal(request);      // <- extracted
    Order order = orderRepository.save(Order.from(request, total));
    return OrderResponse.from(order);
}

private Money calculateTotal(PlaceOrderRequest request) {
    Money subtotal = pricing.subtotal(request);
    return subtotal.minus(discountPolicy.apply(subtotal, request.customerId()));
}
```

```
refactor_result:
  transformation: extract-method (calculateTotal)
  public_api_stable: true
  behavior_baseline: OrderServiceTest (existing, 6 cases)
  verification: pass  # all 6 green, unchanged
  files_touched: [OrderService.java]
```
