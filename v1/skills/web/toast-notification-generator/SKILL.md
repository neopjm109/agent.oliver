---
name: toast-notification-generator
description: Generate a Next.js toast/notification system — provider, useToast hook, variant UI, and promise-based toasts for transient feedback.
version: 1.0.0
category: frontend
tags:
  - nextjs
  - react
  - toast
  - notification
  - sonner
model: inherit
invokes:
  - typescript-senior-programmer
inputs:
  - toast_requirements
outputs:
  - toast_code
---

# Goal

Generate a transient notification (toast) system for a Next.js app: a provider mounted in the
root layout, a `useToast` hook, variant UI (success/error/info/warning), and promise-based
toasts for async flows. This skill owns **transient, non-blocking feedback**; blocking modal
interactions are owned by `dialog-generator`.

# Inputs

```yaml
toast_requirements:
  library: sonner            # sonner | shadcn-toast
  variants: [success, error, info, warning]
  position: top-right
  promise_toasts: true       # toast.promise for async actions
  default_duration: 4000
```

# Output

```yaml
toast_code:
  - ToastProvider (mounted in root layout)
  - useToast hook (typed variant API)
  - toast helpers (toast.success/error/promise)
  - variant styling aligned with design tokens
```

# Workflow

## Step 1 — Set up the provider
Add the toaster provider to the root layout with position and default duration.

## Step 2 — Expose a typed API
Define a `useToast` hook / helper wrapping the variants and promise toasts with typed args.

## Step 3 — Style with tokens
Map variant colors to the design system tokens for visual consistency.

## Step 4 — Delegate implementation
Delegate the provider, hook, and helpers to `typescript-senior-programmer`.

# Rules

- Own transient feedback only; blocking confirmations/modals belong to `dialog-generator`.
- Toasts are non-blocking and auto-dismiss; never gate a required decision behind a toast.
- Keep a single provider instance at the root; do not mount duplicate toasters per page.
- Variant styling must consume design tokens, not hardcoded colors.
- Keep messages concise; never render secrets or full error stacks to end users.

# Examples

Input:

```yaml
toast_requirements:
  library: sonner
  variants: [success, error]
  position: top-right
  promise_toasts: true
```

Output (abridged):

```tsx
// components/providers/toast-provider.tsx
"use client";
import { Toaster } from "sonner";
export function ToastProvider() {
  return <Toaster position="top-right" duration={4000} richColors />;
}

// hooks/use-toast.ts
import { toast } from "sonner";
export function useToast() {
  return {
    success: (msg: string) => toast.success(msg),
    error: (msg: string) => toast.error(msg),
    promise: toast.promise,
  };
}
```
