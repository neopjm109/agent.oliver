---
name: mobile-orchestrator
description: Entry point for the mobile (Flutter) domain; turns an application blueprint into a full Flutter app by delegating to flutter-* generators. Use when the target platform is a native mobile app.
version: 1.0.0
category: frontend
tags:
  - mobile
  - flutter
  - orchestrator
  - dart
model: inherit
invokes: [flutter-initializer, flutter-screen-generator, flutter-widget-generator, flutter-navigation-generator, flutter-state-generator, flutter-api-client-generator, flutter-storage-generator, flutter-theme-generator, flutter-form-generator, flutter-notification-generator, flutter-test-generator]
inputs:
  - application_blueprint
  - design_system
  - api_specification
  - options
outputs:
  - mobile_artifacts
---

# Goal
Coordinate the generation of a complete Flutter (Dart) mobile application from an application blueprint, design system, and backend API spec. This skill only plans and delegates — it never emits Dart code directly.

# Inputs
```yaml
application_blueprint:
  ux_flows: [login, product_list, product_detail, checkout, profile]
  component_specs: [PrimaryButton, ProductCard, RatingStars]
  state_requirements: [auth, cart, product_catalog]
  form_specs: [login_form, checkout_form]
  storage_requirements: [auth_tokens, cart_cache]
  notification_requirements: [order_updates, promo_push]
design_system:
  design_tokens: { color_scales: {...}, semantic: {...}, typography_scale: {...}, spacing_scale: {...} }
api_specification:
  base_url: https://api.example.com/v1
  endpoints: [ ... ]
options:
  flavors: [dev, staging, prod]
  min_sdk: "3.4.0"
```

# Output
```yaml
mobile_artifacts:
  scaffold: flutter_scaffold
  theme: flutter_theme
  api_client: flutter_api_client
  storage: flutter_storage
  state: flutter_state
  widgets: flutter_widgets
  screens: flutter_screens
  navigation: flutter_navigation
  forms: flutter_forms
  notifications: flutter_notifications
  tests: flutter_tests
```

# Workflow
## Step 1 — Scaffold
Assemble a `target_stack` for `flutter-initializer` from `options` (`flavors`, and `min_sdk` → `flutter_sdk`/`dart_sdk`) plus project defaults (`state`, `routing`, `http`) and the app `org`, then invoke it to create the project skeleton (pubspec, flavors, folders).

## Step 2 — Contracts
Invoke `flutter-theme-generator` with `design_system.design_tokens` and `flutter-api-client-generator` with `api_specification` to establish the shared contracts.

## Step 3 — Foundations
Invoke `flutter-storage-generator` and `flutter-state-generator` for persistence and app state.

## Step 4 — UI
Invoke `flutter-widget-generator`, then `flutter-screen-generator`, then `flutter-form-generator`, then `flutter-navigation-generator`.

## Step 5 — Platform services
Invoke `flutter-notification-generator` for FCM and local notifications.

## Step 6 — Tests
Invoke `flutter-test-generator` over all produced artifacts.

## Step 7 — Assemble
Collect every sub-skill output into `mobile_artifacts` and return it.

# Rules
- This orchestrator delegates only; it must not generate Dart itself. Implementation detail lives in each generator, which in turn delegates idiomatic Dart to `flutter-senior-programmer`.
- Do NOT invoke `flutter-senior-programmer` directly — it is a persona skill consumed by generators (mirrors `spring-senior-programmer`).
- For web/React output use the `web/*` skills; this domain is Flutter-only and never reuses React code.
- Only the `design-tokens` values and the backend `api_specification` are shared between web and mobile.

# Examples
Input:
```yaml
application_blueprint: { ux_flows: [login, feed], state_requirements: [auth, feed] }
design_system: { design_tokens: { semantic: { primary: "243 75% 59%" } } }
api_specification: { base_url: "https://api.acme.dev/v1", endpoints: [ { name: getFeed, method: GET, path: /feed } ] }
options: { flavors: [dev, prod] }
```
Output:
```yaml
mobile_artifacts:
  scaffold: { pubspec: "lib/, test/, flavors dev+prod created" }
  theme:    { file: "lib/theme/app_theme.dart (Material3 light+dark)" }
  api_client: { file: "lib/data/api/api_client.dart (Dio + Freezed models)" }
  state:    { files: ["lib/features/auth/auth_provider.dart", "lib/features/feed/feed_provider.dart"] }
  screens:  { files: ["lib/features/auth/login_screen.dart", "lib/features/feed/feed_screen.dart"] }
  navigation: { file: "lib/router/app_router.dart (go_router, /login guard)" }
  tests:    { files: ["test/feed_screen_test.dart", "integration_test/app_test.dart"] }
```
