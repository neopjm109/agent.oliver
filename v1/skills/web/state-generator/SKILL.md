---
name: state-generator
description: Generate global/UI client state (Zustand stores, selectors, persistence) for state that is not server data, keeping it separate from the query cache.
version: 1.0.0
category: frontend
tags:
  - state
  - zustand
  - frontend
model: inherit
invokes:
  - typescript-senior-programmer
inputs:
  - state_requirements
outputs:
  - state_code
---

# Goal

Generate global and UI client-state management using Zustand: store definitions,
actions, selectors, and optional persistence. This layer is for state that is **not**
server data. Delegates implementation to `typescript-senior-programmer`.

Use `state-generator` for global/UI client state; use `data-generator` instead for
server state (TanStack Query cache).

# Inputs

```yaml
state_requirements:
  name: useAuthStore
  state_type: global   # global | ui
  shape: { user: User | null, theme: "light" | "dark" }
  actions: [setUser, clearUser, toggleTheme]
  persistence: localStorage   # optional
  devtools: true              # optional
```

# Output

```yaml
state_code:
  - Zustand store + state interface
  - actions + selectors
  - persistence config (if needed) + devtools (optional)
```

# Workflow

## Step 1 — Classify the state
Confirm the state is genuinely client/UI state (not server data that belongs in TanStack Query).

## Step 2 — Design the store
Define the state shape, actions, and selectors; decide persistence and devtools.

## Step 3 — Delegate implementation
Delegate the store to `typescript-senior-programmer` with the shape/actions contract.

## Step 4 — Validate
Confirm selectors minimize re-renders and no server state is duplicated.

# Rules

- Keep global state minimal; prefer local `useState`/`useReducer` when possible.
- Never mix server state and UI state; do not call APIs directly.
- Use selectors to avoid unnecessary re-renders.
- Persist to localStorage only when necessary; avoid over-persisting.
- Store names use the `use…Store` convention (useAuthStore, useCartStore).

# Examples

Input:

```yaml
state_requirements: { name: useAuthStore, shape: { user }, actions: [setUser, clearUser] }
```

Output (abridged):

```ts
interface AuthState {
  user: User | null;
  setUser: (user: User) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}));
```
