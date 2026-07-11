---
name: auth-generator
description: Generate authentication and authorization features for Next.js — login flow, session/token management, route guards — for JWT, session, or OAuth strategies.
version: 1.0.0
category: frontend
tags:
  - auth
  - nextjs
  - security
model: inherit
invokes:
  - typescript-senior-programmer
inputs:
  - auth_requirements
outputs:
  - auth_code
---

# Goal

Generate authentication flows and authorization guards for a Next.js application:
login page, auth hook, auth context/store, route guards, session utilities, and
token management. Delegates implementation to `typescript-senior-programmer`.

# Inputs

```yaml
auth_requirements:
  method: jwt          # jwt | session | oauth
  # jwt    -> access/refresh tokens, token storage + refresh rotation
  # session-> httpOnly server session cookie, CSRF handling
  # oauth  -> provider(s) + callback route + PKCE (e.g. google, github)
  oauth_providers: [google, github]   # only when method: oauth
  login_flow: email-password
  roles: [admin, user]
  protected_routes: ["/dashboard", "/admin"]
```

# Output

```yaml
auth_code:
  - login page + auth hook (useAuth)
  - auth context / store
  - route guard (middleware or HOC)
  - session utilities + token management
```

# Workflow

## Step 1 — Analyze strategy
Select the auth strategy and enumerate its concerns:
- **JWT**: access/refresh token storage, refresh rotation, attach token to requests.
- **Session**: httpOnly cookie session, server-side validation, CSRF protection.
- **OAuth**: provider config, callback route, PKCE, token exchange.

## Step 2 — Design flow and authorization
Design the login flow and role-based route guards; keep authentication separate from authorization.

## Step 3 — Delegate implementation
Delegate the pages, hooks, guards, and utilities to `typescript-senior-programmer`.

## Step 4 — Validate
Confirm no secrets are exposed and token/session handling is centralized and secure.

# Rules

- Never expose secrets to the client; keep secrets server-side.
- Separate authentication (who you are) from authorization (what you can do).
- Centralize token/session handling; JWT refresh must be transparent to callers.
- For OAuth use PKCE and a dedicated callback route; for sessions use httpOnly cookies + CSRF.

# Examples

Input:

```yaml
auth_requirements: { method: jwt, roles: [admin, user], protected_routes: ["/dashboard"] }
```

Output (abridged):

```tsx
// features/auth/hooks/use-auth.ts
export function useAuth() {
  const { user } = useAuthStore();
  const login = async (creds: Credentials) => {
    const { accessToken, refreshToken } = await authApi.login(creds);
    tokenStore.set(accessToken, refreshToken);
  };
  return { user, isAuthenticated: !!user, login, logout: authApi.logout };
}
```
