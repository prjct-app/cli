---
allowed-tools: [Read, Write, Bash]
description: 'Set or show current task with session tracking'
timestamp-rule: 'GetTimestamp() for ALL timestamps'
architecture: 'Write-Through (JSON → MD → Events)'
storage-layer: true
source-of-truth: 'storage/state.json'
claude-context: 'context/now.md'
backend-sync: 'sync/pending.json'
---

# /p:now - Current Task with Session Tracking

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
- `{task}`: User-provided task (optional)
- `{estimate}`: User-provided time estimate (optional, e.g., "2h", "30m", "1d")

## Estimate Format

Estimates use simple duration format:
- `30m` - 30 minutes
- `2h` - 2 hours
- `1d` - 1 day (8 hours)
- `2h30m` - 2 hours 30 minutes

If no estimate provided, gently remind:
```
💡 Tip: Add estimate next time with /p:now "task" 2h
```

## Agent Detection (Optional)

When starting a task, auto-detect the best agent based on keywords:

| Keywords | Agent | Domain |
|----------|-------|--------|
| UI, frontend, React, component, CSS, style | `fe` | Frontend |
| API, backend, database, server, endpoint | `be` | Backend |
| design, UX, layout, wireframe | `ux` | UX Design |
| test, QA, bug, coverage, spec | `qa` | Testing |
| docs, README, documentation | `docs` | Documentation |
| (default) | `general` | General |

**Usage**: Agent is logged for analytics but doesn't affect workflow.

## Step 0: Detect Abandoned Sessions (BEFORE anything else)

READ: `{statePath}` (`storage/state.json`)

IF file exists AND has `currentTask`:
  SET: {existingTask} = currentTask object
  SET: {lastActivity} = existingTask.startedAt or last timeline entry
  SET: {hoursAgo} = hours between {lastActivity} and now

  IF {hoursAgo} >= 8:  // Session considered abandoned after 8 hours
    OUTPUT:
    ```
    ⚠️ Found abandoned session from {hoursAgo}h ago

    Task: {existingTask.description}
    Session: {existingTask.sessionId}
    Started: {existingTask.startedAt}

    Options:
    1. Resume previous task → /p:resume
    2. Close previous as partial → /p:recover close
    3. View full context → /p:recover

    Choose an option before starting a new task.
    ```
    STOP

## Step 1: Read Config

READ: `.prjct/prjct.config.json`
EXTRACT: `projectId`

IF file not found:
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

## Step 2: Check Current State

### Read state.json (source of truth)
READ: `{statePath}`

IF file exists:
  PARSE JSON
  EXTRACT: {currentTask}, {pausedTask} if present

## Step 3: Handle Cases

### Case A: No task provided - Show current
IF {task} is empty OR not provided:
  IF {currentTask} exists AND {currentTask.status} == "active":
    CALCULATE: {elapsed} = time since {currentTask.startedAt}
    OUTPUT:
    ```
    🎯 {currentTask.description}

    Session: {currentTask.sessionId}
    Started: {currentTask.startedAt} ({elapsed} ago)
    Status: active

    /p:done to complete | /p:pause to pause
    ```
    STOP
  ELSE IF {pausedTask} exists:
    OUTPUT:
    ```
    ⏸️ Paused: {pausedTask.description}

    Duration so far: {pausedTask.duration}

    /p:resume to continue | /p:done to complete
    ```
    STOP
  ELSE:
    OUTPUT: "No current task. Use /p:now <task> to start one."
    STOP

