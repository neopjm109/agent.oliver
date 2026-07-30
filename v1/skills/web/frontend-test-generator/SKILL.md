---
name: frontend-test-generator
description: Generate automated frontend tests (components, hooks, pages, logic) using Vitest and React Testing Library, focusing on behavior over implementation details.
version: 1.0.0
category: frontend
tags:
  - testing
  - react
  - nextjs
  - vitest
  - react-testing-library
model: inherit
invokes:
  - typescript-senior-programmer
inputs:
  - test_requirements
outputs:
  - test_code
---

# Goal

Generate maintainable automated tests for existing frontend code using **Vitest**
as the test runner and **React Testing Library** for component/hook testing.
Delegates implementation to `typescript-senior-programmer`.

# Inputs

```yaml
test_requirements:
  target_files: [features/user/components/user-table.tsx, features/user/hooks/use-users.ts]
  test_scope: [unit, component, hook, integration]
  expected_behavior:
    - renders rows for provided users
    - calls onDelete when delete action clicked
    - useUsers returns loading then data
  mocking: [msw]   # optional: mock server for data hooks
```

# Output

```yaml
test_code:
  - unit tests (Vitest)
  - component tests (React Testing Library)
  - hook tests (renderHook)
  - integration tests (when applicable) + mock utilities
```

# Workflow

## Step 1 — Analyze the target
Read the target implementation and identify observable behaviors to test.

## Step 2 — Enumerate scenarios
List success and failure scenarios; decide mocking (MSW for network, mocks for stores).

## Step 3 — Delegate implementation
Delegate the Vitest + React Testing Library test files to `typescript-senior-programmer`.

## Step 4 — Verify completeness
Confirm coverage of success/failure paths and deterministic, non-duplicated tests.

# Rules

- Use Vitest as the runner and React Testing Library for rendering/queries.
- Query by role/label (accessible queries); test behavior, not implementation details.
- Keep tests deterministic; mock network with MSW, not brittle fetch stubs.
- Cover both success and failure scenarios; avoid duplicated cases.

# Examples

Input:

```yaml
test_requirements: { target_files: [user-table.tsx], expected_behavior: [renders rows, calls onDelete] }
```

Output (abridged):

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { UserTable } from "./user-table";

describe("UserTable", () => {
  it("calls onDelete when the delete action is clicked", () => {
    const onDelete = vi.fn();
    render(<UserTable data={[{ id: "1", name: "Ann", email: "a@x.com", status: "active" }]} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith("1");
  });
});
```
