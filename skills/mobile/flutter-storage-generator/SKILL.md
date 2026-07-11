---
name: flutter-storage-generator
description: Generates local persistence — shared_preferences for settings, sqflite for structured cache, and flutter_secure_storage for tokens — from storage requirements. Use for on-device data.
version: 1.0.0
category: frontend
tags:
  - flutter
  - storage
  - sqflite
  - secure-storage
model: inherit
invokes:
  - flutter-senior-programmer
inputs:
  - storage_requirements
outputs:
  - flutter_storage
---

# Goal
Produce typed local-persistence services: `shared_preferences` for key-value settings, `sqflite` for relational cache, and `flutter_secure_storage` for sensitive data such as auth tokens.

# Inputs
```yaml
storage_requirements:
  - name: auth_tokens
    backend: secure_storage
    keys: [access_token, refresh_token]
  - name: settings
    backend: shared_preferences
    keys: [theme_mode, locale]
  - name: product_cache
    backend: sqflite
    table: products
    columns: { id: TEXT, title: TEXT, price: REAL }
```

# Output
```yaml
flutter_storage:
  files:
    - lib/data/storage/secure_token_store.dart
    - lib/data/storage/settings_store.dart
    - lib/data/storage/product_dao.dart
    - lib/data/storage/app_database.dart
```

# Workflow
## Step 1 — Choose backend
Route each requirement to the right backend: secure_storage for secrets, shared_preferences for simple prefs, sqflite for structured/queryable data.

## Step 2 — Services
Generate a typed store/DAO class per requirement with async read/write methods; open the sqflite DB with migrations.

## Step 3 — Providers
Expose each store as a Riverpod provider for injection.

## Step 4 — Implement
Delegate concrete Dart to `flutter-senior-programmer`.

# Rules
- Tokens and other secrets MUST use `flutter_secure_storage`, never shared_preferences.
- Storage services expose typed methods only; no raw string keys leak to callers.
- Flutter-only; browser localStorage/IndexedDB persistence for web is out of scope (handled by `web/*`).

# Examples
Input:
```yaml
storage_requirements: [ { name: auth_tokens, backend: secure_storage, keys: [access_token] } ]
```
Output:
```yaml
flutter_storage:
  files:
    - lib/data/storage/secure_token_store.dart
```
```dart
// lib/data/storage/secure_token_store.dart (abridged)
class SecureTokenStore {
  SecureTokenStore(this._storage);
  final FlutterSecureStorage _storage;
  Future<void> saveAccessToken(String t) =>
    _storage.write(key: 'access_token', value: t);
  Future<String?> readAccessToken() => _storage.read(key: 'access_token');
  Future<void> clear() => _storage.deleteAll();
}
final secureTokenStoreProvider = Provider(
  (ref) => SecureTokenStore(const FlutterSecureStorage()));
```
