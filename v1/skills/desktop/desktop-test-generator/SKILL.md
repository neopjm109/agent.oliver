---
name: desktop-test-generator
description: Generate desktop tests — WebDriver/tauri-driver end-to-end specs against the packaged app plus Rust unit tests for bridge command handlers.
version: 1.0.0
category: frontend
tags:
  - tauri
  - testing
  - webdriver
  - tauri-driver
  - e2e
model: inherit
invokes:
  - typescript-senior-programmer
inputs:
  - desktop_artifacts
outputs:
  - desktop_tests
---

# Goal

Generate tests that validate the native layer of the desktop app: WebDriver
end-to-end specs driven by `tauri-driver` (window launch, menu/tray, deep links,
native flows) and Rust unit tests for the `#[tauri::command]` bridge handlers.

# Inputs

```yaml
desktop_artifacts:
  scaffold: <from tauri-initializer>
  shell:    <from desktop-shell-generator>
  bridge:   <from native-bridge-generator>   # commands to unit-test
  storage:  <from desktop-storage-generator>
  updater:  <from desktop-updater-generator>
  bundles:  <from desktop-packaging-generator>
```

# Output

```yaml
desktop_tests:
  - tests/e2e/wdio.conf.ts
  - tests/e2e/app.launch.e2e.ts
  - tests/e2e/deep-link.e2e.ts
  - src-tauri/src/commands/fs_test.rs
  - .github/workflows/test.yml (tauri-driver job)
```

# Workflow

## Step 1 — Bridge unit tests (Rust)
For each command in `bridge`, generate a `#[cfg(test)]` module asserting success
and error paths (e.g. missing file → `Err`).

## Step 2 — E2E harness
Configure `wdio.conf.ts` to launch the built binary through `tauri-driver`.

## Step 3 — E2E specs
Delegate to `typescript-senior-programmer`: generate specs for window launch,
menu/tray actions, and deep-link routing from `shell`.

## Step 4 — CI job
Add a `test.yml` job installing `tauri-driver` + WebKitWebDriver and running both
suites.

# Rules

- Cover the native layer only; frontend component/unit tests are owned by
  `frontend-test-generator` — do not duplicate them here.
- E2E must drive the packaged binary via `tauri-driver`, not a browser dev server.
- Every bridge command needs at least one success and one failure unit test.
- Tests must run headless in CI (Linux `xvfb` for WebKitWebDriver).

# Examples

Input:

```yaml
desktop_artifacts:
  bridge: { commands: [read_note, write_note] }
  shell:  { deep_link: { scheme: taskdeck } }
```

Output:

```rust
// src-tauri/src/commands/fs_test.rs
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn read_note_missing_file_errors() {
        assert!(read_note("/no/such/file".into()).is_err());
    }
}
```

```ts
// tests/e2e/deep-link.e2e.ts
describe("deep link", () => {
  it("routes taskdeck://task/123 to the task view", async () => {
    await browser.execute("window.location.href = 'taskdeck://task/123'");
    await expect($("[data-testid='task-detail-123']")).toBeDisplayed();
  });
});
```
