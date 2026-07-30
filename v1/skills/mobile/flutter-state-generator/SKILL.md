---
name: flutter-state-generator
description: Generates app/UI state with Riverpod — providers, AsyncNotifiers, and state classes — from state requirements. Use for auth, cart, catalog, and other app state.
version: 1.0.0
category: frontend
tags:
  - flutter
  - state
  - riverpod
  - providers
model: inherit
invokes:
  - flutter-senior-programmer
inputs:
  - state_requirements
outputs:
  - flutter_state
---

# Goal
Produce Riverpod state management: providers and `AsyncNotifier`/`Notifier` classes with immutable state, wired to the API client and storage layers.

# Inputs
```yaml
state_requirements:
  - name: auth
    kind: async
    depends_on: [apiClient, secureStorage]
    actions: [login, logout, refresh]
  - name: cart
    kind: sync
    persisted: true
    actions: [add, remove, clear]
```

# Output
```yaml
flutter_state:
  files:
    - lib/features/auth/auth_provider.dart
    - lib/features/cart/cart_provider.dart
```

# Workflow
## Step 1 — Model state
Define an immutable state class (Freezed) per requirement.

## Step 2 — Notifier
Generate an `AsyncNotifier` (async) or `Notifier` (sync) with the listed actions, injecting dependencies via `ref.read`.

## Step 3 — Persist
For `persisted: true`, hydrate/save through `flutter-storage-generator` outputs.

## Step 4 — Implement
Delegate notifier bodies to `flutter-senior-programmer`.

# Rules
- Riverpod only. This is the Flutter/Riverpod analogue of `web/state-generator` (React) — a separate skill for a separate ecosystem; do not reuse React state code.
- State classes are immutable; mutations go through notifier methods returning new state.
- API access via `flutter-api-client-generator` output; persistence via `flutter-storage-generator`.

# Examples
Input:
```yaml
state_requirements: [ { name: auth, kind: async, actions: [login, logout] } ]
```
Output:
```yaml
flutter_state:
  files:
    - lib/features/auth/auth_provider.dart
```
```dart
// lib/features/auth/auth_provider.dart (abridged)
final authProvider = AsyncNotifierProvider<AuthNotifier, User?>(AuthNotifier.new);

class AuthNotifier extends AsyncNotifier<User?> {
  @override
  Future<User?> build() async => ref.read(secureStorageProvider).currentUser();

  Future<void> login(String email, String password) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() =>
      ref.read(apiClientProvider).login(email, password));
  }

  Future<void> logout() async {
    await ref.read(secureStorageProvider).clear();
    state = const AsyncData(null);
  }
}
```
