---
allowed-tools: [Read, Write, Bash]
description: 'Complete current task with session metrics'
timestamp-rule: 'GetTimestamp() for all timestamps'
architecture: 'JSON-first - Write to data/*.json, views are generated'
---

# /p:done - Complete Current Task with Session Metrics

## Architecture: JSON-First

**Source of Truth**: `data/state.json`, `data/queue.json`, `data/metrics.json`
**Generated Views**: `views/now.md`, `views/next.md` (auto-generated)

All writes go to JSON. After writing, views are auto-regenerated.

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{dataPath}`: `{globalPath}/data`
- `{statePath}`: `{dataPath}/state.json`
- `{queuePath}`: `{dataPath}/queue.json`
- `{metricsJsonPath}`: `{dataPath}/metrics.json`
- `{sessionPath}`: `{globalPath}/sessions/current.json`
- `{archiveDir}`: `{globalPath}/sessions/archive`
- `{memoryPath}`: `{globalPath}/memory/context.jsonl`

## Step 1: Read Config

READ: `.prjct/prjct.config.json`
EXTRACT: `projectId`

IF file not found:
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

## Step 2: Check Session State

### Read state.json (source of truth)
READ: `{statePath}`

IF file exists AND has currentTask:
  EXTRACT: {task} = state.currentTask
  GOTO Step 3 (Session Completion)

### Try structured session (for detailed metrics)
READ: `{sessionPath}`

IF file exists:
  PARSE as JSON
  EXTRACT: {session} object
ELSE:
  CREATE session from state.currentTask data

IF no currentTask in state.json:
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

## Step 5: Clear Current State (JSON)

### Clear state.json (SOURCE OF TRUTH)
READ: `{statePath}`

UPDATE state.json:
```json
{
  "currentTask": null,
  "lastUpdated": "{now}"
}
```

WRITE: `{statePath}`

### Clear session.json
WRITE: `{sessionPath}`
Content:
```json
{}
```

## Step 6: Update Metrics (JSON)

READ: `{metricsJsonPath}` (or create default if not exists)

### Update metrics.json
```json
{
  "velocity": {
    "tasksPerDay": {calculated},
    "avgTaskDuration": {calculated}
  },
  "allTime": {
    "totalTasks": {increment by 1},
    "totalTime": {add duration},
    "daysActive": {recalculate}
  },
  "recentTasks": [
    {
      "task": "{session.task}",
      "duration": {duration},
      "completedAt": "{now}",
      "metrics": {
        "filesChanged": {filesChanged},
        "linesAdded": {linesAdded},
        "linesRemoved": {linesRemoved},
        "commits": {commits}
      }
    },
    ...existing recent tasks (keep last 10)
  ],
  "lastUpdated": "{now}"
}
```

WRITE: `{metricsJsonPath}`

## Step 7: Generate Views

BASH: `cd {projectRoot} && npx prjct-generate-views --project={projectId}`

Note: This regenerates views/now.md, views/next.md from JSON automatically.

## Step 8: Log to Memory

APPEND to: `{memoryPath}`

Single line (JSONL format):
```json
{"timestamp":"{now}","action":"session_completed","sessionId":"{session.id}","task":"{session.task}","duration":{duration},"metrics":{"files":{filesChanged},"added":{linesAdded},"removed":{linesRemoved},"commits":{commits}}}
```

## Output

SUCCESS:
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

### Example 1: Full Session Completion
**Session:**
```json
{
  "id": "sess_abc12345",
  "task": "implement authentication",
  "status": "active",
  "startedAt": "2025-12-07T10:00:00.000Z",
  "timeline": [
    {"type": "start", "at": "2025-12-07T10:00:00.000Z"}
  ]
}
```

**Git activity:**
- 3 commits
- 5 files changed
- +120/-30 lines

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
