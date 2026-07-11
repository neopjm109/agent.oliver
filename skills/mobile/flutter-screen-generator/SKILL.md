---
name: flutter-screen-generator
description: Generates full Flutter screens/pages (Scaffold-based) from UX flows, wiring them to Riverpod state and reusable widgets. Use to produce top-level routable pages.
version: 1.0.0
category: frontend
tags:
  - flutter
  - screens
  - pages
  - ui
model: inherit
invokes:
  - flutter-senior-programmer
inputs:
  - ux_flows
  - design_system
outputs:
  - flutter_screens
---

# Goal
Produce complete, routable Flutter screens (one `Scaffold` per UX step) that compose reusable widgets, read Riverpod providers, and follow the Material 3 theme.

# Inputs
```yaml
ux_flows:
  - name: product_list
    reads: [productCatalogProvider]
    widgets: [ProductCard, SearchBar]
    actions: [openDetail, refresh]
  - name: product_detail
    params: [productId]
    reads: [productDetailProvider]
design_system:
  design_tokens: { spacing_scale: { md: 16 } }
```

# Output
```yaml
flutter_screens:
  files:
    - lib/features/catalog/product_list_screen.dart
    - lib/features/catalog/product_detail_screen.dart
```

# Workflow
## Step 1 — Map flows
For each UX flow, define a `ConsumerWidget`/`ConsumerStatefulWidget` screen with a `Scaffold`, app bar, and body.

## Step 2 — Wire state
Bind screens to Riverpod providers via `ref.watch`, handling loading/error/data with `AsyncValue.when`.

## Step 3 — Compose
Use widgets from `flutter-widget-generator` and theme from `flutter-theme-generator`; do not inline styling.

## Step 4 — Implement
Delegate the concrete Dart bodies to `flutter-senior-programmer` with each screen spec.

# Rules
- One screen = one file = one routable page; keep business logic in providers, not in `build`.
- Reuse generated widgets rather than redefining UI primitives.
- Flutter-only — do not emit React pages; web screens come from `web/*`.
- Consume design-token values via the generated theme, never hard-coded colors.

# Examples
Input:
```yaml
ux_flows: [ { name: login, reads: [authProvider], actions: [submit] } ]
design_system: { design_tokens: { spacing_scale: { md: 16 } } }
```
Output:
```yaml
flutter_screens:
  files:
    - lib/features/auth/login_screen.dart
```
```dart
// lib/features/auth/login_screen.dart (abridged)
class LoginScreen extends ConsumerWidget {
  const LoginScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(authProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Sign in')),
      body: state.when(
        data: (_) => const LoginForm(),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(message: '$e'),
      ),
    );
  }
}
```
