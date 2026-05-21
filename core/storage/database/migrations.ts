/**
 * SQLite schema migrations for the per-project database.
 *
 * Append-only — never edit a past migration's `up` block (existing
 * databases will be out of sync). New schema changes go in a new
 * migration with the next sequential version number.
 */

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
]
