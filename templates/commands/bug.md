---
allowed-tools: [Read, Write, Bash, Task, Glob, AskUserQuestion]
description: 'Report bug with auto-priority and auto-start'
architecture: 'Write-Through (JSON → MD → Events)'
storage-layer: true
source-of-truth: 'storage/queue.json + storage/state.json'
claude-context: 'context/next.md + context/now.md'
backend-sync: 'sync/pending.json'
---

# /p:bug - Report Bug with Auto-Start

## Usage

```
/p:bug <description> [--later]
```

- `description`: Bug description
- `--later`: Only queue, don't auto-start (default: auto-starts)

## Architecture: Write-Through Pattern

```
User Action → Storage (JSON) → Context (MD) → Sync Events
```

**Source of Truth**: `storage/queue.json` + `storage/state.json`
**Claude Context**: `context/next.md` + `context/now.md` (generated)
**Backend Sync**: `sync/pending.json` (events)

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{queuePath}`: `{globalPath}/storage/queue.json`
- `{statePath}`: `{globalPath}/storage/state.json`
- `{nextContextPath}`: `{globalPath}/context/next.md`
- `{nowContextPath}`: `{globalPath}/context/now.md`
- `{syncPath}`: `{globalPath}/sync/pending.json`
- `{memoryPath}`: `{globalPath}/memory/events.jsonl`
- `{description}`: User-provided bug description

## Severity Keywords

| Keywords | Severity | Queue Position |
|----------|----------|----------------|
| crash, down, broken, production | Critical | Top |
| error, fail, issue | High | Top |
| bug, incorrect, wrong | Medium | Normal |
| minor, typo, cosmetic | Low | Bottom |

## Step 1: Read Config

READ: `.prjct/prjct.config.json`
EXTRACT: `projectId`

IF file not found:
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

## Step 2: Parse Arguments

SET: {laterFlag} = false
IF args contain "--later":
  SET: {laterFlag} = true
  REMOVE "--later" from description

PARSE description for severity keywords
SET: {severity} based on keywords found (default: "medium")

## Step 3: Generate IDs and Timestamps

GET timestamp:
```bash
bun -e "console.log(new Date().toISOString())" 2>/dev/null || node -e "console.log(new Date().toISOString())"
```

GET taskId (UUID):
```bash
bun -e "console.log(crypto.randomUUID())" 2>/dev/null || node -e "console.log(require('crypto').randomUUID())"
```

SET: {now} = timestamp
SET: {taskId} = UUID
SET: {bugDescription} = "🐛 {description}"

## Step 4: Update Queue Storage (SOURCE OF TRUTH)

### Create bug task
```json
{
  "id": "{taskId}",
  "description": "{bugDescription}",
  "type": "bug",
  "priority": "{severity}",
  "section": "active",
  "createdAt": "{now}"
}
```

### Update queue.json
READ: `{queuePath}` (or create empty { "tasks": [] })
IF severity is "critical" or "high":
  INSERT at top of tasks array
ELSE:
  APPEND to tasks array
SET: lastUpdated = {now}
WRITE: `{queuePath}`

### Calculate queue position
{position} = index of task in array + 1

## Step 5: Handle Active Task (AGENTIC)

READ: `{statePath}`

IF {laterFlag} == true:
  {autoStarted} = false
  → Skip to Step 6

IF currentTask exists AND status == "active":
  SET: {conflictTask} = currentTask.description
  SET: {elapsedTime} = time since currentTask.startedAt (format: "Xh Ym" or "Xm")

  USE AskUserQuestion:
  ```
  question: "Bug [{severity}]: {description}. Active task: '{conflictTask}' ({elapsedTime}). How to proceed?"
  header: "Bug Reported"
  options:
    - label: "Pause current and fix bug"
      description: "Interrupt '{conflictTask}', start bug fix now"
    - label: "Queue bug for later"
      description: "Add to queue, continue current task"
  ```

  IF choice == "Queue bug for later":
    SET: {autoStarted} = false
    → Skip to Step 6

  IF choice == "Pause current and fix bug":
    ### Save current task as interrupted (different from paused)
    SET: {now} = GetTimestamp()
    SET: state.interruptedTask = {
      ...currentTask,
      "interruptedAt": "{now}",
      "interruptReason": "bug",
      "interruptedBy": "{taskId}"
    }

    APPEND to `{memoryPath}`:
    ```json
    {"timestamp":"{now}","action":"task_interrupted","taskId":"{currentTask.id}","reason":"bug","bugId":"{taskId}"}
    ```

    OUTPUT: "Paused: {conflictTask}"
    → Continue to Start Bug below

### No active task - Auto-Start
GENERATE: {sessionId} = UUID v4
```bash
bun -e "console.log(crypto.randomUUID())" 2>/dev/null || node -e "console.log(require('crypto').randomUUID())"
```

### Step 5.5: Create Bug Branch

#### Check Current Branch
BASH: `git branch --show-current`
SET: {currentBranch} = result

IF {currentBranch} == "main" OR {currentBranch} == "master":
  OUTPUT: "Creating bug branch..."

  #### Handle Uncommitted Changes
  BASH: `git status --porcelain`
  SET: {hasChanges} = (result not empty)

  IF {hasChanges}:
    IF {severity} == "critical" OR {severity} == "high":
      # Auto-stash for urgent bugs
      BASH: `git stash push -m "prjct: stashed for urgent bug fix"`
      SET: {stashedChanges} = true
      OUTPUT: "Stashed changes for urgent bug fix"
    ELSE:
      USE AskUserQuestion:
      ```
      question: "Uncommitted changes detected. How to proceed?"
      header: "Git Changes"
      options:
        - label: "Stash changes"
          description: "Temporarily save changes, create branch, then continue"
        - label: "Commit first"
          description: "Commit current changes before switching"
        - label: "Abort"
          description: "Cancel and queue bug for later"
      ```

      IF choice == "Stash changes":
        BASH: `git stash push -m "prjct: stashed for {description}"`
        SET: {stashedChanges} = true
      ELSE IF choice == "Commit first":
        OUTPUT: "Commit your changes first, then run /p:bug again"
        STOP
      ELSE:
        SET: {laterFlag} = true
        SET: {autoStarted} = false
        → Skip to Step 6

  #### Create Bug Branch
  SET: {bugSlug} = slugify({description})
  LIMIT: {bugSlug} to 50 characters, lowercase, replace spaces with hyphens
  SET: {branchName} = "bug/{bugSlug}"

  BASH: `git checkout -b {branchName}`
  IF command fails (branch exists):
    BASH: `git checkout {branchName}`
    IF still fails:
      OUTPUT: "Failed to create/checkout branch: {branchName}"
      SET: {laterFlag} = true
      SET: {autoStarted} = false
      → Skip to Step 6

  SET: {branchCreated} = true
  SET: {baseBranch} = {currentBranch}
  OUTPUT: "✅ Created branch: {branchName}"

ELSE:
  SET: {branchName} = {currentBranch}
  SET: {branchCreated} = false
  SET: {baseBranch} = null

### Update state.json
```json
{
  "currentTask": {
    "id": "{taskId}",
    "description": "{bugDescription}",
    "status": "active",
    "startedAt": "{now}",
    "sessionId": "{sessionId}",
    "type": "bug",
    "priority": "{severity}",
    "branch": {
      "name": "{branchName}",
      "createdByPrjct": {branchCreated},
      "baseBranch": "{baseBranch}",
      "createdAt": "{now}"
    }
  },
  "previousTask": {existing previousTask if any},
  "lastUpdated": "{now}"
}
```
WRITE: `{statePath}`

### Generate context/now.md
```markdown
# NOW

