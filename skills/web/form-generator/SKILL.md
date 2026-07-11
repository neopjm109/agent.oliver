---
name: form-generator
description: Generate reusable React forms using React Hook Form + Zod and the project's design system, keeping business logic and API calls outside the form.
version: 1.0.0
category: frontend
tags:
  - nextjs
  - react
  - form
  - react-hook-form
  - zod
  - validation
model: inherit
invokes:
  - typescript-senior-programmer
inputs:
  - form_requirements
outputs:
  - form_code
---

# Goal

Generate reusable, production-ready forms handling user input, validation, and
submission via React Hook Form + Zod, keeping business logic outside. Delegates
implementation to `typescript-senior-programmer`.

# Inputs

```yaml
form_requirements:
  name: UserForm
  fields: [name, email, phone, status]
  validation: { name: required, email: email-format, phone: optional }
  submit: create-user
  mutation_hook: useCreateUser   # optional
```

# Output

```yaml
form_code:
  - form component + field components
  - Zod schema + inferred types
  - default values + submit handler
  - loading/error/success states + barrel export
```

# Workflow

## Step 1 — Analyze fields
Identify inputs, validation rules, and default values.

## Step 2 — Design schema and props
Define the Zod schema, inferred types, and the Props (submit callback in).

## Step 3 — Delegate implementation
Delegate the form to `typescript-senior-programmer` with the schema + props contract.

## Step 4 — Validate
Confirm accessibility (labels/ARIA), pending-state handling, and consistency.

# Rules

- No business logic and no direct API calls; receive submit callbacks through Props.
- Use React Hook Form; register fields directly, `Controller` only when necessary.
- Use Zod; infer types from schemas; keep validation centralized and declarative.
- shadcn/ui form components; disable submit while pending; prevent duplicate submits.

# Examples

Input:

```yaml
form_requirements: { name: UserForm, fields: [name, email] }
```

Output (abridged):

```tsx
const userSchema = z.object({ name: z.string().min(1), email: z.string().email() });
type UserFormValues = z.infer<typeof userSchema>;

export function UserForm({ onSubmit }: { onSubmit: (v: UserFormValues) => Promise<void> }) {
  const form = useForm<UserFormValues>({ resolver: zodResolver(userSchema) });
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <input {...form.register("name")} aria-label="Name" />
      <input {...form.register("email")} aria-label="Email" />
      <button type="submit" disabled={form.formState.isSubmitting}>Save</button>
    </form>
  );
}
```
