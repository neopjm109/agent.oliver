---
name: theme-generator
description: Generate a Next.js theming runtime — theme provider, theme switcher, persistence, and system preference detection over design tokens.
version: 1.0.0
category: frontend
tags:
  - nextjs
  - react
  - theme
  - dark-mode
  - next-themes
model: inherit
invokes:
  - typescript-senior-programmer
inputs:
  - theme_requirements
outputs:
  - theme_code
---

# Goal

Generate the runtime theming layer for a Next.js app: a theme provider, a theme switcher
component, persistence, and system color-scheme detection, consuming the light/dark CSS
variables produced by `design-tokens-generator`. This skill owns the **runtime provider/switcher
wiring**; the token *values* (light/dark palettes) are owned by `design-tokens-generator`.

# Inputs

```yaml
theme_requirements:
  library: next-themes
  modes: [light, dark, system]
  default: system
  persist: true               # localStorage
  attribute: class            # class | data-theme
```

# Output

```yaml
theme_code:
  - ThemeProvider (wraps root layout, hydration-safe)
  - ThemeSwitcher component (toggle/select)
  - useTheme re-export / helper
  - html attribute wiring (suppressHydrationWarning)
```

# Workflow

## Step 1 — Set up the provider
Wrap the root layout with a hydration-safe theme provider bound to the token attribute (class/data-theme).

## Step 2 — Build the switcher
Create a switcher (toggle or select) covering light/dark/system with accessible labels.

## Step 3 — Persist and detect
Enable persistence and system-preference detection with a sensible default.

## Step 4 — Delegate implementation
Delegate the provider, switcher, and wiring to `typescript-senior-programmer`.

# Rules

- Own the runtime provider/switcher only; light/dark token *values* belong to `design-tokens-generator`.
- Theme must be hydration-safe — avoid a flash of wrong theme (set attribute before paint, `suppressHydrationWarning`).
- Switch by toggling the token attribute (`class`/`data-theme`); never hardcode colors in components.
- Respect `prefers-color-scheme` for the `system` mode; persist explicit user choice.
- Provide accessible controls (labels, keyboard operable) in the switcher.

# Examples

Input:

```yaml
theme_requirements:
  library: next-themes
  modes: [light, dark, system]
  default: system
  attribute: class
```

Output (abridged):

```tsx
// components/providers/theme-provider.tsx
"use client";
import { ThemeProvider as NextThemes } from "next-themes";
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemes>
  );
}

// components/theme-switcher.tsx
"use client";
import { useTheme } from "next-themes";
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <button aria-label="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      Toggle
    </button>
  );
}
```
