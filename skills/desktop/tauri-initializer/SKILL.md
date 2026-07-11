---
name: tauri-initializer
description: Scaffold a Tauri project (Rust core in src-tauri/, tauri.conf.json) and wire the existing web frontend build as the Tauri frontend; produces scaffold only, no feature code.
version: 1.0.0
category: frontend
tags:
  - tauri
  - rust
  - initializer
  - scaffold
model: inherit
invokes:
  - typescript-senior-programmer
inputs:
  - target_stack
  - frontend_artifacts
outputs:
  - tauri_scaffold
---

# Goal

Initialize a runnable Tauri project: the Rust core under `src-tauri/`, a valid
`tauri.conf.json`, and wiring that points the Tauri frontend at the existing web
build. Produces only the scaffold — no shell, bridge, storage, or updater
feature code (those come from the other desktop sub-skills).

# Inputs

```yaml
target_stack:
  tauri: 2
  rust_edition: 2021
  app_name: TaskDeck
  bundle_id: com.aton.taskdeck
frontend_artifacts:
  build_dir: web/out        # static export directory
  dev_url: http://localhost:3000 # dev server for `tauri dev`
```

# Output

```yaml
tauri_scaffold:
  - src-tauri/Cargo.toml
  - src-tauri/tauri.conf.json
  - src-tauri/src/main.rs
  - src-tauri/src/lib.rs
  - src-tauri/build.rs
  - src-tauri/capabilities/default.json
```

# Workflow

## Step 1 — Resolve the Tauri stack
Pin Tauri v2 crate versions and the Rust edition; confirm compatibility with the
frontend build tool.

## Step 2 — Scaffold the Rust core
Create `src-tauri/` with `Cargo.toml`, `main.rs`, `lib.rs`, `build.rs`, and an
empty `capabilities/default.json`. Delegate any TS glue (pnpm scripts, typed
config) to `typescript-senior-programmer`. The wrapped web client uses pnpm (the preferred
package manager for TS/Node skills), so build hooks invoke `pnpm`, not `npm`.

## Step 3 — Wire the web frontend
In `tauri.conf.json` set `build.frontendDist` to the exported `build_dir` and
`build.devUrl` to the dev server; add `beforeBuildCommand` for the frontend build.

## Step 4 — Verify
Confirm `cargo tauri dev` launches the existing web frontend in a native window.

# Rules

- Produce only the scaffold, not feature code — window/menu, IPC, storage,
  updater, and packaging are owned by the other `desktop-*` skills.
- Do NOT generate any UI; the webview loads the reused `web/*` build.
- Point `frontendDist` at the existing build output; never create a new frontend.
- Use Tauri v2 (`capabilities/` permissions model), not v1 allowlist.

# Examples

Input:

```yaml
target_stack: { tauri: 2, app_name: TaskDeck, bundle_id: com.aton.taskdeck }
frontend_artifacts: { build_dir: web/out, dev_url: http://localhost:3000 }
```

Output:

```jsonc
// src-tauri/tauri.conf.json
{
  "productName": "TaskDeck",
  "identifier": "com.aton.taskdeck",
  "build": {
    "frontendDist": "../web/out",
    "devUrl": "http://localhost:3000",
    "beforeBuildCommand": "pnpm --dir ../web build"
  },
  "app": { "windows": [{ "title": "TaskDeck", "width": 1200, "height": 800 }] }
}
```

```rust
// src-tauri/src/lib.rs
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```
