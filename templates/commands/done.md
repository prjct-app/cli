---
allowed-tools: [Read, Write]
description: 'Complete current task'
timestamp-rule: 'GetTimestamp() for all timestamps'
---

# /p:done - Complete Current Task

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{nowPath}`: `{globalPath}/core/now.md`
- `{memoryPath}`: `{globalPath}/memory/context.jsonl`
- `{metricsPath}`: `{globalPath}/progress/metrics.md`

## Step 1: Read Config

READ: `.prjct/prjct.config.json`
EXTRACT: `projectId`

IF file not found:
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

## Step 2: Validate Active Task

READ: `{nowPath}`

IF empty OR contains "No current task":
  OUTPUT: "⚠️ No active task to complete. Use /p:now to start one."
  STOP

## Step 3: Extract Task Data

From NOW file content, extract:

1. **Task name**: Text between `**` markers
   - Pattern: `**(.+?)**`
   - Example: `**implement auth**` → "implement auth"

2. **Start time**: Text after "Started:"
   - Pattern: `Started: (.+)`
   - Example: `Started: 11/28/2025, 2:30:00 PM`

3. **Calculate duration**:
   - Current: GetTimestamp()
   - Duration: current - started
   - Format: "Xh Ym" (e.g., "2h 15m")
   - If < 1 hour: "Xm"
   - If < 1 minute: "< 1m"

## Step 4: Clear Task File

WRITE: `{nowPath}`

Content (exact):
```markdown
# NOW

No current task. Use `/p:now` to set focus.
```

## Step 5: Log to Memory

APPEND to: `{memoryPath}`

Single line (JSONL format):
```json
{"timestamp":"{GetTimestamp()}","action":"task_completed","task":"{task}","duration":"{duration}"}
```

## Step 6: Update Metrics (Optional)

IF `{metricsPath}` exists:
  READ current content
  APPEND new entry with task and duration

## Output

SUCCESS:
```
✅ {task} ({duration})

Next:
• /p:now - Start next task
• /p:ship - Ship completed work
• /p:next - See priority queue
```

## Error Handling

| Error | Response |
|-------|----------|
| Config not found | "No prjct project. Run /p:init first." |
| Now.md empty | "⚠️ No active task. Use /p:now to start." |
| Parse fails | Use task = "task", duration = "unknown", continue |
| Write fails | Log warning, continue (non-critical) |

## Examples

### Example 1: Success
**now.md content:**
```
# NOW

**implement authentication**

Started: 11/28/2025, 12:15:00 PM
```

**Current time:** 11/28/2025, 2:30:00 PM
**Duration:** 2h 15m
**Output:** `✅ implement authentication (2h 15m)`

### Example 2: No Task
**now.md content:**
```
# NOW

No current task.
```

**Output:** `⚠️ No active task to complete. Use /p:now to start one.`

### Example 3: Quick Task
**now.md content:**
```
# NOW

**fix typo in readme**

Started: 11/28/2025, 2:25:00 PM
```

**Current time:** 11/28/2025, 2:30:00 PM
**Duration:** 5m
**Output:** `✅ fix typo in readme (5m)`