**{bugDescription}**

Priority: {severity}
Started: {now}
Session: {sessionId}
Branch: {branchName}
```
WRITE: `{nowContextPath}`

{autoStarted} = true

## Step 6: Queue Sync Events

READ: `{syncPath}` or create empty array

### Queue added event
APPEND:
```json
{
  "type": "queue.task_added",
  "path": ["queue"],
  "data": {
    "taskId": "{taskId}",
    "description": "{bugDescription}",
    "priority": "{severity}",
    "type": "bug"
  },
  "timestamp": "{now}",
  "projectId": "{projectId}"
}
```

### Task started event (if auto-started)
IF {autoStarted}:
  APPEND:
  ```json
  {
    "type": "task.started",
    "path": ["state"],
    "data": {
      "taskId": "{taskId}",
      "description": "{bugDescription}",
      "sessionId": "{sessionId}"
    },
    "timestamp": "{now}",
    "projectId": "{projectId}"
  }
  ```

WRITE: `{syncPath}`

## Step 7: Log to Memory

APPEND to `{memoryPath}`:

IF {autoStarted}:
```json
{"timestamp":"{now}","action":"bug_reported_started","taskId":"{taskId}","sessionId":"{sessionId}","description":"{bugDescription}","priority":"{severity}"}
```

ELSE:
```json
{"timestamp":"{now}","action":"bug_reported","taskId":"{taskId}","description":"{bugDescription}","priority":"{severity}"}
```

## Output

### Auto-Started (default)
```
🐛 [{severity}] {description}

