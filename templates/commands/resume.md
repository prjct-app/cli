---
allowed-tools: [Read, Write, Bash]
description: 'Resume paused session'
timestamp-rule: 'GetTimestamp() for all timestamps'
---

# /p:resume - Resume Paused Session

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
  OUTPUT:
  ```
  ⚠️ No paused session to resume.

  Start a new task:
  • /p:now <task>
  ```
  STOP

PARSE as JSON → {session}

IF {session.status} == "active":
  CALCULATE: {elapsed} = time since last start/resume
  OUTPUT:
  ```
  ▶️ Already active: {session.task}

  Session: {session.id}
  Working for: {elapsed}

  /p:done to complete | /p:pause to pause
  ```
  STOP

IF {session.status} == "completed":
  OUTPUT:
  ```
  ⚠️ Session already completed.

  Start a new task:
  • /p:now <task>
  ```
  STOP

IF {session.status} != "paused":
  OUTPUT: "⚠️ No paused session to resume."
  STOP

## Step 3: Calculate Pause Duration

SET: {now} = GetTimestamp()
SET: {pauseDuration} = time since {session.pausedAt}
SET: {pauseFormatted} = format as "Xh Ym" or "Xm"

## Step 4: Update Session

UPDATE {session}:
```json
{
  "id": "{session.id}",
  "projectId": "{session.projectId}",
  "task": "{session.task}",
  "status": "active",
  "startedAt": "{session.startedAt}",
  "pausedAt": null,
  "completedAt": null,
  "duration": {session.duration},
  "metrics": {session.metrics},
  "timeline": [
    ...{session.timeline},
    {"type": "resume", "at": "{now}"}
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

**{session.task}**

Started: {session.startedAt}
Resumed: {now}
Session: {session.id}
```

## Step 6: Log to Memory

APPEND to: `{memoryPath}`

Single line (JSONL):
```json
{"timestamp":"{now}","action":"session_resumed","sessionId":"{session.id}","task":"{session.task}","pauseDuration":{pauseDurationSeconds}}
```

## Output

SUCCESS:
```
▶️ Resumed: {session.task}

Session: {session.id}
Was paused: {pauseFormatted}
Total active: {session.duration} (before this stretch)

/p:done when finished | /p:pause for another break
```

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No project | "No prjct project" | STOP |
| No session | "No paused session" | STOP |
| Already active | Show active state | STOP |
| Already completed | Suggest /p:now | STOP |
| Write fails | Log warning | CONTINUE |

## Examples

### Example 1: Resume Paused Session
**Session:**
```json
{
  "id": "sess_abc12345",
  "task": "implement auth",
  "status": "paused",
  "pausedAt": "2025-12-07T12:30:00.000Z",
  "duration": 9000,
  "timeline": [
    {"type": "start", "at": "2025-12-07T10:00:00.000Z"},
    {"type": "pause", "at": "2025-12-07T12:30:00.000Z"}
  ]
}
```

**Current time:** 2:00 PM (paused 1.5h ago)

**Output:**
```
▶️ Resumed: implement auth

Session: sess_abc12345
Was paused: 1h 30m
Total active: 2h 30m (before this stretch)

/p:done when finished | /p:pause for another break
```

### Example 2: Already Active
**Output:**
```
▶️ Already active: implement auth

Session: sess_abc12345
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
