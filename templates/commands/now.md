---
allowed-tools: [Read, Write, Bash]
description: 'Set or show current task with session tracking'
timestamp-rule: 'GetTimestamp() for ALL timestamps'
architecture: 'MD-first - MD files are source of truth'
---

# /p:now - Current Task with Session Tracking

## Architecture: MD-First

**Source of Truth**: `core/now.md`

MD files are the source of truth. Write directly to MD files.

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{nowPath}`: `{globalPath}/core/now.md`
- `{sessionPath}`: `{globalPath}/sessions/current.json`
- `{memoryPath}`: `{globalPath}/memory/context.jsonl`
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

## Step 0: Detect Abandoned Sessions (BEFORE anything else)

READ: `{sessionPath}` (`~/.prjct-cli/projects/{projectId}/sessions/current.json`)

IF file exists AND has content:
  PARSE as JSON -> {existingSession}

  IF {existingSession.status} == "active":
    SET: {lastActivity} = last timestamp in {existingSession.timeline}
    SET: {hoursAgo} = hours between {lastActivity} and now

    IF {hoursAgo} >= 8:  // Session considered abandoned after 8 hours
      OUTPUT:
      ```
      ⚠️ Found abandoned session from {hoursAgo}h ago

      Task: {existingSession.task}
      Session: {existingSession.id}
      Started: {existingSession.startedAt}

      {IF existingSession.context.prompt exists:}
      📝 Original prompt:
      "{existingSession.context.prompt}"

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

### Read now.md (source of truth)
READ: `{nowPath}`

IF file exists AND has content:
  PARSE MD format:
  - Look for `**Task description**` (bold text = current task)
  - Look for `Started: {timestamp}`
  - Look for `Session: {sessionId}`
  EXTRACT: {currentTask}, {startedAt}, {sessionId}

### Check for active session (for detailed tracking)
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

  ### Write now.md (SOURCE OF TRUTH)

  WRITE: `{nowPath}`

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

  ### Capture context (CRITICAL for recovery)
  SET: {userPrompt} = full text of user's message that triggered /p:now
  SET: {promptLength} = character count of {userPrompt}

  ### Detect relevant files
  BASH: `git status --short 2>/dev/null | head -10`
  PARSE: Extract file paths as {relevantFiles} array

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
    "estimate": "{estimate OR null}",
    "estimateSeconds": {estimateInSeconds OR null},
    "context": {
      "prompt": "{userPrompt}",
      "promptLength": {promptLength},
      "files": {relevantFiles OR []}
    },
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

  ### Convert estimate to seconds
  IF {estimate} provided:
    - "30m" → 1800 seconds
    - "2h" → 7200 seconds
    - "1d" → 28800 seconds (8 hours)
    - "2h30m" → 9000 seconds

  ### Log to memory
  APPEND to: `{memoryPath}`
  Single line (JSONL):

  IF {estimate} provided:
  ```json
  {"timestamp":"{startedAt}","action":"session_started","sessionId":"{sessionId}","task":"{task}","estimate":"{estimate}","estimateSeconds":{estimateInSeconds}}
  ```

  ELSE:
  ```json
  {"timestamp":"{startedAt}","action":"session_started","sessionId":"{sessionId}","task":"{task}"}
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

### Example 2: Start New Task (without estimate)
```
User: /p:now "Add login form"
Output:
🎯 Add login form

Session: sess_xyz98765
Started: now

💡 Tip: Add estimate next time with /p:now "task" 2h

/p:done when finished | /p:pause to take a break
```

### Example 2b: Start New Task (with estimate)
```
User: /p:now "Add login form" 2h
Output:
🎯 Add login form

Session: sess_xyz98765
Started: now
Estimate: 2h

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
