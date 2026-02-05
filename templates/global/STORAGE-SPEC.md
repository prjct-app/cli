# Storage Specification

**Canonical specification for prjct storage format.**

This document defines the exact format for all storage files. Both Claude and Gemini agents MUST produce **identical output** for the same operations to ensure cross-agent compatibility and future remote sync.

---

## Directory Structure

```
~/.prjct-cli/projects/{projectId}/
├── storage/
│   ├── state.json      # Current task (SOURCE OF TRUTH)
│   ├── queue.json      # Task queue
│   └── shipped.json    # Shipped features
├── context/
│   ├── now.md          # Current task (generated from state.json)
│   └── next.md         # Queue (generated from queue.json)
├── config/
│   └── skills.json     # Agent-to-skill mappings
├── memory/
│   ├── events.jsonl    # Audit trail (append-only)
│   └── learnings.jsonl # LLM knowledge base (append-only)
├── agents/             # Domain specialists (auto-generated)
└── sync/
    └── pending.json    # Events for backend sync
```

---

## JSON Schemas

### state.json

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

### queue.json

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

### shipped.json

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

### events.jsonl (append-only)

One JSON object per line. NEVER modify existing lines.

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

### learnings.jsonl (append-only, LLM Knowledge)

**Purpose**: LLM-to-LLM knowledge transfer. Captures patterns, approaches, and decisions for future semantic retrieval. NOT human documentation.

One JSON object per line. NEVER modify existing lines.

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
CORRECT: Write directly to `{globalPath}/storage/state.json`
```

### Atomic Updates

```javascript
// Read → Modify → Write (no temp files)
const data = JSON.parse(fs.readFileSync(path, 'utf-8'))
data.newField = value
fs.writeFileSync(path, JSON.stringify(data, null, 2))
```

### NEVER Do These

- Use `.tmp/` directories
- Use `mv` or `rename` operations for storage files
- Create backup files like `*.bak` or `*.old`
- Modify existing lines in `events.jsonl`
- Use different JSON formatting between agents

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
p. done  # Should work seamlessly

# Switch back to Claude
p. ship  # Should read Gemini's changes correctly

# Verify JSON format
cat ~/.prjct-cli/projects/{id}/storage/state.json | python -m json.tool
# Must be valid, formatted JSON
```

### Remote Sync Flow

```
Local Storage (Claude/Gemini)
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

## Local Caching Strategy (CRITICAL)

### ⛔ MUST: Read Local, Write Remote

**This is NON-NEGOTIABLE for token efficiency and latency.**

```
┌─────────────────────────────────────────────────────────┐
│  READ: ALWAYS from local cache (issues.json)           │
│  WRITE: Status updates go to remote API                │
│  NEVER: Re-fetch issue details after initial sync      │
└─────────────────────────────────────────────────────────┘
```

### Why This Matters

| Problem | Without Local Cache | With Local Cache |
|---------|---------------------|------------------|
| **Token usage** | Re-read full issue (title, description, AC) every time | Read once, cache forever |
| **API latency** | 200-500ms per API call | 0ms (local file read) |
| **API costs** | Multiple calls per task | 1 sync call, then local |
| **Context bloat** | Full issue in every LLM context | Minimal, only what's needed |

### The Pattern

```
p. sync          → Fetch ALL issues once → Write to issues.json
p. task PRJ-123  → READ from issues.json (NOT API)
                 → WRITE status "In Progress" to API
p. done          → READ state.json (local)
                 → WRITE status "Done" to API
```

### Cache Files

| Cache File | Source | Purpose |
|------------|--------|---------|
| `storage/issues.json` | Linear/JIRA API | Issue titles, descriptions, AC (READ ONLY after sync) |
| `storage/state.json` | Local operations | Current task state |
| `memory/learnings.jsonl` | Task completions | LLM knowledge for future sessions |
| `memory/events.jsonl` | All operations | Audit trail + future sync |

### ⛔ NEVER Do These

- **NEVER** call API to get issue details during `p. task` - use local cache
- **NEVER** re-fetch issue description/AC after initial sync
- **NEVER** load full issue context into LLM when you already have it cached
- **NEVER** make API calls for READ operations (except explicit `p. sync`)

### ALLOWED API Calls

Only these remote writes are allowed:
- `linear.ts start {id}` - Update status to "In Progress"
- `linear.ts done {id}` - Update status to "Done"
- `linear.ts comment {id} "..."` - Add completion comment
- `jira.ts transition {id} "..."` - Update JIRA status

### Sync Strategy

```
p. sync (explicit)
     │
     ▼
Remote API ──────> Local Cache (issues.json)
                        │
                        ▼
              All reads from here (0 latency, 0 extra tokens)
                        │
                        ▼
              Status writes ──────> Remote API (fire & forget)
```

### Token Efficiency Example

```
WITHOUT cache (BAD):
  p. task PRJ-123
  → API call: fetch issue (500ms, 2000 tokens for description+AC)
  → Work...
  → API call: fetch issue again for status update (500ms, 2000 tokens)
  Total: 1000ms latency, 4000 wasted tokens

WITH cache (GOOD):
  p. sync (once per session)
  → All issues cached locally
  p. task PRJ-123
  → Read issues.json (0ms, already in context from sync)
  → Work...
  → Write status to API (fire & forget)
  Total: 0ms read latency, 0 extra tokens
```

### Cache Invalidation

- `p. sync` forces full refresh from remote
- TTL-based staleness detection (warns user, doesn't auto-fetch)
- Manual refresh via `prjct linear sync` or `prjct jira sync`

---

**Version**: 1.1.0
**Last Updated**: 2026-02-05
