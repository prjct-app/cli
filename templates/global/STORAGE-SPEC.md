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
│   └── events.jsonl    # Audit trail (append-only)
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

**Version**: 1.0.0
**Last Updated**: 2024-01-15
