---
name: api-client-generator
description: Generate the type-safe HTTP client layer (fetch/axios wrapper, endpoint functions, request/response types) that isolates HTTP communication from UI and state.
version: 1.0.0
category: frontend
tags:
  - nextjs
  - api-client
  - axios
  - fetch
  - typescript
  - tanstack-query
model: inherit
invokes:
  - typescript-senior-programmer
inputs:
  - client_requirements
outputs:
  - api_client_code
---

# Goal

Generate the type-safe API client layer that isolates HTTP communication from UI
and state: a base client (fetch/axios wrapper), endpoint functions, request/response
types, and error normalization. This layer **owns the HTTP client** — it is consumed
by `data-generator` to build TanStack Query hooks. Delegates implementation to
`typescript-senior-programmer`.

Use `api-client-generator` for the HTTP/type layer; use `data-generator` instead for
the TanStack Query hooks that wrap it.

# Inputs

```yaml
client_requirements:
  resource: User
  base_url: /api
  endpoints:
    - GET /users
    - POST /users
    - DELETE /users/:id
  dto: { request: CreateUserRequest, response: UserResponse }
  auth: bearer-token
  error_strategy: normalized
```

# Output

```yaml
api_client_code:
  - base client (fetch/axios wrapper, centralized base URL, timeout)
  - endpoint functions (e.g. UserApiClient)
  - request/response types
  - normalized error handler + optional interceptors
```

# Workflow

## Step 1 — Map endpoints
Derive endpoint functions, HTTP verbs, paths, and status handling from requirements.

## Step 2 — Design DTOs
Define separate Request/Response types; never reuse backend entities directly.

## Step 3 — Design the base client
Configure a centralized base URL, timeout, auth token injection, and error normalization.

## Step 4 — Delegate implementation
Delegate the base client, endpoint functions, and types to `typescript-senior-programmer`.

# Rules

- Never mix API logic with UI or state; keep the layer framework-agnostic where possible.
- Always use typed DTOs; separate Request/Response models.
- Centralize base URL and timeout; inject auth via interceptor; normalize errors (never expose raw HTTP errors to UI).
- This skill owns the frontend HTTP client; the backend `integration-generator` (external HTTP transport) must not duplicate it.
- Do not generate TanStack Query hooks here — that is `data-generator`'s job.

# Examples

Input:

```yaml
client_requirements: { resource: User, endpoints: [GET /users, POST /users] }
```

Output (abridged):

```ts
export interface UserResponse { id: string; name: string; email: string; }
export interface CreateUserRequest { name: string; email: string; }

export const userApi = {
  list: () => http.get<UserResponse[]>("/users"),
  create: (body: CreateUserRequest) => http.post<UserResponse>("/users", body),
  remove: (id: string) => http.delete<void>(`/users/${id}`),
};
```
