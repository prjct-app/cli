---
allowed-tools: [Read, Write, Bash, AskUserQuestion]
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

### Step 2.5: Git Branch Management

#### 2.5.1 Check Current Branch
BASH: `git branch --show-current`
SET: {currentBranch} = result

#### 2.5.2 Block Protected Branches
IF {currentBranch} == "main" OR {currentBranch} == "master":
  OUTPUT:
  ```
  ⚠️ Cannot work on protected branch: {currentBranch}

  Creating feature branch for your task...
  ```

  #### 2.5.3 Handle Uncommitted Changes
  BASH: `git status --porcelain`
  SET: {hasChanges} = (result not empty)

  IF {hasChanges}:
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
        description: "Cancel and keep working on current branch"
    ```

    IF choice == "Stash changes":
      BASH: `git stash push -m "prjct: stashed for {task}"`
      SET: {stashedChanges} = true
    ELSE IF choice == "Commit first":
      OUTPUT: "Commit your changes first, then run /p:now again"
      STOP
    ELSE:
      OUTPUT: "Aborted. Staying on {currentBranch}"
      STOP

  #### 2.5.4 Create Feature Branch
  SET: {taskSlug} = slugify({task})
  LIMIT: {taskSlug} to 50 characters, lowercase, replace spaces with hyphens

  SET: {taskType} = "feature" (or "bug" if task contains bug keywords)
  SET: {branchName} = "{taskType}/{taskSlug}"

  BASH: `git checkout -b {branchName}`
  IF command fails (branch exists):
    BASH: `git checkout {branchName}`
    IF still fails:
      OUTPUT: "Failed to create/checkout branch: {branchName}"
      STOP

  SET: {branchCreated} = true
  SET: {baseBranch} = {currentBranch}
  OUTPUT: "✅ Created branch: {branchName}"

ELSE:
  SET: {branchName} = {currentBranch}
  SET: {branchCreated} = false
  SET: {baseBranch} = null

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
    "estimateSeconds": {estimateSeconds},
    "branch": {
      "name": "{branchName}",
      "createdByPrjct": {branchCreated},
      "baseBranch": "{baseBranch}",
      "createdAt": "{startedAt}"
    }
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
Branch: {branchName}
```

### Step 6: Log Events
APPEND to `{globalPath}/sync/pending.json`
APPEND to `{globalPath}/memory/events.jsonl`

### Step 7: Output

WITH branch created:
```
🎯 {task}

Branch: {branchName}
Session: {sessionId}
{IF estimate: Estimate: {estimate}}

/p:done when finished | /p:pause to take a break
```

WITHOUT branch created (already on feature branch):
```
🎯 {task}

Branch: {branchName} (existing)
Session: {sessionId}
{IF estimate: Estimate: {estimate}}

/p:done when finished | /p:pause to take a break
```

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No project | "No prjct project" | STOP |
| Active task exists | Show options | STOP |
| On protected branch with changes | Ask: stash/commit/abort | WAIT |
| Branch creation fails | "Failed to create branch" | STOP |
| Write fails | "Failed to create session" | STOP |

## References
- Architecture: `~/.prjct-cli/docs/architecture.md`
- Commands: `~/.prjct-cli/docs/commands.md`
