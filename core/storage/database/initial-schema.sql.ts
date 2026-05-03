/**
 * SQL DDL for migration 1 (initial schema). Pulled out into its own
 * module because the inline string was ~220 LOC, dwarfing every other
 * migration in the array.
 */

export const INITIAL_SCHEMA_SQL = `
-- =======================================================================
-- Document storage (backward-compatible with JSON file pattern)
-- =======================================================================
-- Each row replaces one JSON file (state.json, queue.json, etc.)
-- StorageManager reads/writes entire documents via key lookup.
CREATE TABLE kv_store (
  key     TEXT PRIMARY KEY,
  data    TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- =======================================================================
-- Normalized: Tasks
-- =======================================================================
CREATE TABLE tasks (
  id                TEXT PRIMARY KEY,
  description       TEXT NOT NULL,
  type              TEXT,
  status            TEXT NOT NULL,
  parent_description TEXT,
  branch            TEXT,
  linear_id         TEXT,
  linear_uuid       TEXT,
  session_id        TEXT,
  feature_id        TEXT,
  started_at        TEXT NOT NULL,
  completed_at      TEXT,
  shipped_at        TEXT,
  paused_at         TEXT,
  pause_reason      TEXT,
  pr_url            TEXT,
  expected_value    TEXT,
  data              TEXT
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_type ON tasks(type);
CREATE INDEX idx_tasks_branch ON tasks(branch);
CREATE INDEX idx_tasks_linear_id ON tasks(linear_id);

-- =======================================================================
-- Normalized: Subtasks
-- =======================================================================
CREATE TABLE subtasks (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL,
  description TEXT NOT NULL,
  status      TEXT NOT NULL,
  domain      TEXT,
  agent       TEXT,
  sort_order  INTEGER NOT NULL,
  depends_on  TEXT,
  started_at  TEXT,
  completed_at TEXT,
  output      TEXT,
  summary     TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE INDEX idx_subtasks_task_id ON subtasks(task_id);
CREATE INDEX idx_subtasks_status ON subtasks(status);

-- =======================================================================
-- Normalized: Queue Tasks
-- =======================================================================
CREATE TABLE queue_tasks (
  id            TEXT PRIMARY KEY,
  description   TEXT NOT NULL,
  type          TEXT,
  priority      TEXT,
  section       TEXT,
  created_at    TEXT NOT NULL,
  completed     INTEGER DEFAULT 0,
  completed_at  TEXT,
  feature_id    TEXT,
  feature_name  TEXT
);

CREATE INDEX idx_queue_tasks_section ON queue_tasks(section);
CREATE INDEX idx_queue_tasks_priority ON queue_tasks(priority);
CREATE INDEX idx_queue_tasks_completed ON queue_tasks(completed);

-- =======================================================================
-- Normalized: Ideas
-- =======================================================================
CREATE TABLE ideas (
  id            TEXT PRIMARY KEY,
  text          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  priority      TEXT NOT NULL DEFAULT 'medium',
  tags          TEXT,
  added_at      TEXT NOT NULL,
  converted_to  TEXT,
  details       TEXT,
  data          TEXT
);

CREATE INDEX idx_ideas_status ON ideas(status);
CREATE INDEX idx_ideas_priority ON ideas(priority);

-- =======================================================================
-- Normalized: Shipped Features
-- =======================================================================
CREATE TABLE shipped_features (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  shipped_at  TEXT NOT NULL,
  version     TEXT NOT NULL,
  description TEXT,
  type        TEXT,
  duration    TEXT,
  data        TEXT
);

CREATE INDEX idx_shipped_version ON shipped_features(version);
CREATE INDEX idx_shipped_at ON shipped_features(shipped_at);

-- =======================================================================
-- Events (replaces events.jsonl)
-- =======================================================================
CREATE TABLE events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  type      TEXT NOT NULL,
  task_id   TEXT,
  data      TEXT,
  timestamp TEXT NOT NULL
);

CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_task_id ON events(task_id);
CREATE INDEX idx_events_timestamp ON events(timestamp);

-- =======================================================================
-- Analysis (draft + sealed)
-- =======================================================================
CREATE TABLE analysis (
  id          TEXT PRIMARY KEY,
  status      TEXT NOT NULL,
  commit_hash TEXT,
  signature   TEXT,
  sealed_at   TEXT,
  analyzed_at TEXT,
  data        TEXT NOT NULL
);

-- =======================================================================
-- Index: File scores and checksums
-- =======================================================================
CREATE TABLE index_files (
  path        TEXT PRIMARY KEY,
  score       REAL,
  size        INTEGER,
  mtime       TEXT,
  language    TEXT,
  categories  TEXT,
  domain      TEXT
);

CREATE INDEX idx_index_files_domain ON index_files(domain);
CREATE INDEX idx_index_files_score ON index_files(score);

CREATE TABLE index_checksums (
  path      TEXT PRIMARY KEY,
  checksum  TEXT NOT NULL,
  size      INTEGER,
  mtime     TEXT
);

-- =======================================================================
-- Index: Metadata (project-index, domains, categories-cache)
-- =======================================================================
CREATE TABLE index_meta (
  key   TEXT PRIMARY KEY,
  data  TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- =======================================================================
-- Memory (key-value with domain tagging)
-- =======================================================================
CREATE TABLE memory (
  key         TEXT PRIMARY KEY,
  domain      TEXT,
  value       TEXT,
  confidence  REAL DEFAULT 1.0,
  updated_at  TEXT NOT NULL
);

CREATE INDEX idx_memory_domain ON memory(domain);

-- =======================================================================
-- Metrics: Daily stats for trend analysis
-- =======================================================================
CREATE TABLE metrics_daily (
  date                  TEXT PRIMARY KEY,
  tokens_saved          INTEGER NOT NULL DEFAULT 0,
  syncs                 INTEGER NOT NULL DEFAULT 0,
  avg_compression_rate  REAL NOT NULL DEFAULT 0,
  total_duration        INTEGER NOT NULL DEFAULT 0
);

-- =======================================================================
-- Velocity: Sprint data
-- =======================================================================
CREATE TABLE velocity_sprints (
  sprint_number       INTEGER PRIMARY KEY,
  points_completed    REAL NOT NULL DEFAULT 0,
  tasks_completed     INTEGER NOT NULL DEFAULT 0,
  estimation_accuracy REAL NOT NULL DEFAULT 0,
  avg_variance        REAL NOT NULL DEFAULT 0,
  started_at          TEXT,
  ended_at            TEXT
);
`
