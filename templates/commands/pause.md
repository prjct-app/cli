---
allowed-tools: [Read, Write, Bash]
description: 'Pause current session with reason'
timestamp-rule: 'GetTimestamp() for all timestamps'
architecture: 'MD-first - MD files are source of truth'
---

# /p:pause - Pause Current Session

## Architecture: MD-First

**Source of Truth**: `core/now.md`, `sessions/current.json`

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{sessionPath}`: `{globalPath}/sessions/current.json`
- `{nowPath}`: `{globalPath}/core/now.md`
- `{memoryPath}`: `{globalPath}/memory/context.jsonl`
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
  Reason: {session.pauseReason}

  /p:resume to continue | /p:done to complete
  ```
  STOP

IF {session.status} != "active":
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

For each event in {session.timeline}:
  Track start/resume/pause times
  Calculate total active time up to now

SET: {duration} = total active seconds
SET: {durationFormatted} = format as "Xh Ym" or "Xm"

## Step 5: Update Session

UPDATE {session}:
```json
{
  "id": "{session.id}",
  "projectId": "{session.projectId}",
  "task": "{session.task}",
  "status": "paused",
  "startedAt": "{session.startedAt}",
  "pausedAt": "{now}",
  "pauseReason": "{reason}",
  "pauseNote": "{blockerNote}",
  "completedAt": null,
  "duration": {duration},
  "metrics": {session.metrics},
  "timeline": [
    ...{session.timeline},
    {"type": "pause", "at": "{now}", "reason": "{reason}", "note": "{blockerNote}"}
  ]
}
```

WRITE: `{sessionPath}`
Content: Updated session JSON

## Step 6: Update now.md (SOURCE OF TRUTH)

WRITE: `{nowPath}`
Content:
```markdown
# NOW

⏸️ **{session.task}** (paused)

Started: {session.startedAt}
Paused: {now}
Duration: {durationFormatted}
Reason: {reason}
Session: {session.id}
{IF blockerNote: Note: {blockerNote}}
```

## Step 7: Log to Memory

APPEND to: `{memoryPath}`

Single line (JSONL):
```json
{"timestamp":"{now}","action":"session_paused","sessionId":"{session.id}","task":"{session.task}","duration":{duration},"reason":"{reason}","note":"{blockerNote}"}
```

## Output

SUCCESS:
```
⏸️ Paused: {session.task}

Session: {session.id}
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

Session: sess_abc12345
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

Session: sess_abc12345
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

Session: sess_abc12345
Active time: 2h 30m
Reason: switch

Next:
• /p:now <task> - Start the urgent task
```

### Example 4: No Reason (Interactive)
**Input:** `/p:pause`

**Output:**
```
Why are you pausing?

1. blocked - Waiting on something external
2. switch - Starting a different task
3. break - Taking a break
4. research - Need to investigate

Select [1-4]:
```
