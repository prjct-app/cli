# Storage Specification

**Canonical specification for prjct storage format.**

All storage is managed by the `prjct` CLI which uses SQLite (`prjct.db`) internally. **NEVER read or write JSON storage files directly. Use `prjct` CLI commands for all storage operations.**

---

## Current Storage: SQLite (prjct.db)

All reads and writes go through the `prjct` CLI, which manages a SQLite database (`prjct.db`) with WAL mode for safe concurrent access.

```
~/.prjct-cli/projects/{projectId}/
├── prjct.db            # SQLite database (SOURCE OF TRUTH for all storage)
├── context/
│   ├── now.md          # Current task (generated from prjct.db)
│   └── next.md         # Queue (generated from prjct.db)
├── config/
│   └── skills.json     # Agent-to-skill mappings
├── agents/             # Domain specialists (auto-generated)
└── sync/
    └── pending.json    # Events for backend sync
```

### How to interact with storage

- **Read state**: Use `prjct status`, `prjct context`, or MCP project tools
- **Write state**: Use `prjct` CLI commands (`task`, `status`, `capture`, `remember`, etc.)
- **Issue tracker setup**: Configure Linear/Jira MCP servers in the AI client; prjct has no native tracker CLI verbs
- **Never** read/write JSON files in `storage/` or `memory/` directories

---

## LEGACY JSON Schemas (for reference only)

> **WARNING**: These JSON schemas are LEGACY documentation only. The `storage/` and `memory/` directories are no longer used. All data lives in `prjct.db` (SQLite). Do NOT read or write these files.

### state.json (LEGACY)

