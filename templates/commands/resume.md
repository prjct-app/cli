---
allowed-tools: [Read, Write, Bash, Glob, AskUserQuestion]
description: 'Resume paused or interrupted session with full context'
timestamp-rule: 'GetTimestamp() for all timestamps'
architecture: 'Write-Through (JSON → MD → Events)'
storage-layer: true
source-of-truth: 'storage/state.json'
claude-context: 'context/now.md'
backend-sync: 'sync/pending.json'
---

# p. resume - Resume Session with Full Context

**Purpose**: Resume work on a project by loading full context from the last session.

## IMPORTANT: Multi-Session Continuity

When starting a NEW Claude Code session (not just resuming a paused task), `p. resume` provides:
- Full project state including active task
- Enterprise domain progress
- Stack and patterns from project agent
- Session context (last action, next steps, blockers)

This is the recommended way to start any session on an existing project.

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
EXTRACT: {currentTask}, {pausedTask}, {interruptedTask}

IF {currentTask} exists AND {currentTask.status} == "active":
  CALCULATE: {elapsed} = time since last start
  OUTPUT:
  ```
  ▶️ Already active: {currentTask.description}

  Session: {currentTask.sessionId}
  Working for: {elapsed}

  p. done to complete | p. pause to pause
  ```
  STOP

### Handle interruptedTask (priority check)
IF {interruptedTask} exists AND {pausedTask} exists:
  # Both exist - ask user which to resume
  SET: {interruptedElapsed} = time since interruptedTask.interruptedAt
  SET: {pausedElapsed} = time since pausedTask.pausedAt

  USE AskUserQuestion:
  ```
  question: "Multiple tasks waiting. Which one to resume?"
  header: "Resume Task"
  options:
    - label: "{interruptedTask.description}"
      description: "Interrupted {interruptedElapsed} ago (by {interruptedTask.interruptReason})"
    - label: "{pausedTask.description}"
      description: "Paused {pausedElapsed} ago ({pausedTask.pauseReason})"
  ```

  IF choice == interruptedTask.description:
    SET: {taskToResume} = {interruptedTask}
    SET: {resumeType} = "interrupted"
    SET: {clearField} = "interruptedTask"
  ELSE:
    SET: {taskToResume} = {pausedTask}
    SET: {resumeType} = "paused"
    SET: {clearField} = "pausedTask"

ELSE IF {interruptedTask} exists:
  # Only interrupted task exists
  SET: {taskToResume} = {interruptedTask}
  SET: {resumeType} = "interrupted"
  SET: {clearField} = "interruptedTask"

ELSE IF {pausedTask} exists:
  # Only paused task exists
  SET: {taskToResume} = {pausedTask}
  SET: {resumeType} = "paused"
  SET: {clearField} = "pausedTask"

ELSE:
  OUTPUT:
  ```
  ⚠️ No paused or interrupted session to resume.

  Start a new task:
  • p. task <task>
  ```
  STOP

## Step 3: Calculate Away Duration

SET: {now} = GetTimestamp()

IF {resumeType} == "interrupted":
  SET: {awayDurationSeconds} = seconds between {taskToResume.interruptedAt} and {now}
ELSE:
  SET: {awayDurationSeconds} = seconds between {taskToResume.pausedAt} and {now}

SET: {awayFormatted} = format as "Xh Ym" or "Xm"

## Step 4: Update Storage (SOURCE OF TRUTH)

### Prepare resumed task
```json
{
  "id": "{taskToResume.id}",
  "description": "{taskToResume.description}",
  "status": "active",
  "startedAt": "{taskToResume.startedAt}",
  "resumedAt": "{now}",
  "sessionId": "{taskToResume.sessionId}",
  "duration": {taskToResume.duration},
  "estimate": "{taskToResume.estimate}",
  "estimateSeconds": {taskToResume.estimateSeconds},
  "subtasks": {taskToResume.subtasks},
  "currentSubtaskIndex": {taskToResume.currentSubtaskIndex},
  "parentDescription": "{taskToResume.parentDescription}"
}
```

