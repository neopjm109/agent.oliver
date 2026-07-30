---
name: hook-generator
description: Generate reusable custom React hooks that orchestrate existing data and state layers plus UI logic — not the data or state layers themselves.
version: 1.0.0
category: frontend
tags:
  - react
  - hooks
  - nextjs
model: inherit
invokes:
  - typescript-senior-programmer
inputs:
  - hook_requirements
outputs:
  - hook_code
---

# Goal

Generate reusable custom hooks that act as the orchestration bridge between the
data layer, the state layer, and UI components. This covers custom hooks **not**
already produced by the data or state generators. Delegates implementation to
`typescript-senior-programmer`.

Use `hook-generator` for orchestration/other custom hooks; use `data-generator`
for TanStack Query hooks and `state-generator` for Zustand stores instead.

# Inputs

```yaml
hook_requirements:
  name: useUserManagement
  feature: user
  data_hooks: [useUsers, useDeleteUser]     # from data-generator
  state_stores: [useAuthStore]              # from state-generator
  ui_logic: [selection, confirm-dialog-toggle]
  side_effects: [toast-on-error]
```

# Output

```yaml
hook_code:
  - custom hook composing data + state
  - loading/error state exposure
  - memoized selectors + action handlers
```

# Workflow

## Step 1 — Analyze orchestration
Identify which data hooks, state stores, and UI concerns the hook composes.

## Step 2 — Design the contract
Define the hook's return shape (data, states, actions) and side effects.

## Step 3 — Delegate implementation
Delegate the hook to `typescript-senior-programmer` with the composition contract.

## Step 4 — Validate
Confirm the hook is pure orchestration, memoized, and free of embedded UI/API.

# Rules

- Hooks orchestrate only; no embedded UI components.
- Do not implement API calls (use `api-client-generator` via `data-generator`).
- Do not implement state logic (use `state-generator`).
- Preferred flow: API client → TanStack Query / mutation → hook → UI.
- Memoize; keep hooks pure; use the `useXxx` naming convention.

# Examples

Input:

```yaml
hook_requirements: { name: useUserManagement, data_hooks: [useUsers, useDeleteUser] }
```

Output (abridged):

```ts
export function useUserManagement() {
  const { data: users, isLoading } = useUsers();
  const { mutateAsync: deleteUser } = useDeleteUser();
  const [selected, setSelected] = useState<string | null>(null);

  const remove = useCallback(async (id: string) => {
    await deleteUser(id);
    setSelected(null);
  }, [deleteUser]);

  return { users, isLoading, selected, setSelected, remove };
}
```
