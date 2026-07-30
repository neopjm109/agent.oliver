---
name: flutter-test-generator
description: Generates widget tests, integration_test flows, and golden tests over the produced mobile artifacts. Use as the final verification step of mobile generation.
version: 1.0.0
category: frontend
tags:
  - flutter
  - testing
  - widget-test
  - golden
model: inherit
invokes:
  - flutter-senior-programmer
inputs:
  - mobile_artifacts
outputs:
  - flutter_tests
---

# Goal
Produce a test suite for the generated Flutter app: `flutter_test` widget tests, `integration_test` end-to-end flows, and golden (screenshot) tests, using mocked providers and API clients.

# Inputs
```yaml
mobile_artifacts:
  screens: [login_screen, product_list_screen]
  widgets: [ProductCard, RatingStars]
  state: [authProvider, cartProvider]
  api_client: ApiClient
```

# Output
```yaml
flutter_tests:
  files:
    - test/widgets/product_card_test.dart
    - test/features/login_screen_test.dart
    - test/goldens/product_card_golden_test.dart
    - integration_test/app_flow_test.dart
```

# Workflow
## Step 1 — Widget tests
For each widget/screen, pump it inside `ProviderScope` with overridden providers and mocked `ApiClient` (mocktail); assert rendered content and interactions.

## Step 2 — Golden tests
Capture golden images for key widgets across light/dark themes.

## Step 3 — Integration
Write `integration_test` covering a full flow (e.g. login then browse) driving real navigation.

## Step 4 — Implement
Delegate test bodies to `flutter-senior-programmer`.

# Rules
- Override Riverpod providers and mock the Dio-based `ApiClient`; tests must not hit the network.
- Golden tests pin theme (light+dark) and device size for determinism.
- Flutter/Dart tests only; Jest/RTL suites for web come from `web/*`.

# Examples
Input:
```yaml
mobile_artifacts: { widgets: [ProductCard], state: [authProvider] }
```
Output:
```yaml
flutter_tests:
  files:
    - test/widgets/product_card_test.dart
    - test/features/login_screen_test.dart
    - test/goldens/product_card_golden_test.dart
    - integration_test/app_flow_test.dart
```
```dart
// test/widgets/product_card_test.dart (abridged)
void main() {
  testWidgets('ProductCard shows title and fires onTap', (tester) async {
    var tapped = false;
    await tester.pumpWidget(MaterialApp(
      home: ProductCard(title: 'Shoe', price: 9.9, onTap: () => tapped = true),
    ));
    expect(find.text('Shoe'), findsOneWidget);
    await tester.tap(find.byType(ProductCard));
    expect(tapped, isTrue);
  });
}
```
