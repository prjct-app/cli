/**
 * SQLite schema migrations for the per-project database.
 *
 * Append-only — never edit a past migration's `up` block (existing
 * databases will be out of sync). New schema changes go in a new
 * migration with the next sequential version number.
 */

import { memoryFingerprint } from '../../memory/content-fingerprint'
import type { Migration } from '../../types/storage/extended'
import { INITIAL_SCHEMA_SQL } from './initial-schema.sql'
import type { SqliteDatabase } from './sqlite-compat'

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial-schema',
    up: (db: SqliteDatabase) => {
      db.run(INITIAL_SCHEMA_SQL)
    },
  },
  {
    version: 2,
    name: 'archives-table',
    up: (db: SqliteDatabase) => {
      db.run(`
        -- =======================================================================
        -- Archives: Stale data moved out of active storage (PRJ-267)
        -- =======================================================================
        CREATE TABLE archives (
          id            TEXT PRIMARY KEY,
          entity_type   TEXT NOT NULL,
          entity_id     TEXT NOT NULL,
          entity_data   TEXT NOT NULL,
          summary       TEXT,
          archived_at   TEXT NOT NULL,
          reason        TEXT NOT NULL
        );

        CREATE INDEX idx_archives_entity_type ON archives(entity_type);
        CREATE INDEX idx_archives_archived_at ON archives(archived_at);
        CREATE INDEX idx_archives_entity_id ON archives(entity_id);
      `)
    },
  },
  {
    version: 3,
    name: 'workflow-rules-table',
    up: (db: SqliteDatabase) => {
      db.run(`
        -- =======================================================================
        -- Workflow Rules: hooks, gates, and custom steps (Phase 2)
        -- =======================================================================
        CREATE TABLE workflow_rules (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          type        TEXT NOT NULL,
          command     TEXT NOT NULL,
          position    TEXT NOT NULL,
          action      TEXT NOT NULL,
          description TEXT,
          enabled     INTEGER NOT NULL DEFAULT 1,
          timeout_ms  INTEGER NOT NULL DEFAULT 60000,
          created_at  TEXT NOT NULL,
          sort_order  INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX idx_workflow_rules_command ON workflow_rules(command);
      `)
    },
  },
  {
    version: 4,
    name: 'custom-workflows-table',
    up: (db: SqliteDatabase) => {
      db.run(`
        -- =======================================================================
        -- Custom Workflows: User-defined workflows with agentic auto-config
        -- =======================================================================
        CREATE TABLE custom_workflows (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          name        TEXT UNIQUE NOT NULL,
          description TEXT,
          created_at  TEXT NOT NULL,
          updated_at  TEXT NOT NULL,
          is_builtin  INTEGER NOT NULL DEFAULT 0,
          enabled     INTEGER NOT NULL DEFAULT 1,
          metadata    TEXT
        );

        CREATE INDEX idx_custom_workflows_name ON custom_workflows(name);
        CREATE INDEX idx_custom_workflows_enabled ON custom_workflows(enabled);

        -- Seed built-in workflows (task, done, ship, sync)
        INSERT INTO custom_workflows (name, description, is_builtin, enabled, created_at, updated_at)
        VALUES
          ('task', 'Start working on a task', 1, 1, datetime('now'), datetime('now')),
          ('done', 'Complete current task/subtask', 1, 1, datetime('now'), datetime('now')),
          ('ship', 'Ship feature with version bump and PR', 1, 1, datetime('now'), datetime('now')),
          ('sync', 'Analyze project and regenerate context', 1, 1, datetime('now'), datetime('now'));
      `)
    },
  },
  {
    version: 5,
    name: 'llm-analysis-table',
    up: (db: SqliteDatabase) => {
      db.run(`
        -- =======================================================================
        -- LLM Analysis: Structured findings from hybrid sync pipeline
        -- Pipeline: CLI (collect) → LLM (analyze) → CLI (store)
        -- =======================================================================
        CREATE TABLE llm_analysis (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          commit_hash   TEXT,
          status        TEXT NOT NULL DEFAULT 'active',
          analysis      TEXT NOT NULL,
          analyzed_at   TEXT NOT NULL,
          superseded_at TEXT
        );

        CREATE INDEX idx_llm_analysis_status ON llm_analysis(status);
        CREATE INDEX idx_llm_analysis_commit ON llm_analysis(commit_hash);
      `)
    },
  },
  {
    version: 6,
    name: 'context-feedback-table',
    up: (db: SqliteDatabase) => {
      db.run(`
        -- =======================================================================
        -- Context Feedback: RL loop for file suggestion improvement
        -- Records suggested vs actual files per task for scoring boosts
        -- =======================================================================
        CREATE TABLE context_feedback (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id         TEXT NOT NULL,
          keywords        TEXT NOT NULL,
          suggested_files TEXT NOT NULL,
          actual_files    TEXT,
          precision       REAL,
          recall          REAL,
          created_at      TEXT NOT NULL,
          completed_at    TEXT
        );

        CREATE INDEX idx_cf_task ON context_feedback(task_id);
      `)
    },
  },
  {
    version: 7,
    name: 'sessions-table',
    up: (db: SqliteDatabase) => {
      db.run(`
        -- =======================================================================
        -- Sessions: Task lifecycle tracking (replaces current.json + archive/)
        -- =======================================================================
        CREATE TABLE sessions (
          id            TEXT PRIMARY KEY,
          project_id    TEXT NOT NULL,
          task          TEXT NOT NULL,
          status        TEXT NOT NULL,
          started_at    TEXT NOT NULL,
          paused_at     TEXT,
          completed_at  TEXT,
          duration      INTEGER NOT NULL DEFAULT 0,
          metrics       TEXT NOT NULL DEFAULT '{}',
          timeline      TEXT NOT NULL DEFAULT '[]'
        );

        CREATE INDEX idx_sessions_project ON sessions(project_id);
        CREATE INDEX idx_sessions_status ON sessions(status);
        CREATE INDEX idx_sessions_completed ON sessions(completed_at);
      `)
    },
  },
  {
    version: 8,
    name: 'task-token-tracking',
    up: (db: SqliteDatabase) => {
      db.run(`
        -- =======================================================================
        -- Token usage tracking per task (input + output)
        -- =======================================================================
        ALTER TABLE tasks ADD COLUMN tokens_in INTEGER DEFAULT 0;
        ALTER TABLE tasks ADD COLUMN tokens_out INTEGER DEFAULT 0;
      `)
    },
  },
  {
    version: 9,
    name: 'context-health-tables',
    up: (db: SqliteDatabase) => {
      db.run(`
        -- =======================================================================
        -- Context Zone Events: Track zone transitions for health analytics
        -- =======================================================================
        CREATE TABLE context_zone_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT NOT NULL,
          session_id TEXT,
          zone_from TEXT NOT NULL,
          zone_to TEXT NOT NULL,
          usage_percent REAL NOT NULL,
          action TEXT,
          timestamp TEXT NOT NULL
        );

        CREATE INDEX idx_cze_project ON context_zone_events(project_id);

        -- =======================================================================
        -- Context Compactions: Track compaction events
        -- =======================================================================
        CREATE TABLE context_compactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT NOT NULL,
          format TEXT NOT NULL DEFAULT 'standard',
          original_turns INTEGER NOT NULL,
          files_count INTEGER NOT NULL DEFAULT 0,
          timestamp TEXT NOT NULL
        );

        CREATE INDEX idx_cc_project ON context_compactions(project_id);
      `)
    },
  },
  {
    version: 10,
    name: 'fts5-memories',
    up: (db: SqliteDatabase) => {
      db.run(`
        -- =======================================================================
        -- Memories: Tagged, searchable memory store (replaces memories.json)
        -- =======================================================================
        CREATE TABLE IF NOT EXISTS memories (
          id              TEXT PRIMARY KEY,
          project_id      TEXT NOT NULL,
          title           TEXT NOT NULL,
          content         TEXT NOT NULL,
          tags            TEXT,
          topic_key       TEXT,
          content_hash    TEXT,
          user_triggered  INTEGER NOT NULL DEFAULT 0,
          revision_count  INTEGER NOT NULL DEFAULT 1,
          confidence      TEXT,
          observation_count INTEGER DEFAULT 0,
          created_at      TEXT NOT NULL,
          updated_at      TEXT NOT NULL,
          deleted_at      TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id);
        CREATE INDEX IF NOT EXISTS idx_memories_topic ON memories(topic_key);
        CREATE INDEX IF NOT EXISTS idx_memories_hash ON memories(content_hash);
        CREATE INDEX IF NOT EXISTS idx_memories_deleted ON memories(deleted_at);

        -- FTS5 virtual table for full-text search with BM25 ranking
        CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
          title, content, tags,
          content='memories', content_rowid='rowid'
        );

        -- Triggers to keep FTS index in sync
        CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
          INSERT INTO memories_fts(rowid, title, content, tags)
          VALUES (NEW.rowid, NEW.title, NEW.content, NEW.tags);
        END;

        CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
          INSERT INTO memories_fts(memories_fts, rowid, title, content, tags)
          VALUES ('delete', OLD.rowid, OLD.title, OLD.content, OLD.tags);
        END;

        CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
          INSERT INTO memories_fts(memories_fts, rowid, title, content, tags)
          VALUES ('delete', OLD.rowid, OLD.title, OLD.content, OLD.tags);
          INSERT INTO memories_fts(rowid, title, content, tags)
          VALUES (NEW.rowid, NEW.title, NEW.content, NEW.tags);
        END;
      `)

      // Migrate existing memories from kv_store (memories.json → SQLite)
      try {
        const row = db.prepare("SELECT data FROM kv_store WHERE key = 'memory:memories'").get() as {
          data: string
        } | null
        if (row) {
          const legacy = JSON.parse(row.data) as {
            memories?: Array<{
              id: string
              title: string
              content: string
              tags?: string[]
              userTriggered?: boolean
              createdAt: string
              updatedAt: string
              confidence?: string
              observationCount?: number
            }>
          }
          if (legacy.memories && legacy.memories.length > 0) {
            const insert = db.prepare(`
              INSERT OR IGNORE INTO memories
                (id, project_id, title, content, tags, content_hash, user_triggered, confidence, observation_count, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            for (const m of legacy.memories) {
              insert.run(
                m.id,
                '_migrated',
                m.title,
                m.content,
                (m.tags || []).join(','),
                null,
                m.userTriggered ? 1 : 0,
                m.confidence ?? null,
                m.observationCount ?? 0,
                m.createdAt,
                m.updatedAt
              )
            }
          }
        }
      } catch {
        // Migration is best-effort — old data may not exist
      }
    },
  },
  {
    version: 11,
    name: 'agent-sessions',
    up: (db: SqliteDatabase) => {
      db.run(`
        -- =======================================================================
        -- Agent Sessions: Track AI agent work sessions across compactions
        -- =======================================================================
        CREATE TABLE IF NOT EXISTS agent_sessions (
          id          TEXT PRIMARY KEY,
          project_id  TEXT NOT NULL,
          directory   TEXT,
          task_id     TEXT,
          goal        TEXT,
          started_at  TEXT NOT NULL,
          ended_at    TEXT,
          summary     TEXT,
          files_touched TEXT,
          created_at  TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_agent_sessions_project ON agent_sessions(project_id);
        CREATE INDEX IF NOT EXISTS idx_agent_sessions_task ON agent_sessions(task_id);

        -- =======================================================================
        -- User Prompts: Capture what the user asked (intent tracking)
        -- =======================================================================
        CREATE TABLE IF NOT EXISTS user_prompts (
          id          TEXT PRIMARY KEY,
          project_id  TEXT NOT NULL,
          session_id  TEXT,
          content     TEXT NOT NULL,
          created_at  TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_user_prompts_project ON user_prompts(project_id);
        CREATE INDEX IF NOT EXISTS idx_user_prompts_session ON user_prompts(session_id);
      `)

      // Add session_id column to memories (links observations to agent sessions)
      try {
        db.run('ALTER TABLE memories ADD COLUMN session_id TEXT')
      } catch {
        // Column may already exist
      }
    },
  },
  {
    version: 12,
    name: 'task-body-and-comments',
    up: (db: SqliteDatabase) => {
      // Add body column for markdown descriptions on queue tasks
      try {
        db.run('ALTER TABLE queue_tasks ADD COLUMN body TEXT')
      } catch {
        // Column may already exist
      }

      db.run(`
        CREATE TABLE IF NOT EXISTS queue_task_comments (
          id          TEXT PRIMARY KEY,
          task_id     TEXT NOT NULL,
          author      TEXT NOT NULL DEFAULT 'user',
          content     TEXT NOT NULL,
          created_at  TEXT NOT NULL,
          updated_at  TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_qtc_task_id ON queue_task_comments(task_id);
      `)
    },
  },
  {
    version: 13,
    name: 'workflow-rules-v2',
    up: (db: SqliteDatabase) => {
      // v2 workflow engine: conditional rules, parallel hooks, gate caching.
      try {
        db.run('ALTER TABLE workflow_rules ADD COLUMN when_expr TEXT')
      } catch {
        // Column may already exist
      }
      try {
        db.run('ALTER TABLE workflow_rules ADD COLUMN parallel INTEGER NOT NULL DEFAULT 1')
      } catch {
        // Column may already exist
      }

      db.run(`
        CREATE TABLE IF NOT EXISTS workflow_rule_cache (
          rule_id       INTEGER NOT NULL,
          context_hash  TEXT NOT NULL,
          ran_at        TEXT NOT NULL,
          ttl_ms        INTEGER NOT NULL DEFAULT 3600000,
          PRIMARY KEY (rule_id, context_hash)
        );

        CREATE INDEX IF NOT EXISTS idx_wrc_rule ON workflow_rule_cache(rule_id);
      `)
    },
  },
  {
    version: 14,
    name: 'workflow-rules-trust-source',
    up: (db: SqliteDatabase) => {
      // `trust_source` tags where a rule came from. `local` (default) runs
      // without prompting — the user wrote it themselves. `imported` means
      // it came from a shared template and the engine should refuse to run
      // its shell action until the user explicitly approves. No behavioral
      // change in alpha.4 (every existing rule is local) — the column just
      // buys forward-compat for template importing in a later release.
      try {
        db.run("ALTER TABLE workflow_rules ADD COLUMN trust_source TEXT NOT NULL DEFAULT 'local'")
      } catch {
        // Column may already exist
      }
    },
  },
  {
    version: 15,
    name: 'disable-orphan-workflow-rules',
    up: (db: SqliteDatabase) => {
      // v1.x users could attach hooks to any command verb. v2 narrowed
      // HookCommand to ['task', 'done', 'ship', 'sync'] but the rows
      // keyed on the other verbs live on in this table — the engine
      // never fires them, yet `prjct workflow list` still surfaces them.
      //
      // Disable them (enabled=0) rather than delete: the user can still
      // see them with `--include-disabled`, rename to a v2 equivalent,
      // and re-enable. Idempotent.
      const orphanHookCommands = [
        'pause',
        'resume',
        'reopen',
        'next',
        'dash',
        'bug',
        'idea',
        'linear',
        'jira',
        'tokens',
        'velocity',
        'plan',
      ]
      const list = orphanHookCommands.map((v) => `'${v}'`).join(',')
      db.run(`UPDATE workflow_rules SET enabled = 0 WHERE command IN (${list}) AND enabled = 1`)
    },
  },
  {
    version: 16,
    name: 'specs-and-task-linkage',
    up: (db: SqliteDatabase) => {
      // SDD: specs are first-class entities. A spec captures Goal /
      // Acceptance Criteria / Scope / Out-of-scope / Risks before
      // implementation starts. `prjct task --spec <id>` links a task
      // to its spec; `prjct ship` reads the linked spec's acceptance
      // criteria as a gate.
      //
      // The structured fields live in `content` as JSON (validated by
      // Zod at the service layer); top-level columns expose what we
      // query on (status, title, timestamps, shipped_pr).
      db.run(`
        CREATE TABLE IF NOT EXISTS specs (
          id              TEXT PRIMARY KEY,
          title           TEXT NOT NULL,
          status          TEXT NOT NULL DEFAULT 'draft',
          content         TEXT NOT NULL,
          tags            TEXT,
          created_at      TEXT NOT NULL,
          updated_at      TEXT NOT NULL,
          shipped_at      TEXT,
          shipped_pr      INTEGER,
          archived_at     TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_specs_status ON specs(status);
        CREATE INDEX IF NOT EXISTS idx_specs_created ON specs(created_at);
      `)

      // Link tasks → specs. Nullable: tasks without a spec keep working.
      try {
        db.run('ALTER TABLE tasks ADD COLUMN linked_spec_id TEXT')
        db.run('CREATE INDEX IF NOT EXISTS idx_tasks_spec ON tasks(linked_spec_id)')
      } catch {
        // Column may already exist (re-run safety)
      }
    },
  },
  {
    version: 17,
    name: 'sync-engine-wire-format',
    up: (db: SqliteDatabase) => {
      // Phase 1.5 (B5): extend the events table with the wire-format
      // columns prjct-cloud expects. All additions are nullable / have
      // safe defaults so pre-1.5 events keep deserializing — applyEvent
      // tolerates NULL for these fields.
      //
      // Columns (all ALTER ADD, idempotent on rerun):
      //   server_event_id   — monotonic id assigned by prjct-cloud after
      //                       push. NULL until synced. Used as pull cursor.
      //   entity_type       — canonical entity (tasks, ideas, memories,
      //                       …); empty for legacy rows.
      //   entity_id         — id of the entity referenced; empty for legacy.
      //   event_type        — 'upsert' | 'delete'; empty for legacy.
      //   device_id         — UUIDv4 of the device emitting this event.
      //   origin_device_id  — UUIDv4 of the first creator's device.
      //   content_hash      — sha256(payload). Idempotency key for
      //                       applyEvent + last-write-wins desempata.
      //   revision_count    — per-entity revision counter, increments on
      //                       every update. Defaults to 1.
      const columns: Array<[string, string]> = [
        ['server_event_id', 'INTEGER'],
        ['entity_type', 'TEXT'],
        ['entity_id', 'TEXT'],
        ['event_type', 'TEXT'],
        ['device_id', 'TEXT'],
        ['origin_device_id', 'TEXT'],
        ['content_hash', 'TEXT'],
        ['revision_count', 'INTEGER NOT NULL DEFAULT 1'],
      ]
      for (const [name, decl] of columns) {
        try {
          db.run(`ALTER TABLE events ADD COLUMN ${name} ${decl}`)
        } catch {
          // Column may already exist (re-run safety)
        }
      }
      try {
        db.run('CREATE INDEX IF NOT EXISTS idx_events_server_id ON events(server_event_id)')
        db.run('CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_type, entity_id)')
        db.run('CREATE INDEX IF NOT EXISTS idx_events_device ON events(device_id)')
      } catch {
        // Index may already exist
      }

      // Phase 1.5 (B3): durable, concurrency-safe pending queue. Replaces
      // sync/pending.json. Append + clear are transactional — WS apply
      // and CLI publish can race without losing events.
      //
      // Each row holds a serialized SyncEvent (JSON) plus the entity
      // metadata so we can dedupe by (entity_type, entity_id) when the
      // server confirms a partial batch.
      db.run(`
        CREATE TABLE IF NOT EXISTS sync_pending (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id      TEXT NOT NULL,
          entity_type     TEXT,
          entity_id       TEXT,
          event_type      TEXT,
          content_hash    TEXT,
          payload         TEXT NOT NULL,
          enqueued_at     TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_sync_pending_project ON sync_pending(project_id);
        CREATE INDEX IF NOT EXISTS idx_sync_pending_entity ON sync_pending(entity_type, entity_id);
      `)

      // Phase 1.5 (B4): sync_cursors per (user_id, device_id, project_id).
      // Replaces last-sync.json. Pull uses last_event_id (server's
      // monotonic id), not timestamp — so clock skew between devices no
      // longer skips events.
      //
      // last_event_id is the highest server_event_id we have applied
      // locally for THIS tuple. user_id may be NULL for projects shipped
      // before the user authenticated (cleaned up at first auth).
      db.run(`
        CREATE TABLE IF NOT EXISTS sync_cursors (
          user_id         TEXT,
          device_id       TEXT NOT NULL,
          project_id      TEXT NOT NULL,
          last_event_id   INTEGER NOT NULL DEFAULT 0,
          updated_at      TEXT NOT NULL,
          PRIMARY KEY (user_id, device_id, project_id)
        );

        CREATE INDEX IF NOT EXISTS idx_sync_cursors_project ON sync_cursors(project_id);
      `)
    },
  },
  {
    version: 18,
    name: 'specs-shipped-sha',
    up: (db: SqliteDatabase) => {
      // Phase 1.6 (B-DRIFT-ANCHOR): ship() captures the git HEAD sha at
      // ship time. `prjct spec inventory` uses this as the diff base for
      // drift detection — diffing against shipped_at timestamp via
      // `git log --since` is fragile under rebases / squash-merges.
      //
      // Nullable: existing shipped specs predate this migration and
      // simply report drift=unknown until manually re-shipped.
      try {
        db.run('ALTER TABLE specs ADD COLUMN shipped_sha TEXT')
      } catch {
        // Column may already exist (re-run safety)
      }
    },
  },
  {
    version: 19,
    name: 'sync-applied-hashes',
    up: (db: SqliteDatabase) => {
      // Phase 1.6 (B2): persist content_hash per applied entity so
      // applyEvent can short-circuit no-op events instead of re-running
      // the handler upsert. Side table (not a column on entity tables)
      // so we don't have to migrate every entity schema and can evict
      // independently of business state if cleanup is ever needed.
      //
      // PRIMARY KEY guarantees one row per (entity_type, entity_id) —
      // recordApplied does an UPSERT, not an INSERT.
      db.run(`
        CREATE TABLE IF NOT EXISTS sync_applied_hashes (
          entity_type     TEXT NOT NULL,
          entity_id       TEXT NOT NULL,
          content_hash    TEXT NOT NULL,
          applied_at      TEXT NOT NULL,
          PRIMARY KEY (entity_type, entity_id)
        );
      `)
    },
  },
  {
    version: 20,
    name: 'events-type-timestamp-index',
    up: (db: SqliteDatabase) => {
      // Memory recall + memory-service do `WHERE type LIKE 'remember.%'`
      // (or 'memory.%') and `ORDER BY id DESC` on the events table. Without
      // a compound index, SQLite scans the whole table for every recall.
      // With (type, timestamp DESC) the planner can do an index-only range
      // scan + skip the sort entirely.
      db.run('CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events(type, timestamp DESC)')
    },
  },
  {
    version: 21,
    name: 'memories-type-and-fts-backfill',
    up: (db: SqliteDatabase) => {
      // Migration 10 created `memories` + `memories_fts` (FTS5 BM25), but
      // nothing ever wrote to it — memory entries live in the `events`
      // table with type LIKE 'remember.%'. Result: the FTS index is dark
      // and the UserPromptSubmit hook falls back to keyword substring
      // matching over a recency window (the "17th-entry miss").
      //
      // Two-part fix: (1) extend `memories` so it can carry every field a
      // MemoryEntry needs (type, provenance), (2) backfill from events so
      // the FTS index is non-empty on first sync after upgrade. The
      // trigger memories_ai keeps memories_fts in sync as new rows land.
      try {
        db.run('ALTER TABLE memories ADD COLUMN type TEXT')
      } catch {
        // already added
      }
      try {
        db.run('ALTER TABLE memories ADD COLUMN provenance TEXT')
      } catch {
        // already added
      }

      // Backfill from events. NOT EXISTS keeps it idempotent across re-runs.
      // We strip the 'remember.' prefix off `events.type` for the memory
      // type. Tags + content come out of the JSON event payload.
      db.run(`
        INSERT INTO memories
          (id, project_id, title, content, tags, type, provenance, user_triggered,
           created_at, updated_at)
        SELECT
          'mem_' || e.id,
          '_backfill',
          substr(coalesce(json_extract(e.data, '$.content'), ''), 1, 80),
          coalesce(json_extract(e.data, '$.content'), ''),
          coalesce(json_extract(e.data, '$.tags'), '{}'),
          substr(e.type, length('remember.') + 1),
          coalesce(json_extract(e.data, '$.provenance'), 'declared'),
          0,
          e.timestamp,
          e.timestamp
        FROM events e
        WHERE e.type LIKE 'remember.%'
          AND NOT EXISTS (SELECT 1 FROM memories m WHERE m.id = 'mem_' || e.id)
      `)
    },
  },
  {
    version: 22,
    name: 'memory-embeddings-store',
    up: (db: SqliteDatabase) => {
      // Optional semantic-search layer (phase 3). One row per embedded
      // memory entry; the vector is a packed Float32 BLOB. Off by default —
      // populated only when the project opts into an embeddings provider
      // (`config.embeddings`). `model` + `dims` are stored so a model change
      // can invalidate stale vectors. Keyed by the same `mem_<id>` the rest
      // of the memory layer uses.
      db.run(`
        CREATE TABLE IF NOT EXISTS memory_embeddings (
          memory_id   TEXT PRIMARY KEY,
          vector      BLOB NOT NULL,
          model       TEXT NOT NULL,
          dims        INTEGER NOT NULL,
          created_at  TEXT NOT NULL
        )
      `)
    },
  },
  {
    version: 23,
    name: 'memory-usefulness-ledger',
    up: (db: SqliteDatabase) => {
      // Reinforcement ledger: prjct gets smarter with use by tracking which
      // memory entries actually prove useful. A row accumulates a decayed
      // `score` from real usage signals — `ref_count` (a later entry cited
      // this one: load-bearing knowledge) and `fetch_count` (it was pulled by
      // id on purpose). `last_used_at` drives time-decay at read time, so
      // knowledge that stops being used fades from the ranking boost on its
      // own. Recall blends this score so proven-useful entries surface first.
      // Keyed by the same `mem_<id>` as the rest of the memory layer.
      db.run(`
        CREATE TABLE IF NOT EXISTS memory_usefulness (
          memory_id    TEXT PRIMARY KEY,
          score        REAL NOT NULL DEFAULT 0,
          ref_count    INTEGER NOT NULL DEFAULT 0,
          fetch_count  INTEGER NOT NULL DEFAULT 0,
          last_used_at TEXT NOT NULL
        )
      `)
    },
  },
  {
    version: 24,
    name: 'memory-surface-log',
    up: (db: SqliteDatabase) => {
      // Ship-success attribution: which memory entries were SURFACED during a
      // task. `context memory` records the entries it shows here, keyed by the
      // active task; when that task reaches a successful `prjct ship`, every
      // surfaced entry gets a strong usefulness boost — "knowledge that fed
      // work which actually shipped." Rows are deleted once credited, so this
      // stays a small, transient working set. (memory_id, task_id) is unique
      // so a memory is recorded at most once per task.
      db.run(`
        CREATE TABLE IF NOT EXISTS memory_surface_log (
          memory_id   TEXT NOT NULL,
          task_id     TEXT NOT NULL,
          created_at  TEXT NOT NULL,
          PRIMARY KEY (memory_id, task_id)
        )
      `)
    },
  },
  {
    version: 25,
    name: 'memory-dedup-content-hash',
    up: (db: SqliteDatabase) => {
      // Backfill `memories.content_hash` and purge historical verbatim
      // duplicates from BOTH memory tables.
      //
      // Until now nothing populated `memories.content_hash`, and a
      // friction-detector key bug (a 64-char hash compared against a 12-char
      // stored key — they never matched) re-recorded the same user-pushback
      // every session, leaving 5-9 identical copies per signal. Those dups
      // dilute `searchFts` (reads `memories`) and the vault index (reads
      // `events`), and waste slots in the fixed-size recall-injection budget.
      //
      // Going forward `projectMemory.remember()` dedups on `content_hash`
      // before writing; this migration heals what already landed and seeds the
      // hash on every existing row so that guard recognizes them. Idempotent —
      // safe to re-run (NULL backfill only, keep-earliest is deterministic).
      const numOf = (id: string): number => Number(String(id).replace(/^mem[_-]/i, '')) || 0

      // 1) Backfill content_hash wherever it's missing.
      const memAll = db.prepare('SELECT id, content, content_hash FROM memories').all() as Array<{
        id: string
        content: string
        content_hash: string | null
      }>
      const setHash = db.prepare('UPDATE memories SET content_hash = ? WHERE id = ?')
      for (const r of memAll) {
        if (!r.content_hash) setHash.run(memoryFingerprint(r.content ?? ''), r.id)
      }

      // 2) Soft-delete duplicate `memories` rows: keep the earliest (smallest
      //    mem_<id>) per (type, content_hash); mark the rest deleted so
      //    searchFts — which filters `deleted_at IS NULL` — stops returning
      //    them. Soft, not hard: the row stays resolvable by id.
      const memLive = db
        .prepare('SELECT id, type, content_hash FROM memories WHERE deleted_at IS NULL')
        .all() as Array<{ id: string; type: string | null; content_hash: string | null }>
      const canonicalMem = new Map<string, number>() // group key -> min numeric id
      for (const r of memLive) {
        if (!r.content_hash) continue
        const k = `${r.type ?? ''}::${r.content_hash}`
        const n = numOf(r.id)
        const cur = canonicalMem.get(k)
        if (cur === undefined || n < cur) canonicalMem.set(k, n)
      }
      const nowIso = new Date().toISOString()
      const softDelete = db.prepare('UPDATE memories SET deleted_at = ? WHERE id = ?')
      for (const r of memLive) {
        if (!r.content_hash) continue
        const k = `${r.type ?? ''}::${r.content_hash}`
        if (canonicalMem.get(k) !== numOf(r.id)) softDelete.run(nowIso, r.id)
      }

      // 3) Hard-delete duplicate remember-events: keep the earliest per
      //    (type, normalized content). `events` feeds recall() and the vault
      //    index (allEntriesForIndex), neither of which dedups non-keyed
      //    entries — so the dup rows (and the vault files they spawn) only
      //    disappear when the rows do. These are verbatim duplicate signals
      //    with no audit value. ORDER BY id ASC ⇒ first seen = earliest = kept.
      const evRows = db
        .prepare(
          `SELECT id, type, json_extract(data, '$.content') AS content
             FROM events WHERE type LIKE 'memory.remember.%' ORDER BY id ASC`
        )
        .all() as Array<{ id: number; type: string; content: string | null }>
      const seenEv = new Set<string>()
      const delEv = db.prepare('DELETE FROM events WHERE id = ?')
      for (const r of evRows) {
        if (r.content == null) continue
        const k = `${r.type}::${memoryFingerprint(r.content)}`
        if (seenEv.has(k)) {
          delEv.run(r.id)
          continue
        }
        seenEv.add(k)
      }
    },
  },
  {
    version: 26,
    name: 'events-type-id-index',
    up: (db: SqliteDatabase) => {
      // Recall is `… WHERE type LIKE 'memory.remember.%' ORDER BY id DESC`
      // (project-memory.ts recall + allEntriesForIndex) and fires on every
      // UserPromptSubmit hook. Migration 20 added (type, timestamp DESC)
      // INTENDING to serve that ORDER BY — but the sort column is `id`, not
      // `timestamp`, so the planner used the index only for the type range and
      // then ran a separate filesort on `id` every time. This index sorts by
      // the actual ORDER BY column, collapsing the filesort into an ordered
      // index scan. Additive; the old index can stay for timestamp-range use.
      db.run('CREATE INDEX IF NOT EXISTS idx_events_type_id ON events(type, id DESC)')
    },
  },
  {
    version: 27,
    name: 'events-file-tag-column',
    up: (db: SqliteDatabase) => {
      // `recallForFile` (the `prjct guard` / pre-edit anticipation lookup)
      // used to overfetch 500 recall rows and filter by the `file` tag in JS.
      // A virtual generated column exposes the tag to SQL so a partial index
      // covers exactly the file-tagged remember rows — for most projects a
      // few dozen rows instead of a 500-row JSON.parse sweep per lookup.
      // VIRTUAL (not STORED) is required for ALTER TABLE; the CASE guard
      // keeps json_extract off non-remember rows and malformed data.
      db.run(`
        ALTER TABLE events ADD COLUMN file_tag TEXT GENERATED ALWAYS AS (
          CASE
            WHEN type LIKE 'memory.remember.%' AND json_valid(data)
            THEN json_extract(data, '$.tags.file')
          END
        ) VIRTUAL
      `)
      db.run(
        'CREATE INDEX IF NOT EXISTS idx_events_file_tag ON events(file_tag) WHERE file_tag IS NOT NULL'
      )
    },
  },
  {
    version: 28,
    name: 'embedding-norms',
    up: (db: SqliteDatabase) => {
      // semanticSearch divides every cosine score by the row vector's L2
      // norm, which it used to recompute from the unpacked BLOB on every
      // query. Store the norm once at write time instead; the query loop
      // becomes a dot product + one multiply. Backfill computes norms for
      // existing vectors (Float32 little-endian BLOBs) so the column is
      // immediately authoritative.
      db.run('ALTER TABLE memory_embeddings ADD COLUMN norm REAL')
      const rows = db.prepare('SELECT memory_id, vector FROM memory_embeddings').all() as Array<{
        memory_id: string
        vector: Uint8Array
      }>
      const setNorm = db.prepare('UPDATE memory_embeddings SET norm = ? WHERE memory_id = ?')
      for (const r of rows) {
        // Copy for 4-byte alignment — SQLite BLOBs may arrive unaligned.
        const copy = Uint8Array.from(r.vector)
        const v = new Float32Array(copy.buffer, 0, Math.floor(copy.byteLength / 4))
        let sum = 0
        for (let i = 0; i < v.length; i++) sum += v[i] * v[i]
        setNorm.run(Math.sqrt(sum), r.memory_id)
      }
    },
  },
  {
    version: 29,
    name: 'fts5-prefix-indexes',
    up: (db: SqliteDatabase) => {
      // searchFts matches every keyword as a PREFIX query (`"kw"*` — see
      // project-memory.ts searchFts), but the FTS table from migration 10
      // had no prefix indexes, so each prefix term scanned the full-term
      // index. FTS5 prefix indexes can only be declared at CREATE time →
      // drop + recreate with prefix='2 3 4' and rebuild from the content
      // table. Trigger bodies identical to migration 10.
      db.run(`
        DROP TRIGGER IF EXISTS memories_ai;
        DROP TRIGGER IF EXISTS memories_ad;
        DROP TRIGGER IF EXISTS memories_au;
        DROP TABLE IF EXISTS memories_fts;

        CREATE VIRTUAL TABLE memories_fts USING fts5(
          title, content, tags,
          content='memories', content_rowid='rowid',
          prefix='2 3 4'
        );

        CREATE TRIGGER memories_ai AFTER INSERT ON memories BEGIN
          INSERT INTO memories_fts(rowid, title, content, tags)
          VALUES (NEW.rowid, NEW.title, NEW.content, NEW.tags);
        END;

        CREATE TRIGGER memories_ad AFTER DELETE ON memories BEGIN
          INSERT INTO memories_fts(memories_fts, rowid, title, content, tags)
          VALUES ('delete', OLD.rowid, OLD.title, OLD.content, OLD.tags);
        END;

        CREATE TRIGGER memories_au AFTER UPDATE ON memories BEGIN
          INSERT INTO memories_fts(memories_fts, rowid, title, content, tags)
          VALUES ('delete', OLD.rowid, OLD.title, OLD.content, OLD.tags);
          INSERT INTO memories_fts(rowid, title, content, tags)
          VALUES (NEW.rowid, NEW.title, NEW.content, NEW.tags);
        END;

        INSERT INTO memories_fts(memories_fts) VALUES ('rebuild');
      `)
    },
  },
]
