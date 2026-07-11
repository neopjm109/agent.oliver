---
name: layout-generator
description: Generate reusable App Router layouts and templates (dashboard, admin, auth, etc.) with navigation and shared UI structure, keeping business logic out of layouts.
version: 1.0.0
category: frontend
tags:
  - nextjs
  - react
  - layout
  - template
  - app-router
  - shadcn
model: inherit
invokes:
  - typescript-senior-programmer
inputs:
  - layout_requirements
outputs:
  - layout_code
---

# Goal

Generate reusable, production-ready Next.js layouts for page composition,
navigation, and shared UI structure, keeping business logic outside layouts.
Delegates implementation to `typescript-senior-programmer`.

# Inputs

```yaml
layout_requirements:
  name: DashboardLayout
  type: dashboard   # dashboard | admin | public | auth | landing | marketing | settings | blank
  navigation: [header, sidebar, breadcrumb, footer]
  responsive: true
  auth_required: true
```

# Output

```yaml
layout_code:
  - layout component (layout.tsx compatible)
  - navigation components (header/sidebar/footer/breadcrumb)
  - shared providers (if required)
  - supporting types + barrel export
```

# Workflow

## Step 1 — Analyze regions
Identify shared UI regions (header, sidebar, footer, breadcrumb) and responsive needs.

## Step 2 — Design composition
Define the responsive structure and how nested layouts and `children` compose.

## Step 3 — Delegate implementation
Delegate the layout and navigation components to `typescript-senior-programmer`.

## Step 4 — Validate
Confirm responsiveness, accessibility landmarks, and App Router `layout.tsx` compatibility.

# Rules

- Keep layouts focused on composition; no business logic, no API requests.
- Accept page content through `children`; support nested layouts.
- Use Tailwind + shadcn/ui; follow the design system and responsive breakpoints.
- Provide semantic landmarks and skip-navigation where appropriate.

# Examples

Input:

```yaml
layout_requirements: { name: DashboardLayout, navigation: [header, sidebar] }
```

Output (abridged):

```tsx
// app/(dashboard)/layout.tsx
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```
