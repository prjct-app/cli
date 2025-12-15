---
allowed-tools: [Read, Write, Task, Glob]
description: 'Report bug with auto-priority'
architecture: 'Write-Through (JSON → MD → Events)'
storage-layer: true
source-of-truth: 'storage/queue.json'
claude-context: 'context/next.md'
backend-sync: 'sync/pending.json'
---

# /p:bug - Report Bug with Auto-Priority

## Architecture: Write-Through Pattern

```
User Action → Storage (JSON) → Context (MD) → Sync Events
```

**Source of Truth**: `storage/queue.json`
**Claude Context**: `context/next.md` (generated)
**Backend Sync**: `sync/pending.json` (events)

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{queuePath}`: `{globalPath}/storage/queue.json`
- `{nextContextPath}`: `{globalPath}/context/next.md`
- `{syncPath}`: `{globalPath}/sync/pending.json`
- `{memoryPath}`: `{globalPath}/memory/events.jsonl`
- `{description}`: User-provided bug description

## Agent Delegation (REQUIRED)

Before fixing a bug, delegate to specialist agent:

1. **List agents**: `Glob("~/.prjct-cli/projects/{projectId}/agents/*.md")`
2. **Analyze bug domain**: frontend, backend, database, etc.
3. **Delegate via Task tool**

## Severity Keywords

| Keywords | Severity | Queue Position |
|----------|----------|----------------|
| crash, down, broken, production | Critical | Top |
| error, fail, issue | High | Top |
| bug, incorrect, wrong | Medium | Normal |
| minor, typo, cosmetic | Low | Bottom |

## Flow

1. Parse description for severity keywords
2. Generate task ID (UUID)
3. Add to queue with appropriate priority
4. Generate context/next.md
5. Queue sync event
6. Log to memory

## Update Storage (SOURCE OF TRUTH)

GENERATE: {taskId} = UUID v4
SET: {now} = GetTimestamp()

### Create bug task
```json
{
  "id": "{taskId}",
  "description": "🐛 {description}",
  "type": "bug",
  "priority": "{severity}",
  "section": "active",
  "createdAt": "{now}"
}
```

### Update queue.json
READ: `{queuePath}`
IF severity is "critical" or "high":
  INSERT at top of tasks array
ELSE:
  APPEND to tasks array
WRITE: `{queuePath}`

## Queue Sync Event

```json
{
  "type": "queue.task_added",
  "path": ["queue"],
  "data": {
    "taskId": "{taskId}",
    "description": "🐛 {description}",
    "priority": "{severity}",
    "type": "bug"
  },
  "timestamp": "{now}",
  "projectId": "{projectId}"
}
```

## Response

```
🐛 [{severity}] {description}

Queued at position #{position}
Priority: {severity}

Start: /p:now "🐛 {description}"
```

## Examples

### Critical Bug
```
Input: /p:bug production server is down

Output:
🐛 [critical] production server is down

Queued at position #1
Priority: critical

Start: /p:now "🐛 production server is down"
```

### Normal Bug
```
Input: /p:bug login form validation not working

Output:
🐛 [medium] login form validation not working

Queued at position #3
Priority: medium

Start: /p:now "🐛 login form validation not working"
```
