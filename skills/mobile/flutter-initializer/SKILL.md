---
name: flutter-initializer
description: Scaffolds a fresh Flutter project — pubspec.yaml dependencies, folder structure, build flavors (dev/staging/prod), and analysis_options. Use once at the start of mobile generation.
version: 1.0.0
category: frontend
tags:
  - flutter
  - scaffold
  - pubspec
  - flavors
model: inherit
invokes:
  - flutter-senior-programmer
inputs:
  - target_stack
outputs:
  - flutter_scaffold
---

# Goal
Produce a clean, buildable Flutter project skeleton with dependencies, a feature-first folder layout, build flavors, and lint configuration — but no feature code.

# Inputs
```yaml
target_stack:
  flutter_sdk: "3.24.0"
  dart_sdk: "3.5.0"
  state: riverpod
  routing: go_router
  http: dio
  flavors: [dev, staging, prod]
  org: com.acme.app
```

# Output
```yaml
flutter_scaffold:
  files:
    - pubspec.yaml
    - analysis_options.yaml
    - lib/main_dev.dart
    - lib/main_staging.dart
    - lib/main_prod.dart
    - lib/app.dart
    - lib/config/flavor_config.dart
  folders: [lib/core, lib/data, lib/features, lib/router, lib/theme, test, integration_test]
```

# Workflow
## Step 1 — Dependencies
Assemble `pubspec.yaml` with runtime deps (flutter_riverpod, go_router, dio, freezed_annotation, json_annotation, shared_preferences, sqflite, flutter_secure_storage, firebase_messaging, flutter_local_notifications) and dev deps (build_runner, freezed, json_serializable, flutter_lints, mocktail).

## Step 2 — Layout
Create a feature-first folder tree: `lib/core`, `lib/data`, `lib/features`, `lib/router`, `lib/theme`, plus `test/` and `integration_test/`.

## Step 3 — Flavors
Generate `flavor_config.dart` plus `main_dev.dart` / `main_staging.dart` / `main_prod.dart` entry points wiring flavor-specific config.

## Step 4 — Lints
Emit `analysis_options.yaml` including `flutter_lints` and effective-Dart rules. Delegate any non-trivial Dart to `flutter-senior-programmer`.

# Rules
- Scaffold only — do NOT generate screens, widgets, providers, or API code. Those belong to the dedicated generators.
- Pin SDK constraints to `target_stack`; enable null-safety.
- Do not touch React/web scaffolding; that is handled by `web/*`.

# Examples
Input:
```yaml
target_stack: { flutter_sdk: "3.24.0", flavors: [dev, prod], org: com.acme.shop }
```
Output:
```yaml
flutter_scaffold:
  files:
    - pubspec.yaml
    - analysis_options.yaml
    - lib/main_dev.dart
    - lib/main_prod.dart
    - lib/app.dart
    - lib/config/flavor_config.dart
  folders: [lib/core, lib/data, lib/features, lib/router, lib/theme, test, integration_test]
```
```yaml
# pubspec.yaml (abridged) — from target_stack
environment: { sdk: '>=3.5.0 <4.0.0' }
dependencies: { flutter: { sdk: flutter }, flutter_riverpod: ^2.5.1, go_router: ^14.2.0, dio: ^5.5.0 }
dev_dependencies: { build_runner: ^2.4.11, freezed: ^2.5.7, flutter_lints: ^4.0.0 }
# lib/config/flavor_config.dart → enum Flavor { dev, prod }
```
