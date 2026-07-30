---
name: flutter-theme-generator
description: Generates Material 3 ThemeData (light + dark) from design-tokens values — color scheme, typography, shapes. Use to establish the app-wide visual theme.
version: 1.0.0
category: frontend
tags:
  - flutter
  - theme
  - material3
  - design-tokens
model: inherit
invokes:
  - flutter-senior-programmer
inputs:
  - design_tokens
outputs:
  - flutter_theme
---

# Goal
Convert design-token VALUES into a Material 3 `ThemeData` pair (light and dark), including `ColorScheme`, `TextTheme`, spacing/shape extensions, and a theme-mode provider.

# Inputs
```yaml
design_tokens:                       # from design-tokens-generator (shared single source of truth)
  color_scales:                      # raw palettes, 50..950 steps; values are HSL channel triplets
    primary:  { 500: "243 75% 59%", 600: "243 75% 52%" }
    neutral:  { 50: "0 0% 98%", 900: "0 0% 9%" }
  semantic:                          # semantic tokens referencing the scales (shadcn convention)
    primary: "243 75% 59%"
    background: "0 0% 100%"
    foreground: "0 0% 9%"
    muted: "0 0% 96%"
    border: "0 0% 90%"
    destructive: "0 72% 51%"
  typography_scale: { fontFamily: Inter, sizes: { body: 14, title: 20, headline: 28 } }
  radius_scale: { sm: 8, md: 12, lg: 16 }
  spacing_scale: { xs: 4, sm: 8, md: 16, lg: 24 }
  # globals.css (:root/.dark CSS vars) + the tailwind.config fragment are WEB targets —
  # mobile consumes the scale/semantic VALUES above, not those files.
```

# Output
```yaml
flutter_theme:
  files:
    - lib/theme/app_theme.dart
    - lib/theme/app_spacing.dart
    - lib/theme/theme_provider.dart
```

# Workflow
## Step 1 — Adapt design-tokens to Flutter
Convert the shared token model to Dart: parse HSL channel triplets (e.g. `243 75% 59%`) into
`Color`, pick the seed from `semantic.primary` (or `color_scales.primary.500`), and map the
semantic tokens (`primary`/`background`/`foreground`/`muted`/`border`/`destructive`) to
`ColorScheme` roles. The CSS variables and Tailwind fragment are not consumed (web-only).

## Step 2 — Color scheme
Build light/dark `ColorScheme` from the adapted seed/semantic colors (`ColorScheme.fromSeed` with
brightness, overriding roles from the mapped semantic tokens).

## Step 3 — Typography & shape
Map `typography_scale` to a `TextTheme` and `radius_scale`/`spacing_scale` to shape and a
`ThemeExtension` for spacing.

## Step 4 — Assemble
Compose `ThemeData(useMaterial3: true, ...)` for both brightnesses and expose a `themeModeProvider`.

## Step 5 — Implement
Delegate the ThemeData construction to `flutter-senior-programmer`.

# Rules
- Consume the shared `design_tokens` scale/semantic VALUES; parse HSL channel triplets into `Color`. The `:root`/`.dark` CSS variables and the Tailwind fragment are web-only — do NOT import or translate React theme code. This is the Flutter analogue of `web/theme-generator`.
- Always `useMaterial3: true`; provide both light and dark themes.
- Screens/widgets read this theme via `Theme.of(context)`; never hard-code colors elsewhere.

# Examples
Input:
```yaml
design_tokens: { semantic: { primary: "243 75% 59%" }, typography_scale: { fontFamily: Inter } }
```
Output:
```yaml
flutter_theme:
  files:
    - lib/theme/app_theme.dart
    - lib/theme/app_spacing.dart
    - lib/theme/theme_provider.dart
```
```dart
// lib/theme/app_theme.dart (abridged)
// seed converted from semantic.primary (HSL "243 75% 59%") -> Color
const _seed = Color(0xFF5048E5);
ThemeData buildLightTheme() => ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(seedColor: _seed),
  textTheme: const TextTheme().apply(fontFamily: 'Inter'),
);
ThemeData buildDarkTheme() => ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(seedColor: _seed, brightness: Brightness.dark),
  textTheme: const TextTheme().apply(fontFamily: 'Inter'),
);
```