### Case B: Task provided - Create/Update session
IF {task} is provided:

  ## Check for existing active task
  IF {currentTask} exists AND {currentTask.status} == "active":
    IF {currentTask.description} != {task}:
      OUTPUT:
      ```
      ⚠️ Already working on: {currentTask.description}

      Options:
      • /p:done - Complete current task first
      • /p:pause - Pause and switch
      • /p:now (same task) - Continue current
      ```
      STOP

  ## If same task, just continue
  IF {currentTask} AND {currentTask.description} == {task}:
    OUTPUT: "🎯 Continuing: {task}"
    STOP

  ## Create new task
  GENERATE: {taskId} = UUID v4
  GENERATE: {sessionId} = UUID v4
  SET: {startedAt} = GetTimestamp()

  ## Step 4: Write to Storage (SOURCE OF TRUTH)

  ### Prepare task object
  ```json
  {
    "id": "{taskId}",
    "description": "{task}",
    "status": "active",
    "startedAt": "{startedAt}",
    "sessionId": "{sessionId}",
    "estimate": "{estimate OR null}",
    "estimateSeconds": {estimateInSeconds OR null}
  }
  ```

  ### Write state.json
  READ existing `{statePath}` or create empty object
  SET: state.currentTask = new task object
  SET: state.lastUpdated = {startedAt}
  WRITE: `{statePath}`

  ## Step 5: Generate Context (FOR CLAUDE)

  WRITE: `{nowContextPath}`

  IF {estimate} provided:
  ```markdown
  # NOW

  **{task}**

  Started: {startedAt}
  Session: {sessionId}
  Estimate: {estimate}
  ```

  ELSE (no estimate):
  ```markdown
  # NOW

  **{task}**

  Started: {startedAt}
  Session: {sessionId}
  ```

  ## Step 6: Queue Sync Event (FOR BACKEND)

  READ: `{syncPath}` or create empty array
  APPEND event:
  ```json
  {
    "type": "task.started",
    "path": ["state"],
    "data": {
      "taskId": "{taskId}",
      "description": "{task}",
      "startedAt": "{startedAt}",
      "sessionId": "{sessionId}"
    },
    "timestamp": "{startedAt}",
    "projectId": "{projectId}"
  }
  ```
  WRITE: `{syncPath}`

  ## Step 7: Log to Memory (AUDIT TRAIL)

  APPEND to: `{memoryPath}`
  Single line (JSONL):

  IF {estimate} provided:
  ```json
  {"timestamp":"{startedAt}","action":"task_started","taskId":"{taskId}","sessionId":"{sessionId}","task":"{task}","estimate":"{estimate}","estimateSeconds":{estimateInSeconds}}
  ```

  ELSE:
  ```json
  {"timestamp":"{startedAt}","action":"task_started","taskId":"{taskId}","sessionId":"{sessionId}","task":"{task}"}
  ```

## Output

SUCCESS (new task with estimate):
```
🎯 {task}

Session: {sessionId}
Started: now
Estimate: {estimate}

/p:done when finished | /p:pause to take a break
```

SUCCESS (new task without estimate):
```
🎯 {task}

Session: {sessionId}
Started: now

💡 Tip: Add estimate next time with /p:now "task" 2h

/p:done when finished | /p:pause to take a break
```

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No project | "No prjct project" | STOP |
| Active task exists | Show options | STOP |
| Write fails | "Failed to create session" | STOP |

## File Structure Reference

```
~/.prjct-cli/projects/{projectId}/
├── storage/
│   └── state.json          # Source of truth (current + paused tasks)
├── context/
│   └── now.md              # Generated for Claude
├── sync/
│   └── pending.json        # Events for backend
└── memory/
    └── events.jsonl        # Audit trail
```

## Examples

### Example 1: Show Current Task
```
User: /p:now
Output:
🎯 Implement user authentication

Session: 550e8400-e29b-41d4-a716-446655440000
Started: 2 hours ago
Status: active

/p:done to complete | /p:pause to pause
```

### Example 2: Start New Task (without estimate)
```
User: /p:now "Add login form"
Output:
🎯 Add login form

Session: 7c9e6679-7425-40de-944b-e07fc1f90ae7
Started: now

💡 Tip: Add estimate next time with /p:now "task" 2h

/p:done when finished | /p:pause to take a break
```

### Example 3: Start New Task (with estimate)
```
User: /p:now "Add login form" 2h
Output:
🎯 Add login form

Session: 7c9e6679-7425-40de-944b-e07fc1f90ae7
Started: now
Estimate: 2h

/p:done when finished | /p:pause to take a break
```

### Example 4: Task Conflict
```
User: /p:now "Something else"
Output:
⚠️ Already working on: Add login form

Options:
• /p:done - Complete current task first
• /p:pause - Pause and switch
• /p:now (same task) - Continue current
```
