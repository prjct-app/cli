---
allowed-tools: [Read, Write, Bash]
description: 'Set or show current task with session tracking'
---

# /p:now - Current Task

Start a new task or show current task status.

## Usage
```
/p:now [task] [estimate]
```
- `task`: Description of what you're working on
- `estimate`: Time estimate (e.g., "2h", "30m", "1d")

## Flow

### Step 1: Validate
READ: `.prjct/prjct.config.json` → extract `projectId`
IF missing: "No prjct project. Run /p:init first." → STOP

SET: `{globalPath}` = `~/.prjct-cli/projects/{projectId}`

READ: `{globalPath}/storage/state.json`

### Step 2: Handle Cases

**Case A: No task provided - Show current**
IF task not provided:
  IF currentTask exists AND status == "active":
    CALCULATE elapsed time
    OUTPUT:
    ```
    🎯 {currentTask.description}

    Session: {sessionId}
    Started: {elapsed} ago

    /p:done to complete | /p:pause to pause
    ```
    STOP
  ELSE:
    OUTPUT: "No current task. Use /p:now <task> to start one."
    STOP

**Case B: Task provided - Check conflicts**
IF currentTask exists AND status == "active" AND description != task:
  OUTPUT:
  ```
  ⚠️ Already working on: {currentTask.description}

  Options:
  • /p:done - Complete current task first
  • /p:pause - Pause and switch
  ```
  STOP

**Case C: Same task - Continue**
IF currentTask.description == task:
  OUTPUT: "🎯 Continuing: {task}"
  STOP

### Step 3: Create New Task
GET timestamp: `bun -e "console.log(new Date().toISOString())" 2>/dev/null || node -e "console.log(new Date().toISOString())"`
GET uuid: `bun -e "console.log(crypto.randomUUID())" 2>/dev/null || node -e "console.log(require('crypto').randomUUID())"`

SET: `{taskId}` = uuid
SET: `{sessionId}` = uuid (different call)
SET: `{startedAt}` = timestamp

IF estimate provided:
  PARSE to seconds (30m=1800, 2h=7200, 1d=28800)

### Step 4: Update Storage
WRITE to `{globalPath}/storage/state.json`:
```json
{
  "currentTask": {
    "id": "{taskId}",
    "description": "{task}",
    "status": "active",
    "startedAt": "{startedAt}",
    "sessionId": "{sessionId}",
    "estimate": "{estimate}",
    "estimateSeconds": {estimateSeconds}
  },
  "lastUpdated": "{startedAt}"
}
```

### Step 5: Generate Context
WRITE: `{globalPath}/context/now.md`:
```markdown
# NOW

**{task}**

Started: {startedAt}
Session: {sessionId}
```

### Step 6: Log Events
APPEND to `{globalPath}/sync/pending.json`
APPEND to `{globalPath}/memory/events.jsonl`

### Step 7: Output

WITH estimate:
```
🎯 {task}

Session: {sessionId}
Estimate: {estimate}

/p:done when finished | /p:pause to take a break
```

WITHOUT estimate:
```
🎯 {task}

Session: {sessionId}

💡 Tip: Add estimate next time with /p:now "task" 2h

/p:done when finished | /p:pause to take a break
```

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No project | "No prjct project" | STOP |
| Active task exists | Show options | STOP |
| Write fails | "Failed to create session" | STOP |

## References
- Architecture: `~/.prjct-cli/docs/architecture.md`
- Commands: `~/.prjct-cli/docs/commands.md`
