---
allowed-tools: [Read, Write, Bash]
description: 'Set or show current task with session tracking'
timestamp-rule: 'GetTimestamp() for ALL timestamps'
---

# /p:now - Current Task with Session Tracking

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{nowPath}`: `{globalPath}/core/now.md`
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

### Check for active session
READ: `{sessionPath}`

IF file exists:
  PARSE as JSON
  EXTRACT: {currentTask}, {status}, {startedAt}, {duration}

### Check now.md
READ: `{nowPath}`

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

  ### Create session JSON
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

  ### Update now.md (legacy support)
  WRITE: `{nowPath}`
  Content:
  ```markdown
  # NOW

  **{task}**

  Started: {startedAt}
  Session: {sessionId}
  ```

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