### Update state.json
READ: `{statePath}`
SET: state.currentTask = resumed task object
SET: state.{clearField} = null  # Clear pausedTask or interruptedTask based on which was resumed
SET: state.lastUpdated = {now}
WRITE: `{statePath}`

## Step 5: Load Enterprise Context (NEW)

### 5.1 Load Project Agent

```
GLOB: {globalPath}/agents/*.md
IF files found:
  READ: first agent file
  SET: agentContent = file content
  SET: agentName = filename
```

### 5.2 Extract Enterprise State

```
IF state.domains exists:
  SET: hasDomains = true
  SET: domains = state.domains

IF state.stack exists:
  SET: hasStack = true
  SET: stack = state.stack

IF state.context exists:
  SET: lastAction = state.context.lastAction
  SET: nextAction = state.context.nextAction
  SET: blockers = state.context.blockers
```

## Step 6: Generate Context (FOR CLAUDE)

WRITE: `{nowContextPath}`

```markdown
# NOW

**{taskToResume.description}**

Started: {taskToResume.startedAt}
Resumed: {now}
Session: {taskToResume.sessionId}
{IF taskToResume.estimate: Estimate: {taskToResume.estimate}}
{IF taskToResume.subtasks: Subtask: {currentSubtask.description}}

{IF hasStack:}
## Stack
- Language: {stack.language}
- Framework: {stack.framework}
- State: {stack.stateManagement}
{ENDIF}

{IF hasDomains:}
## Domain Progress
{FOR EACH [name, info] in domains:}
- {name}: {info.progress}% ({info.status})
{END FOR}
{ENDIF}

{IF lastAction:}
## Session Context
- Last Action: {lastAction}
- Next: {nextAction}
{IF blockers:}
- Blockers: {blockers.join(', ')}
{ENDIF}
{ENDIF}
```

## Step 6: Queue Sync Event (FOR BACKEND)

READ: `{syncPath}` or create empty array
APPEND event:
```json
{
  "type": "task.resumed",
  "path": ["state"],
  "data": {
    "taskId": "{taskToResume.id}",
    "description": "{taskToResume.description}",
    "resumedAt": "{now}",
    "awayDuration": {awayDurationSeconds},
    "resumeType": "{resumeType}"
  },
  "timestamp": "{now}",
  "projectId": "{projectId}"
}
```
WRITE: `{syncPath}`

## Step 7: Log to Memory (AUDIT TRAIL)

APPEND to: `{memoryPath}`

IF {resumeType} == "interrupted":
```json
{"timestamp":"{now}","action":"task_resumed_from_interrupt","taskId":"{taskToResume.id}","sessionId":"{taskToResume.sessionId}","task":"{taskToResume.description}","awayDuration":{awayDurationSeconds}}
```
ELSE:
```json
{"timestamp":"{now}","action":"task_resumed","taskId":"{taskToResume.id}","sessionId":"{taskToResume.sessionId}","task":"{taskToResume.description}","pauseDuration":{awayDurationSeconds}}
```

## Output

### Resumed from pause (with workflow):
IF {taskToResume.workflow} exists:
```
▶️ Resumed: {taskToResume.description}

Session: {taskToResume.sessionId}
Was paused: {awayFormatted}
Phase: {taskToResume.workflow.phase} ({checkpointCount}/11 checkpoints)

Next step based on phase:
- implement: Continue coding, then p. test
- test: Run p. test
- review: Run p. review
- merge: Run p. merge
- register: Run p. verify
```

### Resumed from pause (legacy, no workflow):
```
▶️ Resumed: {taskToResume.description}

Session: {taskToResume.sessionId}
Was paused: {awayFormatted}
Total active: {taskToResume.duration} (before this stretch)

p. done when finished | p. pause for another break
```

### Resumed from interrupt (bug):
```
▶️ Resumed: {taskToResume.description}

Session: {taskToResume.sessionId}
Interrupted: {awayFormatted} ago (for bug fix)
Phase: {taskToResume.workflow.phase}

Continue where you left off.
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
