---
name: component-generator
description: Generate reusable presentational React components following the project's design system, keeping business logic and data fetching outside the component.
version: 1.0.0
category: frontend
tags:
  - nextjs
  - react
  - component
  - ui
  - shadcn
  - tailwindcss
model: inherit
invokes:
  - typescript-senior-programmer
inputs:
  - component_requirements
  - design_system
  - component_spec
outputs:
  - component_code
---

# Goal

Generate reusable, maintainable presentational React components focused on
presentation and composition, keeping business logic outside. Delegates
implementation to `typescript-senior-programmer`.

# Inputs

```yaml
component_requirements:
  name: UserCard
  purpose: display a user summary
  props: [name, email, avatar, status]
  ui: [responsive, clickable, loading-state, avatar-fallback]
# Optional design-layer handoffs (build target when the design pipeline ran):
design_system: <inventory + variant contracts from design-system-generator>   # optional
component_spec: <structure/props/token_map from figma-to-component>            # optional
```

# Output

```yaml
component_code:
  - component + props interface
  - supporting types (if required)
  - loading/empty states (if applicable)
  - export definitions
```

# Workflow

## Step 1 — Analyze responsibility
Identify the component's single responsibility and its public Props interface.

## Step 2 — Design the contract
Define props, states (loading/empty), and composition of child components.

## Step 3 — Delegate implementation
Delegate the component to `typescript-senior-programmer` with the props contract.

## Step 4 — Validate
Confirm reusability, accessibility, and design-system consistency.

# Rules

- Single responsibility; no business logic, no direct API calls or data fetching.
- Functional, composable, stateless where possible; avoid unnecessary re-renders.
- Strict typing with clear Props interfaces; prefer readonly props.
- Tailwind + shadcn/ui; semantic HTML and ARIA where required; PascalCase names.

# Examples

Input:

```yaml
component_requirements: { name: UserCard, props: [name, email, status] }
```

Output (abridged):

```tsx
interface UserCardProps {
  name: string;
  email: string;
  status: "active" | "inactive";
  onClick?: () => void;
}

export function UserCard({ name, email, status, onClick }: UserCardProps) {
  return (
    <button onClick={onClick} className="w-full rounded-lg border p-4 text-left">
      <p className="font-medium">{name}</p>
      <p className="text-sm text-muted-foreground">{email}</p>
      <span className="text-xs">{status}</span>
    </button>
  );
}
```