```json
{
  "task": {
    "id": "uuid-v4",
    "title": "string",
    "type": "feature|bug|improvement|refactor|chore",
    "status": "active|paused|done",
    "branch": "string|null",
    "subtasks": [
      {
        "id": "uuid-v4",
        "title": "string",
        "status": "pending|done"
      }
    ],
    "currentSubtask": 0,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Empty state (no active task):**
```json
{
  "task": null
}
```

### queue.json (LEGACY)

```json
{
  "tasks": [
    {
      "id": "uuid-v4",
      "title": "string",
      "type": "feature|bug|improvement|refactor|chore",
      "priority": 1,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### shipped.json (LEGACY)

```json
{
  "features": [
    {
      "id": "uuid-v4",
      "name": "string",
      "version": "1.0.0",
      "type": "feature|bug|improvement|refactor|chore",
      "shippedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### events.jsonl (LEGACY - now stored in SQLite `events` table)

Previously append-only JSONL. Now stored in SQLite.

```jsonl
{"type":"task.created","timestamp":"2024-01-15T10:30:00.000Z","data":{"taskId":"uuid","title":"string"}}
{"type":"task.started","timestamp":"2024-01-15T10:30:00.000Z","data":{"taskId":"uuid"}}
{"type":"subtask.completed","timestamp":"2024-01-15T10:35:00.000Z","data":{"taskId":"uuid","subtaskIndex":0}}
{"type":"task.completed","timestamp":"2024-01-15T10:40:00.000Z","data":{"taskId":"uuid"}}
{"type":"feature.shipped","timestamp":"2024-01-15T10:45:00.000Z","data":{"featureId":"uuid","name":"string","version":"1.0.0"}}
```

**Event Types:**
- `task.created` - New task created
- `task.started` - Task activated
- `task.paused` - Task paused
- `task.resumed` - Task resumed
- `task.completed` - Task completed
- `subtask.completed` - Subtask completed
- `feature.shipped` - Feature shipped

### learnings.jsonl (LEGACY - now stored in SQLite)

Previously used for LLM-to-LLM knowledge transfer. Now stored in SQLite.

```jsonl
{"taskId":"uuid","linearId":"PRJ-123","timestamp":"2024-01-15T10:40:00.000Z","learnings":{"patterns":["Use NestedContextResolver for hierarchical discovery"],"approaches":["Mirror existing method structure when extending"],"decisions":["Extended class rather than wrapper for consistency"],"gotchas":["Must handle null parent case"]},"value":{"type":"feature","impact":"high","description":"Hierarchical AGENTS.md support for monorepos"},"filesChanged":["core/resolver.ts","core/types.ts"],"tags":["agents","hierarchy","monorepo"]}
```

**Schema:**
```json
{
  "taskId": "uuid-v4",
  "linearId": "string|null",
  "timestamp": "2024-01-15T10:40:00.000Z",
  "learnings": {
    "patterns": ["string"],
    "approaches": ["string"],
    "decisions": ["string"],
    "gotchas": ["string"]
  },
  "value": {
    "type": "feature|bugfix|performance|dx|refactor|infrastructure",
    "impact": "high|medium|low",
    "description": "string"
  },
  "filesChanged": ["string"],
  "tags": ["string"]
}
```

**Why Local Cache**: Enables future semantic retrieval without API latency. Will feed into vector DB for cross-session knowledge transfer.

### skills.json

```json
{
  "mappings": {
    "frontend.md": ["frontend-design"],
    "backend.md": ["javascript-typescript"],
    "testing.md": ["developer-kit"]
  },
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### pending.json (sync queue)

```json
{
  "events": [
    {
      "id": "uuid-v4",
      "type": "task.created",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "data": {},
      "synced": false
    }
  ],
  "lastSync": "2024-01-15T10:30:00.000Z"
}
```

---

## Formatting Rules (MANDATORY)

All agents MUST follow these rules for cross-agent compatibility:

| Rule | Value |
|------|-------|
| JSON indentation | 2 spaces |
| Trailing commas | NEVER |
| Key ordering | Logical (as shown in schemas above) |
| Timestamps | ISO-8601 with milliseconds (`.000Z`) |
| UUIDs | v4 format (lowercase) |
| Line endings | LF (not CRLF) |
| File encoding | UTF-8 without BOM |
| Empty objects | `{}` |
| Empty arrays | `[]` |
| Null values | `null` (lowercase) |

### Timestamp Generation

```bash
# ALWAYS use dynamic timestamps, NEVER hardcode
bun -e "console.log(new Date().toISOString())" 2>/dev/null || node -e "console.log(new Date().toISOString())"
```

### UUID Generation

```bash
# ALWAYS generate fresh UUIDs
bun -e "console.log(crypto.randomUUID())" 2>/dev/null || node -e "console.log(require('crypto').randomUUID())"
```

---

## Write Rules (CRITICAL)

### Direct Writes Only

**NEVER use temporary files** - Write directly to final destination:

```
WRONG: Create `.tmp/file.json`, then `mv` to final path
CORRECT: Use prjctDb.setDoc() or StorageManager.write() to write to SQLite
```

### Atomic Updates

All writes go through SQLite which handles atomicity via WAL mode:
```typescript
// StorageManager pattern (preferred):
await stateStorage.update(projectId, (state) => {
  state.field = newValue
  return state
})

// Direct kv_store pattern:
prjctDb.setDoc(projectId, 'key', data)
```

### NEVER Do These

- Read or write JSON files in `storage/` or `memory/` directories
- Use `.tmp/` directories
- Use `mv` or `rename` operations for storage files
- Create backup files like `*.bak` or `*.old`
- Bypass `prjct` CLI to write directly to `prjct.db`

---

## Cross-Agent Compatibility

### Why This Matters

1. **User freedom**: Switch between Claude and Gemini freely
2. **Remote sync**: Storage will sync to prjct.app backend
3. **Single truth**: Both agents produce identical output

### Verification Test

```bash
# Start task with Claude
p. task "add feature X"

# Switch to Gemini, continue
prjct status done --md  # Should work seamlessly

# Switch back to Claude
p. ship  # Should read Gemini's changes correctly

# All agents read from the same prjct.db via CLI commands
prjct status  # Works from any agent
```

### Remote Sync Flow

```
Local Storage: prjct.db (Claude/Gemini)
        ↓
    sync/pending.json (events queue)
        ↓
    prjct.app API
        ↓
    Global Remote Storage
        ↓
    Any device, any agent
```

---

## MCP Issue Tracker Strategy

Issue tracker integrations are MCP-only.

### Rules

- `prjct` CLI does not call Linear/Jira SDKs or REST APIs directly.
- Issue operations (`sync`, `list`, `get`, `start`, `done`, `update`, etc.) are delegated to MCP tools in the AI client.
- `p. sync` refreshes project context and agent artifacts, not issue tracker payloads.
- Local storage keeps task linkage metadata (for example `linearId`) and project workflow state in SQLite.

### Setup

Configure Linear/Jira MCP servers in the AI client when issue tracker access is needed.

### Operational Model

```
AI client MCP tools <-> Linear/Jira
          |
          v
       prjct workflow state (prjct.db)
```

The CLI remains the source of truth for local project/task state.
Issue-system mutations happen through MCP operations in the active AI session.

---

**Version**: 2.0.0
**Last Updated**: 2026-02-10
