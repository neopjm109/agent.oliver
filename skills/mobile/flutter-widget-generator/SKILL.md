---
name: flutter-widget-generator
description: Generates reusable Flutter widgets/components (buttons, cards, list items) from component specs, styled via the Material 3 theme. Use for shared UI primitives consumed by screens.
version: 1.0.0
category: frontend
tags:
  - flutter
  - widgets
  - components
  - ui
model: inherit
invokes:
  - flutter-senior-programmer
inputs:
  - component_specs
  - design_system
outputs:
  - flutter_widgets
---

# Goal
Produce small, reusable, `const`-friendly Flutter widgets from component specs that screens and forms can compose, styled through the generated theme.

# Inputs
```yaml
component_specs:
  - name: ProductCard
    props: [imageUrl: String, title: String, price: double, onTap: VoidCallback?]
    variant: elevated
  - name: RatingStars
    props: [value: double, max: int]
design_system:
  design_tokens: { radius_scale: { md: 12 }, spacing_scale: { sm: 8 } }
```

# Output
```yaml
flutter_widgets:
  files:
    - lib/core/widgets/product_card.dart
    - lib/core/widgets/rating_stars.dart
```

# Workflow
## Step 1 — Contract
For each spec derive a widget class, its required/optional props, and whether it is stateless or stateful.

## Step 2 — Style
Resolve visual props from `Theme.of(context)` (fed by generated design tokens); avoid literal colors/sizes.

## Step 3 — Implement
Delegate each widget body to `flutter-senior-programmer` with `const_constructor` and `material3` constraints.

# Rules
- Widgets are presentational: no direct API calls, no provider mutation — accept callbacks/props instead.
- Prefer `const` constructors and composition; keep each widget in its own file under `lib/core/widgets`.
- Flutter-only; React components are produced by `web/*` and are not reused here.

# Examples
Input:
```yaml
component_specs: [ { name: RatingStars, props: [value: double, max: int] } ]
design_system: { design_tokens: { semantic: { primary: "243 75% 59%" } } }
```
Output:
```yaml
flutter_widgets:
  files:
    - lib/core/widgets/rating_stars.dart
```
```dart
// lib/core/widgets/rating_stars.dart (abridged)
class RatingStars extends StatelessWidget {
  const RatingStars({super.key, required this.value, this.max = 5});
  final double value;
  final int max;
  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: List.generate(max, (i) => Icon(
      i < value ? Icons.star : Icons.star_border,
      color: Theme.of(context).colorScheme.tertiary,
    )),
  );
}
```
