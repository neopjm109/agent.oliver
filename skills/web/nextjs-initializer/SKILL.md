---
name: nextjs-initializer
description: Initialize a production-ready Next.js project with the required frontend stack (TypeScript, Tailwind, shadcn/ui, TanStack Query, Zustand) and project conventions.
version: 1.0.0
category: frontend
tags:
  - nextjs
  - react
  - typescript
  - initializer
  - tailwindcss
  - shadcn
model: inherit
invokes: []
inputs:
  - stack_requirements
outputs:
  - project_scaffold
---

# Goal

Initialize a production-ready Next.js project using the selected technology stack
and predefined project conventions. Produces a runnable scaffold — the foundation
that all other frontend generators build on.

# Inputs

```yaml
stack_requirements:
  nextjs: 15
  typescript: strict
  libraries: [tailwindcss, shadcn-ui, tanstack-query, zustand, react-hook-form, zod]
  tooling: [eslint, prettier]
  architecture: feature-sliced-design
```

# Output

```yaml
project_scaffold:
  - package.json / pnpm-lock.yaml / .npmrc / tsconfig.json / next.config.ts
  - app/layout.tsx (root layout + providers)
  - components/providers/query-provider.tsx
  - lib/ (shared utilities)
  - .eslintrc / .prettierrc
```

# Workflow

## Step 1 — Resolve the stack
Analyze the requested libraries and select compatible package versions.

## Step 2 — Scaffold structure
Create the App Router directory structure and feature-sliced layout conventions.

## Step 3 — Configure tooling and providers
Set up ESLint, Prettier, TypeScript strict mode, and the TanStack Query / theme
providers wired into the root layout.

## Step 4 — Verify
Confirm the project builds and runs (`next dev`) with no missing dependencies.

# Rules

- Follow modern Next.js App Router conventions; prefer Server Components by default.
- Enable TypeScript strict mode.
- **pnpm is the preferred package manager** for this and every TypeScript/Node skill. Emit a
  `pnpm-lock.yaml` (not `package-lock.json`) plus `.npmrc`, and run scripts with `pnpm`
  (`pnpm install`, `pnpm dev`, `pnpm build`, `pnpm test`). npm/yarn remain a supported fallback,
  but pnpm is the default the downstream `cicd-generator` and `dependency-license-validator`
  assume; those skills are lockfile-driven, so a project shipping a different lockfile is honored.
- Configure ESLint and Prettier; minimize unnecessary dependencies.
- Keep the project immediately runnable and production-ready.
- Establish the canonical `features/<name>/{api,hooks,components,model,types,constants,utils}` layout used by feature-generator.

# Examples

Input:

```yaml
stack_requirements:
  nextjs: 15
  libraries: [tailwindcss, shadcn-ui, tanstack-query, zustand]
```

Output (abridged):

```
my-app/
├── app/
│   ├── layout.tsx
│   └── page.tsx
├── components/providers/query-provider.tsx
├── features/
├── lib/utils.ts
├── tsconfig.json   (strict: true)
├── package.json
└── pnpm-lock.yaml   (pnpm is the preferred package manager)
```

```tsx
// components/providers/query-provider.tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```
