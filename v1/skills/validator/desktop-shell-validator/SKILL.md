---
name: desktop-shell-validator
description: Validate the generated Tauri desktop shell (Rust) that wraps the web client — frontendDist points at the web export, every native IPC command is registered and permission-scoped, bundle identifier/version are consistent, packaging targets and referenced assets exist, CSP is set, and the shell reuses the web API client rather than re-implementing it — returning a structured pass/fail result. Run after desktop generation, before review. Validates the native shell only; React UI conformance is owned by frontend-validator.
version: 1.0.0
category: validator
tags:
  - validation
  - desktop
  - tauri
  - rust
model: inherit
invokes: []
inputs:
  - generated_desktop_artifacts
  - generated_frontend_artifacts
  - application_blueprint
  - options
outputs:
  - validation_result
---

# Goal

Statically validate the generated Tauri desktop shell against the app blueprint and the web
client it wraps. This skill **only analyzes** — it never modifies code. Findings are reported for
the remediation loop.

Tauri reuses the already-generated `web/*` React output as its webview content, so the **React UI
is out of scope here** — that conformance is owned by `frontend-validator`. This validator covers
the parts no other gate checks: the Rust/Tauri shell, `tauri.conf.json`, IPC bridge, capabilities,
packaging, and the shell↔web wiring. It closes the gap where the desktop native layer had no gate.

# Inputs

Validated inputs (produced upstream): `generated_desktop_artifacts` (`src-tauri/**`),
`generated_frontend_artifacts` (the web client the shell wraps), `application_blueprint`
(app identity / bundle id), `options` (`target_os`).

# Scope

- Shell↔web wiring (`frontendDist`/`devUrl` resolve to the generated web client)
- IPC bridge integrity (every `#[tauri::command]` registered + permission-scoped)
- Identity/version consistency across `tauri.conf.json` and `Cargo.toml`
- Packaging completeness (targets for requested OSes; referenced bundle assets exist)
- Shell security posture (CSP present; capabilities not over-broad)
- No duplicated API layer in the shell; desktop test actually exercises the shell

Out of scope: React/Next UI (see `frontend-validator`), deep OWASP review (see `security-validator`),
runtime `cargo build`.

# Checks

| id | check | severity |
|----|-------|----------|
| DK-01 | `tauri.conf.json` `frontendDist` (and `devUrl`) resolve to the generated web client's export/dev server, not a dangling path | error |
| DK-02 | Every `#[tauri::command]` is registered in `invoke_handler`, and every invoked command is granted in a capability/permission file | error |
| DK-03 | Bundle identifier and app version are consistent across `tauri.conf.json` and `Cargo.toml` (no drift) | error |
| DK-04 | Packaging targets exist for every `options.target_os`, and every asset the bundle references (icons, resources) exists in the artifacts | error |
| DK-05 | A Content-Security-Policy is set (`security.csp` not null) and capabilities are not wildcard/over-broad when wrapping HTTP content | warning |
| DK-06 | The shell does not re-implement the API layer — server calls reuse the web API client; no duplicate HTTP client in Rust | warning |
| DK-07 | The desktop test exercises the shell/IPC (invokes a command or launches the app), not only static config assertions | warning |

# Pass/Fail Criteria

- **pass**: zero `error`-severity findings.
- **fail**: one or more `error` findings. `warning` findings do not fail the run but are reported.

# Output Schema

```yaml
validation_result:
  status: pass | fail
  errors:
    - { id: string, file: string, message: string }
  warnings:
    - { id: string, file: string, message: string }
  metrics:
    checked_commands: int
    checked_files: int
    error_count: int
    warning_count: int
```

# Rules

- Analyze only; never modify code (remediation is a separate stage).
- Validate the native shell + config only; do not re-validate the React UI (that is `frontend-validator`).
- Defer deep security analysis to `security-validator`; DK-05 flags only shell-level CSP/capability posture.
- Judge against the blueprint, the wrapped web artifacts, and `options`, not assumptions.
- Deterministic verdict: any `error` finding forces `fail`.

# Examples

Input: generated Tauri shell for `OrderDesk` wrapping the web client at `generated-web/out`;
`options.target_os: [macos, windows, linux]`.

Output:

```yaml
validation_result:
  status: fail
  errors:
    - { id: DK-04, file: src-tauri/tauri.conf.json, message: "bundle.icon references icons/icon.icns but no icon assets were generated" }
    - { id: DK-01, file: src-tauri/tauri.conf.json, message: "frontendDist '../../generated-web/out' — web export not configured (Next output:export missing)" }
  warnings:
    - { id: DK-05, file: src-tauri/tauri.conf.json, message: "security.csp is null while wrapping HTTP content" }
    - { id: DK-07, file: src-tauri/tests/smoke.rs, message: "test asserts config only; never invokes the app_version command" }
  metrics: { checked_commands: 1, checked_files: 6, error_count: 2, warning_count: 2 }
```
