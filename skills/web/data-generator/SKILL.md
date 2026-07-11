---
name: data-generator
description: Generate the TanStack Query data layer (query + mutation hooks, query keys, schemas) on top of the HTTP client, separating data access and caching from UI.
version: 1.0.0
category: frontend
tags:
  - nextjs
  - react
  - typescript
  - tanstack-query
  - data
  - hooks
model: inherit
invokes:
  - typescript-senior-programmer
inputs:
  - data_requirements
outputs:
  - data_layer_code
---

# Goal

Generate a production-ready TanStack Query data layer for a feature: query hooks
(reads), mutation hooks (writes), centralized query keys, and optional Zod schemas.
It consumes the HTTP client produced by `api-client-generator`. Delegates
implementation to `typescript-senior-programmer`.

Use `data-generator` for TanStack Query hooks; use `api-client-generator` instead for
the underlying HTTP client and request/response types.

# Inputs

```yaml
data_requirements:
  feature: User
  endpoints: [GET /users, GET /users/{id}, POST /users, PUT /users/{id}, DELETE /users/{id}]
  cache_strategy: invalidate-on-mutation
  validation: zod   # optional
```

# Output

```yaml
data_layer_code:
  - query hooks (useUsers, useUser)
  - mutation hooks (useCreateUser, useUpdateUser, useDeleteUser)
  - centralized query keys
  - Zod schemas (if required) + barrel export
```

# Workflow

## Step 1 — Analyze operations
Identify CRUD operations and map each to a query or mutation.

## Step 2 — Design query keys and caching
Define centralized query keys and the invalidation strategy after mutations.

## Step 3 — Design hooks
Design query/mutation hooks that wrap the `api-client-generator` endpoint functions.

## Step 4 — Delegate implementation
Delegate the hooks, query keys, and schemas to `typescript-senior-programmer`.

# Rules

- Use Query for reads, Mutation for writes; invalidate affected queries after mutations.
- Centralize query keys; do not scatter cache config.
- Do not implement HTTP calls here — import from `api-client-generator`.
- Do not manage global/UI state here — that is `state-generator`'s job.
- Strict typing; reuse the client's request/response types.

# Examples

Input:

```yaml
data_requirements: { feature: User, endpoints: [GET /users, POST /users] }
```

Output (abridged):

```ts
export const userKeys = { all: ["users"] as const };

export function useUsers() {
  return useQuery({ queryKey: userKeys.all, queryFn: userApi.list });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: userApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  });
}
```
