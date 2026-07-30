---
name: desktop-shell-generator
description: Generate the native desktop shell around the reused web frontend — window configuration, native menu, system tray, and OS integration (deep links, single-instance).
version: 1.0.0
category: frontend
tags:
  - tauri
  - shell
  - menu
  - tray
  - deep-link
model: inherit
invokes:
  - typescript-senior-programmer
inputs:
  - ux_flows
  - tauri_scaffold
outputs:
  - desktop_shell
---

# Goal

Generate the native shell that surrounds the reused web frontend: window sizing
and behavior, a native application menu, a system tray, and OS integration such
as deep-link (custom URL scheme) handling and single-instance enforcement. No
in-window UI is produced — that is the frontend's webview content.

# Inputs

```yaml
ux_flows:
  primary_window: { min_width: 900, min_height: 600, resizable: true }
  menus:
    - { label: File, items: [New Task, Import…, Quit] }
    - { label: Edit, items: [Undo, Redo, Cut, Copy, Paste] }
  tray: { enabled: true, actions: [Show, Quit] }
  deep_link: { scheme: taskdeck }   # taskdeck://task/123
  single_instance: true
tauri_scaffold: <from tauri-initializer>
```

# Output

```yaml
desktop_shell:
  - src-tauri/src/menu.rs
  - src-tauri/src/tray.rs
  - src-tauri/src/deep_link.rs
  - tauri.conf.json (window + plugins patch)
  - web/lib/native/deep-link-router.ts
```

# Workflow

## Step 1 — Configure the window
Patch `tauri.conf.json` window block from `ux_flows.primary_window`
(min size, resizable, decorations, title).

## Step 2 — Build native menu + tray
Generate `menu.rs` and `tray.rs`; map each menu/tray item to an event id emitted
to the webview.

## Step 3 — OS integration
Add `tauri-plugin-deep-link` and `tauri-plugin-single-instance`; on second launch
focus the existing window and forward the deep-link URL.

## Step 4 — Frontend routing glue
Delegate to `typescript-senior-programmer` for a `deep-link-router.ts` that maps
incoming URLs to existing frontend routes.

# Rules

- Wrap the existing frontend only; generate no page/component UI (that is
  `web/*`).
- Menu/tray items emit events to the webview; do not embed business logic in Rust.
- Deep-link routing must reuse existing frontend routes, not create new screens.
- Native capabilities invoked by menu items go through `native-bridge-generator`,
  not ad-hoc Rust here.

# Examples

Input:

```yaml
ux_flows:
  primary_window: { min_width: 900, min_height: 600 }
  tray: { enabled: true, actions: [Show, Quit] }
  deep_link: { scheme: taskdeck }
  single_instance: true
```

Output:

```rust
// src-tauri/src/tray.rs
use tauri::{tray::TrayIconBuilder, menu::{Menu, MenuItem}, Manager};

pub fn build_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;
    TrayIconBuilder::new()
        .menu(&menu)
        .on_menu_event(|app, e| match e.id.as_ref() {
            "show" => { let _ = app.get_webview_window("main").map(|w| w.show()); }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;
    Ok(())
}
```

```ts
// web/lib/native/deep-link-router.ts
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { router } from "@/app/router";

// taskdeck://task/123  ->  /tasks/123
export const initDeepLinks = () =>
  onOpenUrl((urls) => urls.forEach((u) =>
    router.push(new URL(u).pathname.replace("//task", "/tasks"))));
```
