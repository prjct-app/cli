---
allowed-tools: [Read, Write, Bash]
description: 'Pause current session'
timestamp-rule: 'GetTimestamp() for all timestamps'
---

# /p:pause - Pause Current Session

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{sessionPath}`: `{globalPath}/sessions/current.json`
- `{nowPath}`: `{globalPath}/core/now.md`
- `{memoryPath}`: `{globalPath}/memory/context.jsonl`

## Step 1: Read Config

READ: `.prjct/prjct.config.json`
EXTRACT: `projectId`

IF file not found:
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

## Step 2: Check Session State

READ: `{sessionPath}`

IF file not found OR empty:
  OUTPUT: "⚠️ No active session to pause. Use /p:now to start one."
  STOP

PARSE as JSON → {session}

IF {session.status} == "paused":
  CALCULATE: {elapsed} = time since {session.pausedAt}
  OUTPUT:
  ```
  ⏸️ Already paused: {session.task}

  Paused: {elapsed} ago
  Duration so far: {session.duration}

  /p:resume to continue | /p:done to complete
  ```
  STOP

IF {session.status} != "active":
  OUTPUT: "⚠️ No active session to pause."
  STOP

## Step 3: Calculate Duration So Far

SET: {now} = GetTimestamp()

For each event in {session.timeline}:
  Track start/resume/pause times
  Calculate total active time up to now

SET: {duration} = total active seconds
SET: {durationFormatted} = format as "Xh Ym" or "Xm"

## Step 4: Update Session

UPDATE {session}:
```json
{
  "id": "{session.id}",
  "projectId": "{session.projectId}",
  "task": "{session.task}",
  "status": "paused",
  "startedAt": "{session.startedAt}",
  "pausedAt": "{now}",
  "completedAt": null,
  "duration": {duration},
  "metrics": {session.metrics},
  "timeline": [
    ...{session.timeline},
    {"type": "pause", "at": "{now}"}
  ]
}
```

WRITE: `{sessionPath}`
Content: Updated session JSON

## Step 5: Update Legacy now.md

WRITE: `{nowPath}`
Content:
```markdown
# NOW

⏸️ **{session.task}** (paused)

Started: {session.startedAt}
Paused: {now}
Duration: {durationFormatted}
Session: {session.id}
```

## Step 6: Log to Memory

APPEND to: `{memoryPath}`

Single line (JSONL):
```json
{"timestamp":"{now}","action":"session_paused","sessionId":"{session.id}","task":"{session.task}","duration":{duration}}
```

## Output

SUCCESS:
```
⏸️ Paused: {session.task}

Session: {session.id}
Active time: {durationFormatted}

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

### Example 1: Pause Active Session
**Session:**
```json
{
  "id": "sess_abc12345",
  "task": "implement auth",
  "status": "active",
  "startedAt": "2025-12-07T10:00:00.000Z",
  "timeline": [
    {"type": "start", "at": "2025-12-07T10:00:00.000Z"}
  ]
}
```

**Current time:** 12:30 PM
**Duration:** 2h 30m

**Output:**
```
⏸️ Paused: implement auth

Session: sess_abc12345
Active time: 2h 30m

Next:
• /p:resume - Continue this task
• /p:now <task> - Start different task
• /p:done - Complete without resuming
```

### Example 2: Already Paused
**Output:**
```
⏸️ Already paused: implement auth

Paused: 15m ago
Duration so far: 2h 30m

/p:resume to continue | /p:done to complete
```

### Example 3: No Active Session
**Output:**
```
⚠️ No active session to pause. Use /p:now to start one.
```
