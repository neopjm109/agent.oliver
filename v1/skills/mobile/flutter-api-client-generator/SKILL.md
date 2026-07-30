---
name: flutter-api-client-generator
description: Generates a typed HTTP client with Dio plus Freezed/json models from the backend api_specification. Use to give the Flutter app a strongly-typed data layer against the same backend contract as the web app.
version: 1.0.0
category: frontend
tags:
  - flutter
  - dio
  - api
  - freezed
model: inherit
invokes:
  - flutter-senior-programmer
inputs:
  - api_specification
outputs:
  - flutter_api_client
---

# Goal
Produce a Dio-based API client and Freezed/`json_serializable` request/response models generated from the shared backend `api_specification`, including interceptors for auth and error mapping.

# Inputs
```yaml
api_specification:
  base_url: https://api.example.com/v1
  endpoints:
    - name: login
      method: POST
      path: /auth/login
      body: { email: string, password: string }
      response: AuthResponse
    - name: getProducts
      method: GET
      path: /products
      query: { page: int }
      response: PagedProducts
```

# Output
```yaml
flutter_api_client:
  files:
    - lib/data/api/api_client.dart
    - lib/data/api/dio_provider.dart
    - lib/data/models/auth_response.dart
    - lib/data/models/paged_products.dart
```

# Workflow
## Step 1 — Dio setup
Create a configured `Dio` instance (base URL from flavor config) with interceptors: bearer-token injection, logging, error-to-exception mapping.

## Step 2 — Models
For each response/body schema, generate a Freezed class with `fromJson`/`toJson` (`json_serializable`).

## Step 3 — Methods
Generate one typed client method per endpoint returning the parsed model.

## Step 4 — Implement
Delegate Dio calls and model bodies to `flutter-senior-programmer`; run `build_runner` for Freezed codegen.

# Rules
- Dio-based and Dart-typed — this is distinct from `web/api-client-generator` (fetch/TypeScript). Both consume the SAME `api_specification` contract but generate independent code.
- Token injection reads secure storage from `flutter-storage-generator`; do not store tokens here.
- Models are immutable Freezed classes; no manual JSON parsing.

# Examples
Input:
```yaml
api_specification:
  base_url: https://api.acme.dev/v1
  endpoints: [ { name: login, method: POST, path: /auth/login, response: AuthResponse } ]
```
Output:
```yaml
flutter_api_client:
  files:
    - lib/data/api/api_client.dart
    - lib/data/api/dio_provider.dart
    - lib/data/models/auth_response.dart
    - lib/data/models/paged_products.dart
```
```dart
// lib/data/api/api_client.dart (abridged)
class ApiClient {
  ApiClient(this._dio);
  final Dio _dio;

  Future<AuthResponse> login(String email, String password) async {
    final res = await _dio.post('/auth/login',
      data: {'email': email, 'password': password});
    return AuthResponse.fromJson(res.data as Map<String, dynamic>);
  }
}
  model: |
@freezed
class AuthResponse with _$AuthResponse {
  const factory AuthResponse({required String token, required User user}) = _AuthResponse;
  factory AuthResponse.fromJson(Map<String, dynamic> j) => _$AuthResponseFromJson(j);
}
```
