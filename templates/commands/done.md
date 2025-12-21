---
allowed-tools: [Read, Write, Bash]
description: 'Complete current task with session metrics'
---

# /p:done - Complete Task

Mark current task as complete with metrics.

## Usage
```
/p:done
```

## Flow

### Step 1: Validate
READ: `.prjct/prjct.config.json` → extract `projectId`
IF missing: "No prjct project. Run /p:init first." → STOP

SET: `{globalPath}` = `~/.prjct-cli/projects/{projectId}`

READ: `{globalPath}/storage/state.json`
IF no `currentTask` OR status != "active":
  OUTPUT: "No active task. Use /p:now to start one."
  STOP

EXTRACT: `{task}` = currentTask.description
EXTRACT: `{startedAt}` = currentTask.startedAt
EXTRACT: `{sessionId}` = currentTask.sessionId
EXTRACT: `{estimate}` = currentTask.estimate (optional)

### Step 2: Calculate Metrics
GET timestamp: `bun -e "console.log(new Date().toISOString())" 2>/dev/null || node -e "console.log(new Date().toISOString())"`
SET: `{now}` = result

CALCULATE: `{duration}` = time between startedAt and now
FORMAT: as "Xh Ym" or "Xm"

IF estimate exists:
  CALCULATE: `{accuracy}` = 100 - |((actual - estimate) / estimate) * 100|
  CAP at 0-100%

BASH: `git rev-list --count --since="{startedAt}" HEAD 2>/dev/null || echo "0"`
SET: `{commits}` = result

BASH: `git diff --stat HEAD~{commits} 2>/dev/null || git diff --stat`
EXTRACT: `{filesChanged}`, `{linesAdded}`, `{linesRemoved}`

### Step 3: Update Storage
Update `{globalPath}/storage/state.json`:
- Move currentTask to previousTask with status: "completed"
- Set currentTask = null
- Set lastUpdated = {now}
- Add completedAt, duration, accuracy, metrics

WRITE: `{globalPath}/storage/state.json`

### Step 4: Generate Context
WRITE: `{globalPath}/context/now.md`:
```markdown
# NOW

_No active task_

Use `/p:now <task>` to start working.
```

### Step 5: Log Events
APPEND to `{globalPath}/sync/pending.json`:
```json
{"type":"task.completed","data":{...},"timestamp":"{now}"}
```

APPEND to `{globalPath}/memory/events.jsonl`:
```json
{"timestamp":"{now}","action":"task_completed","task":"{task}","duration":{seconds}}
```

APPEND to `{globalPath}/progress/sessions/{YYYY-MM}/{date}.jsonl`:
```json
{"ts":"{now}","type":"task_complete","task":"{task}","duration":"{duration}"}
```

### Step 6: Output

WITH estimate:
```
✅ {task} ({duration})

Estimate: {estimate} | Actual: {duration} | Accuracy: {accuracy}%
Files: {filesChanged} | +{linesAdded}/-{linesRemoved} | Commits: {commits}

Next: /p:now | /p:ship | /p:progress
```

WITHOUT estimate:
```
✅ {task} ({duration})

Files: {filesChanged} | +{linesAdded}/-{linesRemoved} | Commits: {commits}

Next: /p:now | /p:ship | /p:progress
```

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No project | "No prjct project" | STOP |
| No active task | "No active task" | STOP |
| Git fails | Use zeros for metrics | CONTINUE |

## References
- Architecture: `~/.prjct-cli/docs/architecture.md`
- Validation: `~/.prjct-cli/docs/validation.md`
