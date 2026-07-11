---
name: desktop-storage-generator
description: Generate local desktop persistence via a Tauri store/fs/sqlite plugin with typed access wrappers; local-only data, server data still goes through the backend API.
version: 1.0.0
category: frontend
tags:
  - tauri
  - storage
  - sqlite
  - persistence
  - local
model: inherit
invokes:
  - typescript-senior-programmer
inputs:
  - storage_requirements
outputs:
  - desktop_storage
---

# Goal

Generate local persistence for the desktop app — settings, cache, and offline
records — using the appropriate Tauri plugin (`tauri-plugin-store` for
key/value, `tauri-plugin-sql` for relational, `tauri-plugin-fs` for files), plus
typed TypeScript accessors for the reused frontend.

# Inputs

```yaml
storage_requirements:
  settings:  { engine: store, keys: [theme, window_bounds, last_project] }
  offline_tasks:
    engine: sqlite
    table: tasks
    columns: [id TEXT PRIMARY KEY, title TEXT, done INTEGER, synced INTEGER]
  attachments: { engine: fs, dir: "$APPDATA/attachments" }
```

# Output

```yaml
desktop_storage:
  - src-tauri/migrations/0001_init.sql
  - src-tauri/tauri.conf.json (plugins.sql patch)
  - src-tauri/capabilities/default.json (store/sql/fs permissions)
  - web/lib/storage/settings.ts
  - web/lib/storage/tasks.repo.ts
```

# Workflow

## Step 1 — Select engines
Map each requirement to a plugin: key/value → store, relational → sql, blobs → fs.

## Step 2 — Define schema/migrations
For sqlite, generate ordered migration SQL and register it with the sql plugin.

## Step 3 — Typed accessors
Delegate to `typescript-senior-programmer`: generate typed `settings.ts` and
repository modules wrapping the plugin APIs.

## Step 4 — Permissions
Add store/sql/fs permissions (and scoped paths) to `capabilities/default.json`.

# Rules

- Local-only persistence: settings, cache, and offline copies of data.
- Server-authoritative data is still fetched/mutated through the backend API via
  the reused frontend `api-client` — do NOT treat local storage as the source of
  truth for server data.
- File paths use Tauri path variables (`$APPDATA`, `$APPCONFIG`), never absolutes.
- One migration file per schema change; migrations are append-only.

# Examples

Input:

```yaml
storage_requirements:
  settings: { engine: store, keys: [theme, last_project] }
  offline_tasks:
    engine: sqlite
    table: tasks
    columns: [id TEXT PRIMARY KEY, title TEXT, done INTEGER, synced INTEGER]
```

Output:

```sql
-- src-tauri/migrations/0001_init.sql
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, done INTEGER DEFAULT 0, synced INTEGER DEFAULT 0
);
```

```ts
// web/lib/storage/tasks.repo.ts
import Database from "@tauri-apps/plugin-sql";
const db = await Database.load("sqlite:app.db");

export const listOfflineTasks = () =>
  db.select<{ id: string; title: string; done: number }[]>("SELECT * FROM tasks");
export const upsertTask = (t: { id: string; title: string; done: number }) =>
  db.execute(
    "INSERT INTO tasks (id,title,done,synced) VALUES ($1,$2,$3,0) " +
    "ON CONFLICT(id) DO UPDATE SET title=$2, done=$3, synced=0",
    [t.id, t.title, t.done],
  );
// Authoritative sync still happens via web/features/tasks/api (backend API).
```
