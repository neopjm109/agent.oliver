---
name: table-generator
description: Generate reusable data table components with sorting, filtering, pagination, selection, and row actions using TanStack Table + shadcn/ui, keeping business logic outside.
version: 1.0.0
category: frontend
tags:
  - nextjs
  - react
  - table
  - datatable
  - tanstack-table
  - shadcn
model: inherit
invokes:
  - typescript-senior-programmer
inputs:
  - table_requirements
outputs:
  - table_code
---

# Goal

Generate reusable, production-ready data table components for displaying and
interacting with tabular data, keeping business logic and API calls outside.
Delegates implementation to `typescript-senior-programmer`.

# Inputs

```yaml
table_requirements:
  name: UserTable
  columns: [name, email, status, createdAt]
  features: [search, sort, pagination, multi-select, delete-action]
  row_actions: [edit, delete]   # optional
```

# Output

```yaml
table_code:
  - table component + column definitions + props interface
  - toolbar / search / filter / pagination components (as required)
  - empty/loading/error states + barrel export
```

# Workflow

## Step 1 — Analyze columns
Identify displayed columns and derive reusable column definitions.

## Step 2 — Design interactions
Design sorting, filtering, pagination, selection, and row-action callbacks.

## Step 3 — Delegate implementation
Delegate the table and its subcomponents to `typescript-senior-programmer`.

## Step 4 — Validate
Confirm semantic table markup, keyboard navigation, and responsiveness.

# Rules

- No API requests and no business logic; accept data through Props, actions via callbacks.
- Use TanStack Table + shadcn/ui table components; keep column defs reusable and memoized.
- Keep search/filter independent from server communication.
- Strict typing with explicit row and Props types.

# Examples

Input:

```yaml
table_requirements: { name: UserTable, columns: [name, email, status] }
```

Output (abridged):

```tsx
interface UserRow { id: string; name: string; email: string; status: string; }

const columns: ColumnDef<UserRow>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "status", header: "Status" },
];

export function UserTable({ data, onDelete }: { data: UserRow[]; onDelete: (id: string) => void }) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  // render table.getRowModel() with shadcn/ui <Table> ...
}
```
