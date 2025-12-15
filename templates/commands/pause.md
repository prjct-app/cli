---
allowed-tools: [Read, Write, Bash]
description: 'Pause current session with reason'
timestamp-rule: 'GetTimestamp() for all timestamps'
architecture: 'Write-Through (JSON → MD → Events)'
storage-layer: true
source-of-truth: 'storage/state.json'
claude-context: 'context/now.md'
backend-sync: 'sync/pending.json'
---

# /p:pause - Pause Current Session

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
- `{reason}`: User-provided reason (optional)

## Pause Reasons

When pausing, capture WHY to enable blocker tracking:

| Reason | Meaning | Dashboard Impact |
|--------|---------|------------------|
| `blocked` | Waiting on external dependency | Shows in Blockers list |
| `switch` | Switching to higher priority task | Context switch metric |
| `break` | Taking a break | Normal pause |
| `research` | Need to investigate more | Research time tracked |

If no reason provided, ask:
```
Why are you pausing?
1. blocked - Waiting on something external
2. switch - Starting a different task
3. break - Taking a break
4. research - Need to investigate
```

## Step 1: Read Config

READ: `.prjct/prjct.config.json`
EXTRACT: `projectId`

IF file not found:
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

## Step 2: Check Current State

### Read state.json (source of truth)
READ: `{statePath}`

IF file not found OR no currentTask:
  OUTPUT: "⚠️ No active session to pause. Use /p:now to start one."
  STOP

PARSE JSON
EXTRACT: {currentTask}, {pausedTask}

IF {currentTask} is null OR {currentTask.status} != "active":
  IF {pausedTask} exists:
    CALCULATE: {elapsed} = time since {pausedTask.pausedAt}
    OUTPUT:
    ```
    ⏸️ Already paused: {pausedTask.description}

    Paused: {elapsed} ago
    Duration so far: {pausedTask.duration}
    Reason: {pausedTask.pauseReason}

    /p:resume to continue | /p:done to complete
    ```
    STOP
  ELSE:
    OUTPUT: "⚠️ No active session to pause."
    STOP

## Step 3: Get Pause Reason

IF {reason} not provided:
  ASK user to select reason (blocked, switch, break, research)
  OR auto-detect "break" as default

IF {reason} == "blocked":
  ASK for blocker note: "What's blocking you?"
  SET: {blockerNote} = user response

## Step 4: Calculate Duration So Far

SET: {now} = GetTimestamp()
SET: {durationSeconds} = seconds between {currentTask.startedAt} and {now}
SET: {durationFormatted} = format as "Xh Ym" or "Xm"

## Step 5: Update Storage (SOURCE OF TRUTH)

### Prepare paused task
```json
{
  "id": "{currentTask.id}",
  "description": "{currentTask.description}",
  "status": "paused",
  "startedAt": "{currentTask.startedAt}",
  "pausedAt": "{now}",
  "sessionId": "{currentTask.sessionId}",
  "duration": {durationSeconds},
  "pauseReason": "{reason}",
  "pauseNote": "{blockerNote}",
  "estimate": "{currentTask.estimate}",
  "estimateSeconds": {currentTask.estimateSeconds}
}
```

### Update state.json
READ: `{statePath}`
SET: state.pausedTask = paused task object
SET: state.currentTask = null
SET: state.lastUpdated = {now}
WRITE: `{statePath}`

## Step 6: Generate Context (FOR CLAUDE)

WRITE: `{nowContextPath}`

```markdown
# NOW

⏸️ **{currentTask.description}** (paused)

Started: {currentTask.startedAt}
Paused: {now}
Duration: {durationFormatted}
Reason: {reason}
Session: {currentTask.sessionId}
{IF blockerNote: Note: {blockerNote}}
```

## Step 7: Queue Sync Event (FOR BACKEND)

READ: `{syncPath}` or create empty array
APPEND event:
```json
{
  "type": "task.paused",
  "path": ["state"],
  "data": {
    "taskId": "{currentTask.id}",
    "description": "{currentTask.description}",
    "pausedAt": "{now}",
    "duration": {durationSeconds},
    "reason": "{reason}",
    "note": "{blockerNote}"
  },
  "timestamp": "{now}",
  "projectId": "{projectId}"
}
```
WRITE: `{syncPath}`

## Step 8: Log to Memory (AUDIT TRAIL)

APPEND to: `{memoryPath}`

Single line (JSONL):
```json
{"timestamp":"{now}","action":"task_paused","taskId":"{currentTask.id}","sessionId":"{currentTask.sessionId}","task":"{currentTask.description}","duration":{durationSeconds},"reason":"{reason}","note":"{blockerNote}"}
```

## Output

SUCCESS:
```
⏸️ Paused: {currentTask.description}

Session: {currentTask.sessionId}
Active time: {durationFormatted}
Reason: {reason}
{IF blockerNote: Note: {blockerNote}}

Next:
• /p:resume - Continue this task
• /p:now <task> - Start different task
• /p:done - Complete without resuming
```

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No project | "No prjct project" | STOP |
| No session | "No active session" | STOP |
| Already paused | Show paused state | STOP |
| Write fails | Log warning | CONTINUE |

## Examples

### Example 1: Pause with Blocked Reason
**Input:** `/p:pause blocked`
**Prompt:** "What's blocking you?"
**User:** "Waiting for API credentials from vendor"

**Output:**
```
⏸️ Paused: implement auth

Session: 550e8400-e29b-41d4-a716-446655440000
Active time: 2h 30m
Reason: blocked
Note: Waiting for API credentials from vendor

Next:
• /p:resume - Continue this task
• /p:now <task> - Start different task
```

### Example 2: Quick Break
**Input:** `/p:pause break`

**Output:**
```
⏸️ Paused: implement auth

Session: 550e8400-e29b-41d4-a716-446655440000
Active time: 2h 30m
Reason: break

Next:
• /p:resume - Continue this task
```

### Example 3: Context Switch
**Input:** `/p:pause switch`

**Output:**
```
⏸️ Paused: implement auth

Session: 550e8400-e29b-41d4-a716-446655440000
Active time: 2h 30m
Reason: switch

Next:
• /p:now <task> - Start the urgent task
```
