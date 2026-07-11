---
name: native-bridge-generator
description: Generate the Tauri command IPC layer — Rust #[tauri::command] handlers for native capabilities plus typed JS invoke wrappers — bridging the reused frontend to the OS.
version: 1.0.0
category: frontend
tags:
  - tauri
  - ipc
  - rust
  - invoke
  - bridge
model: inherit
invokes:
  - typescript-senior-programmer
inputs:
  - capability_needs
  - tauri_scaffold
outputs:
  - native_bridge
---

# Goal

Generate the IPC bridge between the reused frontend and the OS: Rust
`#[tauri::command]` handlers for native capabilities, their capability
permissions, and matching typed TypeScript `invoke` wrappers so the frontend
calls native features type-safely.

# Inputs

```yaml
capability_needs:
  fs: { read: true, write: true, scope: ["$APPDATA/**"] }
  dialog: { open: true, save: true }
  notifications: true
  shell: { open_external: true }
tauri_scaffold: <from tauri-initializer>
```

# Output

```yaml
native_bridge:
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/commands/fs.rs
  - src-tauri/capabilities/default.json (permissions)
  - web/lib/native/bridge.ts (typed invoke wrappers)
  - web/lib/native/types.ts
```

# Workflow

## Step 1 — Map capabilities to commands
For each entry in `capability_needs`, define a `#[tauri::command]` and register it
in `commands/mod.rs` via `invoke_handler(tauri::generate_handler![...])`.

## Step 2 — Grant permissions
Add the corresponding permissions (and fs scopes) to
`capabilities/default.json` — least-privilege only.

## Step 3 — Typed JS wrappers
Delegate to `typescript-senior-programmer`: generate `bridge.ts` exporting typed
functions wrapping `invoke("...")`, with shared arg/return types in `types.ts`.

## Step 4 — Verify
Confirm each command has a matching wrapper and a permission entry.

# Rules

- The bridge covers native capabilities only: fs, dialog, notifications, shell.
- HTTP calls to the backend still go through the reused frontend `api-client`,
  NOT through the bridge — do not create backend-proxy commands here.
- Every command must have a least-privilege permission entry; no wildcard fs scope.
- Command names use snake_case (Rust); wrappers use camelCase (TS).

# Examples

Input:

```yaml
capability_needs:
  fs: { read: true, write: true, scope: ["$APPDATA/**"] }
  notifications: true
```

Output:

```rust
// src-tauri/src/commands/fs.rs
#[tauri::command]
pub fn read_note(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_note(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}
```

```ts
// web/lib/native/bridge.ts
import { invoke } from "@tauri-apps/api/core";

export const readNote  = (path: string) => invoke<string>("read_note", { path });
export const writeNote = (path: string, contents: string) =>
  invoke<void>("write_note", { path, contents });
// Backend data is NOT fetched here — use web/features/*/api (api-client).
```
