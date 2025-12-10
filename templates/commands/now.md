---
allowed-tools: [Read, Write, Bash]
description: 'Set or show current task with session tracking'
timestamp-rule: 'GetTimestamp() for ALL timestamps'
architecture: 'JSON-first - Write to data/*.json, views are generated'
---

# /p:now - Current Task with Session Tracking

## Architecture: JSON-First

**Source of Truth**: `data/state.json`
**Generated View**: `views/now.md` (auto-generated, do not edit directly)

All writes go to JSON. After writing, run `prjct generate-views --project={projectId}` to regenerate MD views.

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{dataPath}`: `{globalPath}/data`
- `{statePath}`: `{dataPath}/state.json`
- `{sessionPath}`: `{globalPath}/sessions/current.json`
- `{memoryPath}`: `{globalPath}/memory/context.jsonl`
- `{task}`: User-provided task (optional)

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
  PARSE as JSON
  EXTRACT: {currentTask} from state.currentTask

### Check for active session (legacy support)
READ: `{sessionPath}`

IF file exists:
  PARSE as JSON
  EXTRACT: {session.task}, {session.status}, {session.startedAt}, {session.duration}

## Step 3: Handle Cases

### Case A: No task provided - Show current
IF {task} is empty OR not provided:
  IF {currentTask} exists AND {status} == "active":
    CALCULATE: {elapsed} = time since {startedAt}
    OUTPUT:
    ```
    🎯 {currentTask}

    Session: {sessionId}
    Started: {startedAt} ({elapsed} ago)
    Status: active

    /p:done to complete | /p:pause to pause
    ```
    STOP
  ELSE IF {currentTask} exists AND {status} == "paused":
    OUTPUT:
    ```
    ⏸️ Paused: {currentTask}

    Duration so far: {duration}

    /p:resume to continue | /p:done to complete
    ```
    STOP
  ELSE:
    OUTPUT: "No current task. Use /p:now <task> to start one."
    STOP

### Case B: Task provided - Create/Update session
IF {task} is provided:

  ## Check for existing active session
  IF {status} == "active" AND {currentTask} != {task}:
    OUTPUT:
    ```
    ⚠️ Already working on: {currentTask}

    Options:
    • /p:done - Complete current task first
    • /p:pause - Pause and switch
    • /p:now (same task) - Continue current
    ```
    STOP

  ## If same task, just continue
  IF {currentTask} == {task}:
    OUTPUT: "🎯 Continuing: {task}"
    STOP

  ## Create new session
  GENERATE: {sessionId} = "sess_" + 8 random alphanumeric chars
  SET: {startedAt} = GetTimestamp()

  ### Write state.json (SOURCE OF TRUTH)
  READ: `{statePath}` (or create default if not exists)

  UPDATE state.json:
  ```json
  {
    "currentTask": {
      "id": "task_{8_random_chars}",
      "description": "{task}",
      "startedAt": "{startedAt}",
      "sessionId": "{sessionId}"
    },
    "lastUpdated": "{startedAt}"
  }
  ```

  WRITE: `{statePath}`

  ### Create session JSON (for detailed tracking)
  WRITE: `{sessionPath}`
  Content:
  ```json
  {
    "id": "{sessionId}",
    "projectId": "{projectId}",
    "task": "{task}",
    "status": "active",
    "startedAt": "{startedAt}",
    "pausedAt": null,
    "completedAt": null,
    "duration": 0,
    "metrics": {
      "filesChanged": 0,
      "linesAdded": 0,
      "linesRemoved": 0,
      "commits": 0,
      "snapshots": []
    },
    "timeline": [
      {"type": "start", "at": "{startedAt}"}
    ]
  }
  ```

  ### Generate views (auto-regenerate MD from JSON)
  BASH: `cd {projectRoot} && npx prjct-generate-views --project={projectId}`

  Note: This regenerates views/now.md from data/state.json automatically.

  ### Log to memory
  APPEND to: `{memoryPath}`
  Single line (JSONL):
  ```json
  {"timestamp":"{startedAt}","action":"session_started","sessionId":"{sessionId}","task":"{task}"}
  ```

## Output

SUCCESS (new task):
```
🎯 {task}

Session: {sessionId}
Started: now

/p:done when finished | /p:pause to take a break
```

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No project | "No prjct project" | STOP |
| Active session exists | Show options | STOP |
| Write fails | "Failed to create session" | STOP |

## Examples

### Example 1: Show Current Task
```
User: /p:now
Output:
🎯 Implement user authentication

Session: sess_abc12345
Started: 2 hours ago
Status: active

/p:done to complete | /p:pause to pause
```

### Example 2: Start New Task
```
User: /p:now "Add login form"
Output:
🎯 Add login form

Session: sess_xyz98765
Started: now

/p:done when finished | /p:pause to take a break
```

### Example 3: Task Conflict
```
User: /p:now "Something else"
Output:
⚠️ Already working on: Add login form

Options:
• /p:done - Complete current task first
• /p:pause - Pause and switch
• /p:now (same task) - Continue current
```
