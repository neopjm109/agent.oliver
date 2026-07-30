---
name: dialog-generator
description: Generate reusable, accessible dialog components (modals, drawers, alerts, confirmations, wizards) with shadcn/ui, keeping business logic outside the dialog.
version: 1.0.0
category: frontend
tags:
  - nextjs
  - react
  - dialog
  - modal
  - drawer
  - shadcn
model: inherit
invokes:
  - typescript-senior-programmer
inputs:
  - dialog_requirements
outputs:
  - dialog_code
---

# Goal

Generate reusable, accessible, production-ready dialog components focused on user
interaction, keeping business logic outside. Delegates implementation to
`typescript-senior-programmer`.

# Inputs

```yaml
dialog_requirements:
  name: DeleteUserDialog
  type: confirmation   # alert | confirmation | modal | drawer | sheet | full-screen | wizard
  purpose: confirm destructive action
  actions: [confirm, cancel]
  ui: [warning-message, loading-state]
```

# Output

```yaml
dialog_code:
  - dialog component + props interface
  - action definitions + loading state
  - supporting types + barrel export
```

# Workflow

## Step 1 — Analyze interaction
Identify the dialog type and interaction pattern (open/close, actions).

## Step 2 — Design props
Define the controlled open/close Props and action callbacks.

## Step 3 — Delegate implementation
Delegate the dialog to `typescript-senior-programmer` with the props contract.

## Step 4 — Validate
Confirm focus trapping, Escape-to-close, focus restore, and accessible titles.

# Rules

- Single responsibility; no business logic, no direct API calls or data fetching.
- Keep open/close controlled by the parent; expose events through Props.
- Use shadcn/ui Dialog/Drawer; follow ARIA dialog best practices.
- Trap focus, close on Escape, restore focus on close; provide title/description.

# Examples

Input:

```yaml
dialog_requirements: { name: DeleteUserDialog, type: confirmation }
```

Output (abridged):

```tsx
interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
}

export function DeleteUserDialog({ open, onOpenChange, onConfirm, isPending }: DeleteUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Delete user?</DialogTitle>
        <DialogDescription>This action cannot be undone.</DialogDescription>
        <button onClick={onConfirm} disabled={isPending}>Delete</button>
      </DialogContent>
    </Dialog>
  );
}
```
