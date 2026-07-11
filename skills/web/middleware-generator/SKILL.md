---
name: middleware-generator
description: Generate Next.js edge middleware — request interception for auth checks, redirects, locale routing, and header injection with matcher config.
version: 1.0.0
category: frontend
tags:
  - nextjs
  - middleware
  - edge
  - routing
  - auth
model: inherit
invokes:
  - typescript-senior-programmer
inputs:
  - middleware_requirements
outputs:
  - middleware_code
---

# Goal

Generate a Next.js `middleware.ts` that intercepts requests at the edge: authentication/route
guarding, redirects/rewrites, locale routing, and request/response header injection, with a
correct `matcher` config. This skill owns **edge-level request interception**; client session
state and guards are owned by `auth-generator`, and translations by `i18n-generator` (this only
handles locale *routing*).

# Inputs

```yaml
middleware_requirements:
  auth:
    protected: [/dashboard, /orders]
    public: [/login, /]
    redirect_unauthenticated: /login
  locale:
    enabled: true
    locales: [en, ko]
    default: en
  headers:
    inject: { x-request-id: uuid }
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
```

# Output

```yaml
middleware_code:
  - middleware.ts (auth gate, redirects, locale routing, header injection)
  - matcher config
```

# Workflow

## Step 1 — Define matching scope
Set the `matcher` to exclude static assets and public files; enumerate protected vs public routes.

## Step 2 — Compose interception logic
Compose auth gating (redirect unauthenticated), locale detection/rewrite, and header injection
in order, returning early on redirects.

## Step 3 — Delegate implementation
Delegate the `middleware.ts` to `typescript-senior-programmer`.

# Rules

- Own edge interception only; delegate client session/guards to `auth-generator` and translations to `i18n-generator` (middleware does locale routing, not message loading).
- Keep middleware lightweight and edge-safe — no Node-only APIs, no heavy work, no DB calls.
- Read auth state from cookies/headers only; never decode long-lived secrets at the edge beyond token presence/verification.
- Always scope the `matcher` to exclude `_next/*` and static assets to avoid intercepting every asset.
- Prefer `NextResponse.redirect`/`rewrite`; return early to avoid unnecessary downstream work.

# Examples

Input:

```yaml
middleware_requirements:
  auth: { protected: [/dashboard], redirect_unauthenticated: /login }
  locale: { enabled: true, locales: [en, ko], default: en }
```

Output (abridged):

```ts
// middleware.ts
import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("access_token")?.value;

  if (pathname.startsWith("/dashboard") && !token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```
