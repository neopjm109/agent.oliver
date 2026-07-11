---
name: flutter-navigation-generator
description: Generates app routing with go_router — route table, redirect/auth guards, and deep links — from UX flows. Use to connect screens into a navigable app.
version: 1.0.0
category: frontend
tags:
  - flutter
  - navigation
  - go_router
  - routing
model: inherit
invokes:
  - flutter-senior-programmer
inputs:
  - ux_flows
outputs:
  - flutter_navigation
---

# Goal
Produce a `go_router` configuration: typed routes, nested/shell routes, redirect guards for auth, and deep-link path parsing, connecting the generated screens.

# Inputs
```yaml
ux_flows:
  - name: login
    path: /login
    public: true
  - name: product_list
    path: /products
    guard: requireAuth
  - name: product_detail
    path: /products/:id
    guard: requireAuth
```

# Output
```yaml
flutter_navigation:
  files:
    - lib/router/app_router.dart
    - lib/router/route_paths.dart
```

# Workflow
## Step 1 — Route table
Map each UX flow to a `GoRoute` with path, name, and builder pointing at the matching screen.

## Step 2 — Guards
Implement a `redirect` that reads the auth provider and bounces unauthenticated users on `guard: requireAuth` routes to `/login`.

## Step 3 — Deep links & params
Extract path params (e.g. `:id`) and query params; enable deep-link handling.

## Step 4 — Implement
Delegate the `GoRouter` construction to `flutter-senior-programmer`.

# Rules
- Use `go_router` only; expose route paths as constants in `route_paths.dart` (no magic strings in screens).
- Guards read Riverpod state produced by `flutter-state-generator`; do not duplicate auth logic.
- Flutter-only routing; React Router config belongs to `web/*`.

# Examples
Input:
```yaml
ux_flows: [ { name: login, path: /login, public: true }, { name: home, path: /, guard: requireAuth } ]
```
Output:
```yaml
flutter_navigation:
  files:
    - lib/router/app_router.dart
    - lib/router/route_paths.dart
```
```dart
// lib/router/app_router.dart (abridged)
final routerProvider = Provider<GoRouter>((ref) => GoRouter(
  initialLocation: '/',
  redirect: (context, state) {
    final loggedIn = ref.read(authProvider).valueOrNull != null;
    if (!loggedIn && state.uri.path != '/login') return '/login';
    return null;
  },
  routes: [
    GoRoute(path: '/login', name: 'login', builder: (_, __) => const LoginScreen()),
    GoRoute(path: '/', name: 'home', builder: (_, __) => const HomeScreen()),
  ],
));
```
