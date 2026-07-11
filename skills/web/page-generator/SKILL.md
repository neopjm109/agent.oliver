---
name: page-generator
description: Generate Next.js App Router pages by composing existing Features into complete user-facing screens without embedding business logic.
version: 1.0.0
category: frontend
tags:
  - nextjs
  - react
  - page
  - app-router
model: inherit
invokes:
  - typescript-senior-programmer
inputs:
  - page_requirements
outputs:
  - page_code
---

# Goal

Generate a complete Next.js App Router page that composes existing Features into a
user-facing screen, keeping page-level logic minimal. Delegates implementation to
`typescript-senior-programmer`.

# Inputs

```yaml
page_requirements:
  name: UsersPage
  route: /users
  purpose: list and manage users
  uses: [UserTable, UserSearchForm]
  auth_required: true
```

# Output

```yaml
page_code:
  - app/users/page.tsx
  - app/users/loading.tsx   # if needed
  - app/users/error.tsx     # if needed
  - metadata + route structure
```

# Workflow

## Step 1 — Analyze the route
Determine the route segment, dynamic params, and authentication requirement.

## Step 2 — Identify features
Map the page to the existing Feature components it composes (from feature-generator).

## Step 3 — Compose
Assemble the page from Features, add loading/error/not-found states and Metadata API config.

## Step 4 — Delegate implementation
Delegate the actual `page.tsx` (and adjacent segment files) to `typescript-senior-programmer`.

# Rules

- Pages contain minimal business logic; reuse existing Features.
- Follow App Router conventions; prefer Server Components.
- Configure Metadata via the Metadata API, not manual `<head>` tags.
- Keep routing structures clean; do not fetch data ad hoc — use Feature data hooks.

# Examples

Input:

```yaml
page_requirements: { route: /users, uses: [UserTable, UserSearchForm] }
```

Output (abridged):

```tsx
// app/users/page.tsx
import type { Metadata } from "next";
import { UserTable } from "@/features/user/components/user-table";
import { UserSearchForm } from "@/features/user/components/user-search-form";

export const metadata: Metadata = { title: "Users" };

export default function UsersPage() {
  return (
    <main className="space-y-4 p-6">
      <UserSearchForm />
      <UserTable />
    </main>
  );
}
```
