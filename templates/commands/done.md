---
allowed-tools: [Read, Write, Bash]
description: 'Complete current task with session metrics'
timestamp-rule: 'GetTimestamp() for all timestamps'
architecture: 'MD-first - MD files are source of truth'
---

# /p:done - Complete Current Task with Session Metrics

## Architecture: MD-First

**Source of Truth**: `core/now.md`, `core/next.md`, `progress/shipped.md`

MD files are the source of truth. Write directly to MD files.

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{nowPath}`: `{globalPath}/core/now.md`
- `{nextPath}`: `{globalPath}/core/next.md`
- `{sessionPath}`: `{globalPath}/sessions/current.json`
- `{archiveDir}`: `{globalPath}/sessions/archive`
- `{memoryPath}`: `{globalPath}/memory/context.jsonl`

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

## Step 2: Check Session State

### Read now.md (source of truth)
READ: `{nowPath}`

IF file exists AND has task content:
  PARSE MD format:
  - Look for `**Task description**` (bold text = current task)
  - Look for `Started: {timestamp}`
  - Look for `Session: {sessionId}`
  - Look for `Estimate: {estimate}` (optional)
  EXTRACT: {task}, {startedAt}, {sessionId}, {estimate}
  GOTO Step 3 (Session Completion)

### Try structured session (for detailed metrics)
READ: `{sessionPath}`

IF file exists:
  PARSE as JSON
  EXTRACT: {session} object
ELSE:
  CREATE session from now.md data

IF no task in now.md:
  OUTPUT: "⚠️ No active task to complete. Use /p:now to start one."
  STOP

## Step 3: Session Completion

### Calculate Final Duration
SET: {now} = GetTimestamp()

For each event in {session.timeline}:
  Track start/resume/pause/complete times
  Calculate total active time

SET: {duration} = total active seconds
SET: {durationFormatted} = format as "Xh Ym" or "Xm"

### Calculate Git Metrics
BASH: `git rev-list --count --since="{session.startedAt}" HEAD 2>/dev/null || echo "0"`
CAPTURE as {commits}

BASH: `git diff --stat HEAD~{commits} 2>/dev/null || git diff --stat`
PARSE output for:
  - {filesChanged}: number of files
  - {linesAdded}: insertions
  - {linesRemoved}: deletions

### Calculate Accuracy (if estimate exists)
IF {session.estimateSeconds} exists AND > 0:
  {accuracy} = 100 - Math.abs(((duration - estimateSeconds) / estimateSeconds) * 100)
  {accuracy} = Math.max(0, Math.min(100, {accuracy}))  // Cap between 0-100
  {accuracyLabel} = accuracy >= 80 ? "✅" : accuracy >= 50 ? "⚠️" : "❌"
ELSE:
  {accuracy} = null
  {accuracyLabel} = null

### Update Session Object
```json
{
  "id": "{session.id}",
  "projectId": "{projectId}",
  "task": "{session.task}",
  "status": "completed",
  "startedAt": "{session.startedAt}",
  "pausedAt": null,
  "completedAt": "{now}",
  "duration": {duration},
  "estimate": "{session.estimate}",
  "estimateSeconds": {session.estimateSeconds},
  "accuracy": {accuracy},
  "metrics": {
    "filesChanged": {filesChanged},
    "linesAdded": {linesAdded},
    "linesRemoved": {linesRemoved},
    "commits": {commits},
    "snapshots": {session.metrics.snapshots}
  },
  "timeline": [
    ...{session.timeline},
    {"type": "complete", "at": "{now}"}
  ]
}
```

## Step 4: Archive Session

### Create Archive Directory
GET: {yearMonth} = YYYY-MM from {now}
ENSURE: `{archiveDir}/{yearMonth}` exists

BASH: `mkdir -p {archiveDir}/{yearMonth}`

### Write Archived Session
WRITE: `{archiveDir}/{yearMonth}/{session.id}.json`
Content: Updated session object from Step 3

## Step 5: Clear Current State (MD)

### Clear now.md (SOURCE OF TRUTH)

WRITE: `{nowPath}`

```markdown
# NOW

_No active task_

