---
name: code-modifier
description: Apply a behavior-changing edit to existing code with the smallest correct diff — locate the change site, scan impact (callers, tests, DI, routes), plan a minimal-invasive edit, delegate the writing to the stack's senior-programmer, then propagate to affected references. Use for bug fixes and requirement changes on code that already exists.
version: 1.0.0
category: code-change
tags:
  - code-change
  - modify
  - bugfix
  - minimal-diff
model: inherit
invokes:
  - spring-senior-programmer
  - nestjs-senior-programmer
  - django-senior-programmer
  - typescript-senior-programmer
  - flutter-senior-programmer
  - validation-orchestrator
inputs:
  - modify_contract
outputs:
  - modification_result
---

# Goal

Change the observable behavior of code that **already exists**, using the smallest edit
that satisfies the requirement. This skill reads before it writes, preserves everything
not in scope (signatures, style, unrelated logic), and delegates the actual code writing to
the stack's senior-programmer. It is *not* a generator: it never regenerates a whole file
and never introduces unrelated cleanups (that is `code-refactorer`'s job).

# Inputs

```yaml
modify_contract:
  target: <file / class / method / symbol to change>
  change: <the required behavior change, in one sentence>
  stack: spring        # spring | nestjs | django | nextjs | flutter
  constraints: { preserve_public_api: true }   # optional
```

# Output

```yaml
modification_result:
  edited: [<files with the smallest diff applied>]
  propagated: [<callers / tests / config updated to match>]
  unchanged_public_api: true | false
  verification: pass | fail | not-run
  notes: <anything the caller should know — risk, follow-up>
```

# Workflow

## Step 1 — Locate (never edit blind)
Read the target file(s) and the exact symbol to change. Build a change-site map: the lines
that must change and the lines that must stay. If the target hint is imprecise, search the
codebase to pin the real location before touching anything.

## Step 2 — Impact scan
Find everything the change can break: callers of the symbol, tests that assert its behavior,
DI wiring, routes/mappings, config keys, and serialized contracts (DTOs/API responses).
This dependency set defines the true scope of the edit.

## Step 3 — Plan the minimal edit
Design the smallest diff that satisfies `change`. Preserve method signatures, public API,
naming, and surrounding style unless the change itself requires altering them. Do not
"improve" nearby code — out-of-scope edits are rejected.

## Step 4 — Delegate the write
Hand a scoped contract to the stack's senior-programmer (`operation: modify`, target,
required change, conventions) so it produces the edited code body. Reuse the existing file's
conventions rather than the delegate's defaults. Stack → delegate: `spring →
spring-senior-programmer`, `nestjs → nestjs-senior-programmer`, `django →
django-senior-programmer`, `nextjs → typescript-senior-programmer` (also Tauri/desktop UI),
`flutter → flutter-senior-programmer`.

## Step 5 — Propagate
Update the references found in Step 2 that the change actually affects: adjust callers,
add/adjust tests to cover the new behavior, update config/DTOs if the contract changed.

## Step 6 — Self-check
Confirm it compiles, the new behavior is covered by a test, no unrelated lines changed, and
the public API is intact (unless changing it was the point). Report the diff scope.

## Step 7 — Validate (gate)
Invoke `validation-orchestrator` on the changed code to confirm conformance (architecture,
backend/frontend, test, security). This is the deterministic gate — symmetric with
data/doc/spec-change. Report the verdict; a `fail` blocks completion.

# Rules

- Read the existing code first; never edit a symbol you have not located and read.
- Smallest correct diff — change only what the requirement needs.
- No drive-by refactoring, renaming, or reformatting outside the change site. Route
  structural cleanup to `code-refactorer`.
- Preserve public contracts (signatures, endpoints, DTO shapes) unless the change requires
  altering them; if it does, propagate to every caller and note it.
- Every behavior change must be covered by an added or updated test.
- Match the target file's existing style and conventions, not the delegate's defaults.
- If the change cannot be made without a broader restructure, stop and report — do not
  silently expand scope.

# Examples

Input:

```yaml
modify_contract:
  target: OrderService.placeOrder
  change: "Reject orders whose total exceeds the customer's credit limit."
  stack: spring
  constraints: { preserve_public_api: true }
```

Output (abridged):

```java
// OrderService.java — minimal diff, signature unchanged
@Transactional
public OrderResponse placeOrder(PlaceOrderRequest request) {
    Customer customer = customerRepository.getById(request.customerId());
    Money total = pricing.total(request);
+   if (total.isGreaterThan(customer.creditLimit())) {
+       throw new CreditLimitExceededException(request.customerId(), total);
+   }
    Order order = orderRepository.save(Order.from(request, total));
    return OrderResponse.from(order);
}
```

```
modification_result:
  edited: [OrderService.java, CreditLimitExceededException.java (new)]
  propagated: [OrderServiceTest (+2 cases), GlobalExceptionHandler (409 mapping)]
  unchanged_public_api: true
  verification: pass
  notes: "creditLimit already on Customer; no schema change needed."
```
