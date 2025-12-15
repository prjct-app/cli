---
allowed-tools: [Read, Write, Bash]
description: 'Resume paused session'
timestamp-rule: 'GetTimestamp() for all timestamps'
architecture: 'Write-Through (JSON → MD → Events)'
storage-layer: true
source-of-truth: 'storage/state.json'
claude-context: 'context/now.md'
backend-sync: 'sync/pending.json'
---

# /p:resume - Resume Paused Session

## Architecture: Write-Through Pattern

```
User Action → Storage (JSON) → Context (MD) → Sync Events
```

**Source of Truth**: `storage/state.json`
**Claude Context**: `context/now.md` (generated)
**Backend Sync**: `sync/pending.json` (events)

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{statePath}`: `{globalPath}/storage/state.json`
- `{nowContextPath}`: `{globalPath}/context/now.md`
- `{syncPath}`: `{globalPath}/sync/pending.json`
- `{memoryPath}`: `{globalPath}/memory/events.jsonl`

## Step 1: Read Config

READ: `.prjct/prjct.config.json`
EXTRACT: `projectId`

IF file not found:
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

## Step 2: Check Current State

### Read state.json (source of truth)
READ: `{statePath}`

IF file not found:
  OUTPUT:
  ```
  ⚠️ No paused session to resume.

  Start a new task:
  • /p:now <task>
  ```
  STOP

PARSE JSON
EXTRACT: {currentTask}, {pausedTask}

IF {currentTask} exists AND {currentTask.status} == "active":
  CALCULATE: {elapsed} = time since last start
  OUTPUT:
  ```
  ▶️ Already active: {currentTask.description}

  Session: {currentTask.sessionId}
  Working for: {elapsed}

  /p:done to complete | /p:pause to pause
  ```
  STOP

IF {pausedTask} is null:
  OUTPUT:
  ```
  ⚠️ No paused session to resume.

  Start a new task:
  • /p:now <task>
  ```
  STOP

## Step 3: Calculate Pause Duration

SET: {now} = GetTimestamp()
SET: {pauseDurationSeconds} = seconds between {pausedTask.pausedAt} and {now}
SET: {pauseFormatted} = format as "Xh Ym" or "Xm"

## Step 4: Update Storage (SOURCE OF TRUTH)

### Prepare resumed task
```json
{
  "id": "{pausedTask.id}",
  "description": "{pausedTask.description}",
  "status": "active",
  "startedAt": "{pausedTask.startedAt}",
  "resumedAt": "{now}",
  "sessionId": "{pausedTask.sessionId}",
  "duration": {pausedTask.duration},
  "estimate": "{pausedTask.estimate}",
  "estimateSeconds": {pausedTask.estimateSeconds}
}
```

### Update state.json
READ: `{statePath}`
SET: state.currentTask = resumed task object
SET: state.pausedTask = null
SET: state.lastUpdated = {now}
WRITE: `{statePath}`

## Step 5: Generate Context (FOR CLAUDE)

WRITE: `{nowContextPath}`

```markdown
# NOW

**{pausedTask.description}**

Started: {pausedTask.startedAt}
Resumed: {now}
Session: {pausedTask.sessionId}
{IF pausedTask.estimate: Estimate: {pausedTask.estimate}}
```

## Step 6: Queue Sync Event (FOR BACKEND)

READ: `{syncPath}` or create empty array
APPEND event:
```json
{
  "type": "task.resumed",
  "path": ["state"],
  "data": {
    "taskId": "{pausedTask.id}",
    "description": "{pausedTask.description}",
    "resumedAt": "{now}",
    "pauseDuration": {pauseDurationSeconds}
  },
  "timestamp": "{now}",
  "projectId": "{projectId}"
}
```
WRITE: `{syncPath}`

## Step 7: Log to Memory (AUDIT TRAIL)

APPEND to: `{memoryPath}`

Single line (JSONL):
```json
{"timestamp":"{now}","action":"task_resumed","taskId":"{pausedTask.id}","sessionId":"{pausedTask.sessionId}","task":"{pausedTask.description}","pauseDuration":{pauseDurationSeconds}}
```

## Output

SUCCESS:
```
▶️ Resumed: {pausedTask.description}

Session: {pausedTask.sessionId}
Was paused: {pauseFormatted}
Total active: {pausedTask.duration} (before this stretch)

/p:done when finished | /p:pause for another break
```

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No project | "No prjct project" | STOP |
| No paused task | "No paused session" | STOP |
| Already active | Show active state | STOP |
| Write fails | Log warning | CONTINUE |

## Examples

### Example 1: Resume Paused Session
**State:**
```json
{
  "currentTask": null,
  "pausedTask": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "description": "implement auth",
    "status": "paused",
    "pausedAt": "2025-12-07T12:30:00.000Z",
    "duration": 9000
  }
}
```

**Current time:** 2:00 PM (paused 1.5h ago)

**Output:**
```
▶️ Resumed: implement auth

Session: 550e8400-e29b-41d4-a716-446655440000
Was paused: 1h 30m
Total active: 2h 30m (before this stretch)

/p:done when finished | /p:pause for another break
```

### Example 2: Already Active
**Output:**
```
▶️ Already active: implement auth

Session: 550e8400-e29b-41d4-a716-446655440000
Working for: 45m

/p:done to complete | /p:pause to pause
```

### Example 3: No Paused Session
**Output:**
```
⚠️ No paused session to resume.

Start a new task:
• /p:now <task>
```

## Natural Language Support

Detect intent for resume:
- "p. resume" → Resume paused session
- "p. continue" → Resume paused session
- "p. back to work" → Resume paused session
- "p. unpause" → Resume paused session
- "p. recover" → Recovery mode (abandoned session)

## Recovery Mode (Abandoned Sessions)

When called as `/p:resume --recover` OR when detecting sessions older than 8 hours:

### Detection
IF {currentTask} exists AND hours since {lastActivity} >= 8:
  TRIGGER: Recovery mode

### Recovery Options

OUTPUT:
```
🔄 Found abandoned session

Task: {task.description}
Session: {task.sessionId}
Started: {task.startedAt}
Last activity: {hoursAgo}h ago

📝 Original prompt (if saved):
┌────────────────────────────────────────
│ {task.context.prompt}
└────────────────────────────────────────

Options:
1. ▶️  Resume - Continue this session
2. ✅ Close - Mark as partial completion (counts in metrics)
3. 🗑️  Discard - Remove without logging
4. ⏸️  Save - Archive for later reference

Choose [1-4]:
```

### Choice Handling

| Choice | Action | Storage Update |
|--------|--------|----------------|
| 1. Resume | Continue session | `status: active`, `resumedAt: now` |
| 2. Close | Mark partial completion | Log to sessions, clear task |
| 3. Discard | Remove without metrics | Clear task, audit log only |
| 4. Save | Archive for later | `savedTask: {...}`, clear current |

### Events Logged

```json
{"type": "session.recovered", "gapHours": {hoursAgo}, "choice": "{choice}"}
```
