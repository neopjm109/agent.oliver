---
name: desktop-updater-generator
description: Generate Tauri auto-update configuration and code-signing setup — updater endpoint, signing keys, and per-OS signing config for secure delivery of new releases.
version: 1.0.0
category: frontend
tags:
  - tauri
  - updater
  - code-signing
  - release
model: inherit
invokes:
  - typescript-senior-programmer
inputs:
  - release_channel
  - signing_config
outputs:
  - desktop_updater
---

# Goal

Configure secure auto-updates for the desktop app: the Tauri updater plugin
pointed at a release endpoint, the update-signature public key, and per-OS
code-signing so installers and updates are trusted by each platform.

# Inputs

```yaml
release_channel:
  name: stable
  endpoint: https://releases.aton.com/taskdeck/{{target}}/{{arch}}/{{current_version}}
  pubkey_ref: env:TAURI_UPDATER_PUBKEY
signing_config:
  macos:  { identity: "Developer ID Application: Aton Corp (TEAMID)", notarize: true }
  windows:{ certificate: env:WIN_CERT_THUMBPRINT, timestamp_url: http://timestamp.digicert.com }
  linux:  { gpg_key: env:LINUX_GPG_KEY }
```

# Output

```yaml
desktop_updater:
  - src-tauri/tauri.conf.json (plugins.updater + bundle signing)
  - src-tauri/capabilities/default.json (updater permission)
  - web/lib/native/updater.ts (check/install flow)
  - .github/workflows/release.yml (sign + publish)
```

# Workflow

## Step 1 — Configure the updater plugin
Set `plugins.updater.endpoints` to the templated `endpoint` and `pubkey` to the
minisign public key; add the updater permission to capabilities.

## Step 2 — Per-OS code signing
Patch the `bundle` config with macOS signing/notarization, Windows certificate,
and Linux GPG settings from `signing_config`; read secrets from env, never inline.

## Step 3 — Update UX glue
Delegate to `typescript-senior-programmer`: generate `updater.ts` that checks,
downloads, and installs updates and surfaces progress to the reused frontend UI.

## Step 4 — CI release job
Generate a release workflow that builds, signs, generates the update signature,
and publishes artifacts + `latest.json` to the endpoint.

# Rules

- Never commit private signing keys or passwords; reference env/CI secrets only.
- Update artifacts must be minisign-signed; the pubkey ships in the app config.
- Endpoint templates must include `{{target}}`, `{{arch}}`, and `{{current_version}}`.
- Update prompt UI reuses the existing frontend components — no new UI here.

# Examples

Input:

```yaml
release_channel:
  endpoint: https://releases.aton.com/taskdeck/{{target}}/{{arch}}/{{current_version}}
  pubkey_ref: env:TAURI_UPDATER_PUBKEY
signing_config:
  macos: { identity: "Developer ID Application: Aton Corp (TEAMID)", notarize: true }
```

Output:

```jsonc
// src-tauri/tauri.conf.json
{
  "plugins": {
    "updater": {
      "endpoints": ["https://releases.aton.com/taskdeck/{{target}}/{{arch}}/{{current_version}}"],
      "pubkey": "${TAURI_UPDATER_PUBKEY}"
    }
  },
  "bundle": { "macOS": { "signingIdentity": "Developer ID Application: Aton Corp (TEAMID)" } }
}
```

```ts
// web/lib/native/updater.ts
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export async function runUpdateCheck() {
  const update = await check();
  if (update) { await update.downloadAndInstall(); await relaunch(); }
}
```
