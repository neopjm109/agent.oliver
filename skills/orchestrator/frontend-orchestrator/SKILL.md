---
name: frontend-orchestrator
description: Orchestrates the Next.js frontend implementation for a feature by coordinating page, layout, component, form, table, dialog, chart, hook, state, data, API-client, auth, i18n, middleware, theme, toast, realtime-client, feature, and test generators.
version: 1.0.0
category: orchestrator
tags:
  - orchestrator
  - frontend
  - nextjs
  - react
  - ui
model: inherit
invokes:
  - page-generator
  - layout-generator
  - component-generator
  - form-generator
  - table-generator
  - dialog-generator
  - chart-generator
  - hook-generator
  - state-generator
  - data-generator
  - api-client-generator
  - auth-generator
  - i18n-generator
  - middleware-generator
  - theme-generator
  - toast-notification-generator
  - realtime-client-generator
  - feature-generator
  - frontend-test-generator
inputs:
  - feature
  - application_blueprint
  - target_stack
outputs:
  - frontend_artifact
---

# Goal

Generate the complete Next.js frontend for a feature by orchestrating specialized frontend
generators. This skill **never generates implementation code directly** — it delegates to
generators (which in turn delegate implementation to typescript-senior-programmer) and
merges the results.

# Inputs

```yaml
feature:
  id: FEAT-ORDER
  name: Place Order
  stories: [...]
  tasks: [...]
application_blueprint: {...}
target_stack:
  frontend: Next.js
```

# Output

```yaml
frontend_artifact:
  layouts: [...]
  pages: [...]
  components: [...]
  forms: [...]
  tables: [...]
  dialogs: [...]
  charts: [...]
  hooks: [...]
  state: [...]
  data: [...]          # TanStack Query hooks
  api_clients: [...]   # HTTP client + types
  auth: [...]
  i18n: [...]
  middleware: [...]    # edge middleware.ts (auth/redirect/locale routing)
  theme: [...]         # theme provider + switcher
  toast: [...]         # toast/notification system
  realtime: [...]      # websocket/SSE client + subscription hooks
  feature_modules: [...]
  tests: [...]
```

# Workflow

## Step 1 — Analyze frontend scope
Determine user flows, screens, layouts, components, forms/tables/dialogs/charts, state, i18n, auth, and API communication.

## Step 2 — Generate shell
Invoke `layout-generator` (navigation/header/sidebar/footer) then `page-generator` (routes, loading/error pages).

## Step 3 — Generate UI building blocks
Invoke as needed: `component-generator`, `form-generator`, `table-generator`, `dialog-generator`, `chart-generator`.

## Step 4 — Generate data layer
Invoke in order: `api-client-generator` (HTTP client + types) → `data-generator` (TanStack Query hooks) → `state-generator` (global/UI state) → `hook-generator` (other custom hooks).

## Step 5 — Generate cross-cutting concerns
If required, invoke `auth-generator` (client auth/session/guards), `i18n-generator` (translations),
`middleware-generator` (edge auth/redirect/locale routing in `middleware.ts`), `theme-generator`
(theme provider/switcher/dark mode), `toast-notification-generator` (transient feedback), and
`realtime-client-generator` (WebSocket/SSE client + subscription hooks).

## Step 6 — Compose feature module
Invoke `feature-generator` to compose the above into a cohesive feature module.

## Step 7 — Generate tests
If tests are enabled, invoke `frontend-test-generator` → component, page, and integration tests with mocked APIs.

## Step 8 — Assemble artifact
Merge all outputs into `frontend_artifact`.

# Rules

- Never generate implementation code directly; always delegate.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- The frontend data layer flows api-client → data → state → hook. Tag data-fetching hooks as `tanstack-query`.
- `api-client-generator` is owned by frontend-orchestrator; the backend `integration-generator` (external HTTP transport) must not duplicate it.
- Edge request interception (auth/redirect/locale routing) is `middleware-generator`; client session/guards stay in `auth-generator`; translations stay in `i18n-generator`.
- Transient non-blocking feedback is `toast-notification-generator`; blocking modals stay in `dialog-generator`.
- Runtime theme provider/switcher is `theme-generator`; light/dark token values stay in `design-tokens-generator`.
- Push/subscription channels are `realtime-client-generator`; request/response query hooks stay in `data-generator`.
- Keep UI consistent across layouts, navigation, components, design system, and naming.
- Honor the names declared in `frontend_plan` / `design_system` (screens, routes, components):
  a plan screen `PlaceOrderForm` must yield a `PlaceOrderForm` component and a plan route
  `/orders/[id]` must yield exactly that route — do not rename a named component or inline it
  into another. This preserves plan→code traceability (checked by `frontend-validator` FE-08).
- API clients must match the API spec, backend DTOs, auth strategy, and error format.
- Every artifact must reference its requirement, blueprint component, feature, story, and task.
- Complete only when required generators finish and outputs are merged into `frontend_artifact`.

# Examples

Input:

```yaml
feature: { id: FEAT-ORDER, name: Place Order, stories: [Order Form, Order History] }
target_stack: { frontend: Next.js }
```

Output (abridged):

```
✔ layout      → (app) shell with sidebar nav
✔ page        → /orders, /orders/new (+ loading/error)
✔ component   → OrderSummaryCard
✔ form        → PlaceOrderForm (zod schema)
✔ table       → OrderHistoryTable (sort/paginate)
∅ dialog / chart → skipped
✔ api-client  → ordersApi + Order types
✔ data        → useOrders, usePlaceOrder (tanstack-query)
✔ state       → orderUiStore
✔ auth        → route guard for /orders
∅ i18n        → skipped
✔ feature     → orders feature module
✔ tests       → PlaceOrderForm.test.tsx, orders.page.test.tsx
✔ assemble    → frontend_artifact (14 files)
```
