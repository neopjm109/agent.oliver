---
name: desktop-packaging-generator
description: Generate per-OS native bundles and installers (macOS dmg, Windows msi/nsis, Linux AppImage/deb) with app metadata; produces native installers, never containers.
version: 1.0.0
category: frontend
tags:
  - tauri
  - packaging
  - installer
  - dmg
  - msi
  - appimage
model: inherit
invokes: []
inputs:
  - target_os_list
  - app_metadata
outputs:
  - desktop_bundles
---

# Goal

Produce native, distributable installers for each target OS from the Tauri
project: macOS `.dmg`, Windows `.msi` and/or NSIS `.exe`, and Linux `.AppImage`
and/or `.deb`. Configures bundle metadata (icons, categories, licenses) and the
CI matrix that builds them.

# Inputs

```yaml
target_os_list: [macos, windows, linux]
app_metadata:
  product_name: TaskDeck
  version: 1.4.0
  publisher: Aton Corp
  category: Productivity
  icons: [src-tauri/icons/32x32.png, 128x128.png, icon.icns, icon.ico]
  license: MIT
  formats:
    macos: [dmg]
    windows: [msi, nsis]
    linux: [appimage, deb]
```

# Output

```yaml
desktop_bundles:
  - src-tauri/tauri.conf.json (bundle block)
  - .github/workflows/build.yml (OS build matrix)
  - dist/TaskDeck_1.4.0_aarch64.dmg
  - dist/TaskDeck_1.4.0_x64_en-US.msi
  - dist/TaskDeck_1.4.0_amd64.AppImage
```

# Workflow

## Step 1 — Configure bundle metadata
Patch `tauri.conf.json > bundle` with product name, version, publisher, category,
icons, license, and the requested `targets` per OS.

## Step 2 — Per-OS installer settings
Add macOS dmg layout, Windows wix/nsis options, and Linux deb dependencies.

## Step 3 — CI build matrix
Generate a build workflow with a runner per OS
(`macos-latest`, `windows-latest`, `ubuntu-latest`) invoking `tauri build`.

## Step 4 — Verify artifacts
Confirm each requested format is emitted under `dist/` with the version in its name.

# Rules

- Produce native installers only — NO Docker/OCI containers (containers belong to
  the `deployment/*` domain, not desktop).
- Icons must cover every platform (png set, `.icns`, `.ico`).
- Bundle version must match `app_metadata.version` and the release version.
- Signing/notarization itself is owned by `desktop-updater-generator`; reference
  its config, do not duplicate it here.

# Examples

Input:

```yaml
target_os_list: [macos, windows]
app_metadata:
  product_name: TaskDeck
  version: 1.4.0
  formats: { macos: [dmg], windows: [msi] }
```

Output:

```jsonc
// src-tauri/tauri.conf.json
{
  "bundle": {
    "active": true,
    "targets": ["dmg", "msi"],
    "publisher": "Aton Corp",
    "category": "Productivity",
    "icon": ["icons/128x128.png", "icons/icon.icns", "icons/icon.ico"]
  }
}
```

```yaml
# .github/workflows/build.yml (excerpt)
strategy:
  matrix:
    include:
      - { os: macos-latest,   target: dmg }
      - { os: windows-latest, target: msi }
steps:
  - run: pnpm --dir web build
  - run: cargo tauri build --bundles ${{ matrix.target }}
# -> dist/TaskDeck_1.4.0_aarch64.dmg, dist/TaskDeck_1.4.0_x64_en-US.msi
```
