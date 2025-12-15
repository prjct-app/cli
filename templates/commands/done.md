---
allowed-tools: [Read, Write, Bash]
description: 'Complete current task with session metrics'
timestamp-rule: 'GetTimestamp() for all timestamps'
architecture: 'Write-Through (JSON → MD → Events)'
storage-layer: true
source-of-truth: 'storage/state.json'
claude-context: 'context/now.md'
backend-sync: 'sync/pending.json'
---

# /p:done - Complete Current Task with Session Metrics

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
- `{sessionsPath}`: `{globalPath}/progress/sessions`

## Accuracy Calculation

When task had an estimate, calculate accuracy:
- `{accuracy}` = 100 - |((actual - estimate) / estimate) * 100|
- Cap accuracy at 100% (can't be more than 100%)
- If actual < estimate: bonus (under-budget)
- If actual > estimate: penalty (over-budget)

**Example:**
- Estimate: 2h (7200s), Actual: 2h 15m (8100s)
- Accuracy = 100 - |((8100-7200)/7200)*100| = 100 - 12.5 = 87.5%

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
  OUTPUT: "⚠️ No active task to complete. Use /p:now to start one."
  STOP

PARSE JSON
EXTRACT: {currentTask}

IF {currentTask.status} != "active":
  OUTPUT: "⚠️ No active task to complete. Use /p:now to start one."
  STOP

## Step 3: Calculate Metrics

SET: {now} = GetTimestamp()
SET: {startedAt} = {currentTask.startedAt}

### Calculate Duration
SET: {durationSeconds} = seconds between {startedAt} and {now}
SET: {durationFormatted} = format as "Xh Ym" or "Xm"

### Calculate Git Metrics
BASH: `git rev-list --count --since="{startedAt}" HEAD 2>/dev/null || echo "0"`
CAPTURE as {commits}

BASH: `git diff --stat HEAD~{commits} 2>/dev/null || git diff --stat`
PARSE output for:
  - {filesChanged}: number of files
  - {linesAdded}: insertions
  - {linesRemoved}: deletions

### Calculate Accuracy (if estimate exists)
IF {currentTask.estimateSeconds} exists AND > 0:
  {accuracy} = 100 - Math.abs(((durationSeconds - estimateSeconds) / estimateSeconds) * 100)
  {accuracy} = Math.max(0, Math.min(100, {accuracy}))  // Cap between 0-100
  {accuracyLabel} = accuracy >= 80 ? "✅" : accuracy >= 50 ? "⚠️" : "❌"
ELSE:
  {accuracy} = null
  {accuracyLabel} = null

## Step 4: Update Storage (SOURCE OF TRUTH)

### Prepare completed task
```json
{
  "id": "{currentTask.id}",
  "description": "{currentTask.description}",
  "status": "completed",
  "startedAt": "{currentTask.startedAt}",
  "completedAt": "{now}",
  "sessionId": "{currentTask.sessionId}",
  "duration": {durationSeconds},
  "estimate": "{currentTask.estimate}",
  "estimateSeconds": {currentTask.estimateSeconds},
  "accuracy": {accuracy},
  "metrics": {
    "filesChanged": {filesChanged},
    "linesAdded": {linesAdded},
    "linesRemoved": {linesRemoved},
    "commits": {commits}
  }
}
```

### Update state.json
READ: `{statePath}`
SET: state.previousTask = completed task object
SET: state.currentTask = null
SET: state.lastUpdated = {now}
WRITE: `{statePath}`

## Step 5: Generate Context (FOR CLAUDE)

### Clear now.md
WRITE: `{nowContextPath}`

```markdown
# NOW

_No active task_

Use `/p:now <task>` to start working.
```

## Step 6: Queue Sync Event (FOR BACKEND)

READ: `{syncPath}` or create empty array
APPEND event:
```json
{
  "type": "task.completed",
  "path": ["state"],
  "data": {
    "taskId": "{currentTask.id}",
    "description": "{currentTask.description}",
    "startedAt": "{currentTask.startedAt}",
    "completedAt": "{now}",
    "duration": {durationSeconds},
    "accuracy": {accuracy},
    "metrics": {
      "filesChanged": {filesChanged},
      "linesAdded": {linesAdded},
      "linesRemoved": {linesRemoved},
      "commits": {commits}
    }
  },
  "timestamp": "{now}",
  "projectId": "{projectId}"
}
```
WRITE: `{syncPath}`

## Step 7: Log to Daily Session (for Dashboard Charts)

GET: {date} = YYYY-MM-DD from {now}
GET: {yearMonth} = YYYY-MM from {now}
SET: {dailySessionPath} = `{sessionsPath}/{yearMonth}/{date}.jsonl`

BASH: `mkdir -p {sessionsPath}/{yearMonth}`

APPEND to: `{dailySessionPath}`

Single line (JSONL format):
```json
{"ts":"{now}","type":"task_complete","task":"{currentTask.description}","duration":"{durationFormatted}","sessionId":"{currentTask.sessionId}"}
```

## Step 8: Log to Memory (AUDIT TRAIL)

APPEND to: `{memoryPath}`

Single line (JSONL format):

IF {accuracy} exists:
```json
{"timestamp":"{now}","action":"task_completed","taskId":"{currentTask.id}","sessionId":"{currentTask.sessionId}","task":"{currentTask.description}","duration":{durationSeconds},"estimate":{estimateSeconds},"accuracy":{accuracy},"metrics":{"files":{filesChanged},"added":{linesAdded},"removed":{linesRemoved},"commits":{commits}}}
```

ELSE:
```json
{"timestamp":"{now}","action":"task_completed","taskId":"{currentTask.id}","sessionId":"{currentTask.sessionId}","task":"{currentTask.description}","duration":{durationSeconds},"metrics":{"files":{filesChanged},"added":{linesAdded},"removed":{linesRemoved},"commits":{commits}}}
```

## Output

SUCCESS (with estimate):
```
✅ {currentTask.description} ({durationFormatted})

Estimate: {estimate} | Actual: {durationFormatted} | {accuracyLabel} Accuracy: {accuracy}%

Session: {currentTask.sessionId}
Files: {filesChanged} | +{linesAdded}/-{linesRemoved}
Commits: {commits}

Next:
• /p:now - Start next task
• /p:ship - Ship completed work
• /p:progress - View metrics
```

SUCCESS (without estimate):
```
✅ {currentTask.description} ({durationFormatted})

Session: {currentTask.sessionId}
Files: {filesChanged} | +{linesAdded}/-{linesRemoved}
Commits: {commits}

Next:
• /p:now - Start next task
• /p:ship - Ship completed work
• /p:progress - View metrics
```

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| Config not found | "No prjct project" | STOP |
| No current task | "No active task" | STOP |
| Git fails | Use zeros for metrics | CONTINUE |
| Write fails | Log warning | CONTINUE |

## File Structure Reference

```
~/.prjct-cli/projects/{projectId}/
├── storage/
│   └── state.json              # Source of truth
├── context/
│   └── now.md                  # Generated (cleared on done)
├── sync/
│   └── pending.json            # Events for backend
├── progress/
│   └── sessions/{YYYY-MM}/     # Daily session logs
└── memory/
    └── events.jsonl            # Audit trail
```

## Examples

### Example 1: Full Session Completion (with estimate)
**State:**
```json
{
  "currentTask": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "description": "implement authentication",
    "status": "active",
    "startedAt": "2025-12-07T10:00:00.000Z",
    "estimate": "2h",
    "estimateSeconds": 7200
  }
}
```

**Git activity:**
- 3 commits
- 5 files changed
- +120/-30 lines
- Actual duration: 2h 15m (8100s)
- Accuracy: 100 - |((8100-7200)/7200)*100| = 87.5%

**Output:**
```
✅ implement authentication (2h 15m)

Estimate: 2h | Actual: 2h 15m | ✅ Accuracy: 88%

Session: 550e8400-e29b-41d4-a716-446655440000
Files: 5 | +120/-30
Commits: 3

Next:
• /p:now - Start next task
• /p:ship - Ship completed work
• /p:progress - View metrics
```

### Example 2: Session Completion (without estimate)
**Output:**
```
✅ implement authentication (2h 15m)

Session: 550e8400-e29b-41d4-a716-446655440000
Files: 5 | +120/-30
Commits: 3

Next:
• /p:now - Start next task
• /p:ship - Ship completed work
• /p:progress - View metrics
```

### Example 3: No Active Task
**Output:**
```
⚠️ No active task to complete. Use /p:now to start one.
```
