# SQLite Migration (v1.24.1+)

## Why SQLite

Before v1.24.1, project state lived in ~10 JSON files under
`~/.prjct-cli/projects/{projectId}/storage/` (`state.json`, `queue.json`,
`ideas.json`, `shipped.json`, `metrics.json`, `velocity.json`, `analysis.json`,
`roadmap.json`, `session.json`, `issues.json`) plus JSONL event streams and
several JSON index files.

Problems with that layout:
- **Partial writes.** A crash mid-`writeFile` left half-written JSON.
- **Concurrency.** Two commands running in parallel could race.
- **Query cost.** Reading `shipped.json` to find one entry meant parsing
  the whole file.
- **Integrity.** No schema enforcement at the storage layer.

SQLite fixes all of these:
- Atomic transactions and WAL mode for concurrent reads during writes.
- Indexed queries instead of full-file scans.
- Schema constraints at the storage layer.
- One file per project: `~/.prjct-cli/projects/{projectId}/prjct.db`.

## What the migration does

`core/storage/migrate-json.ts` runs once per project, the first time a
`StorageManager` is accessed after the upgrade. The entry point is
`migrateJsonToSqlite(projectId)`.

1. **Skip check.** If `prjct.db` already exists and has a row in `kv_store`
   for `state`, exit early — the migration has already run.
2. **Backup.** Copy everything under `storage/`, `index/`, and `memory/` to
   `storage/backup/<timestamp>/` so the original JSON files are preserved.
3. **Initialize DB.** Open (or create) `prjct.db`, run migrations, enable WAL.
4. **Storage files → `kv_store` + normalized tables.** Each JSON file is
   inserted as a single row in `kv_store` (for backward-compatible reads),
   and also parsed into normalized tables for indexed queries.
5. **Events.** `events.jsonl` is streamed into the `events` table.
6. **Indexes.** `project-index.json`, `domains.json`, `categories-cache.json`
   are inserted into `index_meta`.

The migration is **idempotent**: running it on a project that already
migrated is a no-op (step 1).

## Inspecting the database

```bash
# Open a project's database
sqlite3 ~/.prjct-cli/projects/{projectId}/prjct.db

# List tables
.tables

# Example: find the current task
sqlite> SELECT json_extract(value, '$.currentTask.description')
   ...> FROM kv_store
   ...> WHERE key = 'state';

# Example: count events since a given date
sqlite> SELECT COUNT(*)
   ...> FROM events
   ...> WHERE timestamp > '2026-01-01T00:00:00Z';

# Schema
sqlite> .schema kv_store
sqlite> .schema events
```

The canonical schema lives in `core/storage/database.ts`. Migrations are
applied on first connection via the same file.

## Rules

- **Never** `fs.readFile` or `fs.writeFile` against the legacy JSON paths.
  They may exist on disk as backups or from users still on an older CLI,
  but they are not the source of truth.
- **Always** go through the `prjct` CLI or a `*-storage.ts` module. Storage
  modules handle JSON ↔ SQLite translation, validation, and event emission.
- **Do not edit `prjct.db` directly** while the CLI or daemon is running.
  SQLite supports concurrent reads but writing from outside the CLI can
  corrupt WAL state.

## Troubleshooting

### The migration didn't run

Check whether `prjct.db` exists:

```bash
ls -la ~/.prjct-cli/projects/{projectId}/prjct.db
```

If missing, run any CLI command (`prjct status`) to trigger migration on
next access. If present but empty, the skip check may have false-positived —
see below.

### Force re-migration

```bash
# 1. Back up current DB (just in case)
mv ~/.prjct-cli/projects/{projectId}/prjct.db \
   ~/.prjct-cli/projects/{projectId}/prjct.db.bak

# 2. Re-run the CLI; migration will re-run from the legacy JSON files
prjct status
```

The legacy JSON files remain under `storage/` after the first migration
because of the backup step — nothing is deleted, just copied.

### Corrupted database

SQLite WAL mode is crash-safe, but if the DB ever gets into a bad state:

```bash
# Run the built-in integrity check
sqlite3 ~/.prjct-cli/projects/{projectId}/prjct.db "PRAGMA integrity_check;"
```

If it reports corruption, delete the DB and re-run the CLI — the migration
will rebuild it from the backed-up JSON files under `storage/backup/`.

### Lost legacy JSON

If you need to revert a project to JSON (e.g. to debug migration output),
the backup created on first migration lives at
`~/.prjct-cli/projects/{projectId}/storage/backup/<timestamp>/`. Copy the
files back into `storage/`, delete `prjct.db`, and re-run the CLI.

## Tests

Migration correctness and SQLite integration are tested end-to-end in
`core/__tests__/storage/sqlite-migration.test.ts`. The suite covers:

- Idempotency (re-running leaves state unchanged).
- Concurrent access (multiple readers + one writer, WAL mode).
- Graceful degradation when individual JSON files are missing or malformed.
- `StorageManager` + `IndexStorage` round-trips.

Run: `bun test core/__tests__/storage/sqlite-migration.test.ts`.