Use `/p:now <task>` to start working.
```

### Clear session.json
WRITE: `{sessionPath}`
Content:
```json
{}
```

## Step 6: Log to Daily Session (for Dashboard Charts)

GET: {date} = YYYY-MM-DD from {now}
GET: {yearMonth} = YYYY-MM from {now}
SET: {dailySessionPath} = `{globalPath}/progress/sessions/{yearMonth}/{date}.jsonl`

BASH: `mkdir -p {globalPath}/progress/sessions/{yearMonth}`

APPEND to: `{dailySessionPath}`

Single line (JSONL format):
```json
{"ts":"{now}","type":"task_complete","task":"{session.task}","duration":"{durationFormatted}","sessionId":"{session.id}"}
```

This ensures the dashboard charts reflect completed tasks.

## Step 8: Log to Memory

APPEND to: `{memoryPath}`

Single line (JSONL format):

IF {accuracy} exists:
```json
{"timestamp":"{now}","action":"session_completed","sessionId":"{session.id}","task":"{session.task}","duration":{duration},"estimate":{estimateSeconds},"accuracy":{accuracy},"metrics":{"files":{filesChanged},"added":{linesAdded},"removed":{linesRemoved},"commits":{commits}}}
```

ELSE:
```json
{"timestamp":"{now}","action":"session_completed","sessionId":"{session.id}","task":"{session.task}","duration":{duration},"metrics":{"files":{filesChanged},"added":{linesAdded},"removed":{linesRemoved},"commits":{commits}}}
```

## Output

SUCCESS (with estimate):
```
✅ {session.task} ({durationFormatted})

Estimate: {estimate} | Actual: {durationFormatted} | {accuracyLabel} Accuracy: {accuracy}%

Session: {session.id}
Files: {filesChanged} | +{linesAdded}/-{linesRemoved}
Commits: {commits}

Next:
• /p:now - Start next task
• /p:ship - Ship completed work
• /p:progress - View metrics
```

SUCCESS (without estimate):
```
✅ {session.task} ({durationFormatted})

Session: {session.id}
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
| No session/task | "No active task" | STOP |
| Git fails | Use zeros for metrics | CONTINUE |
| Archive fails | Log warning | CONTINUE |
| Write fails | Log warning | CONTINUE |

## Examples

### Example 1: Full Session Completion (with estimate)
**Session:**
```json
{
  "id": "sess_abc12345",
  "task": "implement authentication",
  "status": "active",
  "startedAt": "2025-12-07T10:00:00.000Z",
  "estimate": "2h",
  "estimateSeconds": 7200,
  "timeline": [
    {"type": "start", "at": "2025-12-07T10:00:00.000Z"}
  ]
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

Session: sess_abc12345
Files: 5 | +120/-30
Commits: 3

Next:
• /p:now - Start next task
• /p:ship - Ship completed work
• /p:progress - View metrics
```

### Example 1b: Session Completion (without estimate)
**Output:**
```
✅ implement authentication (2h 15m)

Session: sess_abc12345
Files: 5 | +120/-30
Commits: 3

Next:
• /p:now - Start next task
• /p:ship - Ship completed work
• /p:progress - View metrics
```

### Example 2: Session with Pauses
**Session with multiple pause/resume:**
```json
{
  "id": "sess_xyz98765",
  "task": "fix login bug",
  "timeline": [
    {"type": "start", "at": "2025-12-07T09:00:00.000Z"},
    {"type": "pause", "at": "2025-12-07T10:00:00.000Z"},
    {"type": "resume", "at": "2025-12-07T14:00:00.000Z"},
    {"type": "pause", "at": "2025-12-07T15:30:00.000Z"},
    {"type": "resume", "at": "2025-12-07T16:00:00.000Z"}
  ]
}
```

**Completion at 17:00:**
- Active time: 1h + 1.5h + 1h = 3.5h
- Duration: 3h 30m

**Output:**
```
✅ fix login bug (3h 30m)

Session: sess_xyz98765
Files: 2 | +45/-12
Commits: 1

Next:
• /p:now - Start next task
• /p:ship - Ship completed work
• /p:progress - View metrics
```

### Example 3: Legacy Fallback (No Session)
**now.md content:**
```
# NOW

**quick fix**

Started: 2025-12-07T16:45:00.000Z
```

**Output:**
```
✅ quick fix (15m)

Next:
• /p:now - Start next task
• /p:ship - Ship completed work
```
