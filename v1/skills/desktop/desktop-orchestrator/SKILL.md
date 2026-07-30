---
name: desktop-orchestrator
description: Entry point for the desktop domain — turns an application blueprint into a Tauri desktop app by wrapping the existing React/Next.js frontend with a native shell; delegates to every desktop sub-skill and never generates code itself.
version: 1.0.0
category: frontend
tags:
  - tauri
  - desktop
  - orchestrator
  - rust
model: inherit
invokes:
  - tauri-initializer
  - desktop-shell-generator
  - native-bridge-generator
  - desktop-storage-generator
  - desktop-updater-generator
  - desktop-packaging-generator
  - desktop-test-generator
inputs:
  - application_blueprint
  - design_system
  - frontend_artifacts
  - options
outputs:
  - desktop_artifacts
---

# Goal

Produce a complete Tauri desktop application by orchestrating the desktop
sub-skills. This orchestrator delegates only — it generates no code itself. It
reuses the already-generated `web/*` React output and `design/*` tokens as
the Tauri webview content, then adds the native shell, IPC bridge, local
storage, auto-updater, packaging, and tests around it.

# Inputs

```yaml
application_blueprint:
  app_name: TaskDeck
  bundle_id: com.aton.taskdeck
  capabilities: [fs, dialog, notifications]
design_system:
  tokens_ref: design/tokens.json
frontend_artifacts:
  build_dir: web/out          # static export consumed by Tauri
  api_client: web/features/*/api
options:
  target_os: [macos, windows, linux]
  auto_update: true
```

# Output

```yaml
desktop_artifacts:
  scaffold: <from tauri-initializer>
  shell: <from desktop-shell-generator>
  bridge: <from native-bridge-generator>
  storage: <from desktop-storage-generator>
  updater: <from desktop-updater-generator>
  bundles: <from desktop-packaging-generator>
  tests: <from desktop-test-generator>
```

# Workflow

## Step 1 — Scaffold Tauri
Invoke `tauri-initializer` with `target_stack` + `frontend_artifacts` to create
`src-tauri/` and wire the existing web build as the Tauri frontend.

## Step 2 — Generate native shell
Invoke `desktop-shell-generator` (window, menu, tray, deep links, single-instance).

## Step 3 — Generate native bridge
Invoke `native-bridge-generator` for the Tauri command IPC layer.

## Step 4 — Generate local storage
Invoke `desktop-storage-generator` for local persistence.

## Step 5 — Generate updater
Invoke `desktop-updater-generator` for auto-update + code-signing config.

## Step 6 — Generate packaging
Invoke `desktop-packaging-generator` for per-OS installers.

## Step 7 — Generate tests
Invoke `desktop-test-generator`, passing the aggregated `desktop_artifacts`.

# Rules

- Delegate only; never emit code from this skill.
- Reuse the `web/*` React output as the webview — do NOT regenerate UI
  here; UI belongs to the `web/*` and `design/*` domains.
- Only wrap the existing frontend with the native shell and native services.
- Run steps in order; each step consumes prior outputs (scaffold before all).

# Examples

Input:

```yaml
application_blueprint:
  app_name: TaskDeck
  bundle_id: com.aton.taskdeck
  capabilities: [fs, notifications]
frontend_artifacts:
  build_dir: web/out
options:
  target_os: [macos, windows]
  auto_update: true
```

Output:

```
desktop_artifacts:
  scaffold:  src-tauri/ (Cargo.toml, tauri.conf.json → frontendDist: ../web/out)
  shell:     src-tauri/src/menu.rs, tray.rs, deep_link setup
  bridge:    src-tauri/src/commands/fs.rs + web/lib/native/bridge.ts
  storage:   tauri-plugin-store store.bin wrapper
  updater:   tauri.conf.json > plugins.updater (endpoints + pubkey)
  bundles:   TaskDeck.dmg, TaskDeck_x64-setup.exe
  tests:     tests/e2e/*.ts (tauri-driver), src-tauri/src/commands/*_test.rs
```