Branch: {branchName}
Session: {sessionId}

/p:done when fixed
```

### Queue Only (--later flag)
```
🐛 [{severity}] {description}

Queued at position #{position}
Priority: {severity}

Start: /p:now "{bugDescription}"
```

### Interrupted Task (user chose to fix bug)
```
🐛 [{severity}] {description}

⏸️ Paused: {conflictTask}
Branch: {branchName}
Session: {sessionId}

p. done when fixed → will ask to resume '{conflictTask}'
```

## Examples

### Example 1: Auto-Start Bug Fix (default)
```
Input: /p:bug login form not validating

Output:
🐛 [medium] login form not validating

Started working on fix
Session: a1b2c3d4-...

/p:done when fixed
```

### Example 2: Queue for Later
```
Input: /p:bug minor typo in footer --later

Output:
🐛 [low] minor typo in footer

Queued at position #5
Priority: low

Start: /p:now "🐛 minor typo in footer"
```

### Example 3: Critical Bug (Auto-Start)
```
Input: /p:bug production server is down

Output:
🐛 [critical] production server is down

Started working on fix
Session: x9y8z7w6-...

/p:done when fixed
```

### Example 4: Bug While Working on Task (Agentic)
```
Input: /p:bug payment not processing

[AskUserQuestion appears]:
Bug [high]: payment not processing. Active task: 'implement auth flow' (45m). How to proceed?
- Pause current and fix bug
- Queue bug for later

User chooses: "Pause current and fix bug"

Output:
🐛 [high] payment not processing

⏸️ Paused: implement auth flow
Branch: bug/payment-not-processing
Session: x9y8z7w6-...

p. done when fixed → will ask to resume 'implement auth flow'
```

### Example 5: Bug Queued for Later (Agentic)
```
Input: /p:bug minor css alignment issue

[AskUserQuestion appears]:
Bug [low]: minor css alignment issue. Active task: 'implement auth flow' (1h 15m). How to proceed?
- Pause current and fix bug
- Queue bug for later

User chooses: "Queue bug for later"

Output:
🐛 [low] minor css alignment issue

Queued at position #3
Priority: low

Start: p. task "🐛 minor css alignment issue"
```

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No project | "No prjct project" | STOP |
| On protected branch with changes | Ask/auto-stash for urgent | WAIT |
| Branch creation fails | Queue bug for later | CONTINUE |
| Write fails | Log warning | CONTINUE |
