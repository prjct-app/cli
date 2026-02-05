---
allowed-tools: [Read, Write, Bash, Task, AskUserQuestion]
---

# p. bug "$ARGUMENTS"

## Step 1: Validate Arguments

```
IF $ARGUMENTS is empty:
  ASK: "What bug do you want to report?"
  WAIT for response
  DO NOT proceed with empty description
```

## Step 2: Resolve Project Paths

```bash
# Get projectId from local config
cat .prjct/prjct.config.json | grep -o '"projectId"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4
```

Set `globalPath = ~/.prjct-cli/projects/{projectId}`

## Step 3: Parse Severity from Keywords

Analyze `$ARGUMENTS` for severity indicators:
- `crash`, `down`, `broken`, `production`, `critical` → **critical**
- `error`, `fail`, `exception`, `cannot` → **high**
- `bug`, `incorrect`, `wrong`, `issue` → **medium** (default)
- `minor`, `typo`, `cosmetic`, `ui` → **low**

## Step 4: Explore Codebase

```
USE Task(Explore) → find affected files, recent commits related to the bug
```

## Step 5: Check for Active Task

READ `{globalPath}/storage/state.json`

```
IF currentTask exists AND currentTask.status == "active":
  AskUserQuestion:
    question: "You have an active task. How should we handle this bug?"
    header: "Bug"
    options:
      - label: "Pause current and fix bug (Recommended)"
        description: "Save current task, start bug fix"
      - label: "Queue bug for later"
        description: "Add to queue, continue current task"

  IF "Queue bug for later":
    # Add to queue and stop
    READ {globalPath}/storage/queue.json (or create empty array)
    APPEND bug to queue:
    {
      "id": "{uuid}",
      "type": "bug",
      "description": "$ARGUMENTS",
      "severity": "{severity}",
      "createdAt": "{timestamp}",
      "status": "queued"
    }
    WRITE {globalPath}/storage/queue.json

    OUTPUT:
    """
    🐛 Queued: $ARGUMENTS [{severity}]

    Continue with: {currentTask.description}

    Later: `p. task` to work on queued bug
    """
    STOP

  IF "Pause current and fix bug":
    # Move current task to pausedTasks
    # Will be handled in Step 6
```

## Step 6: Create Bug Branch

```bash
git branch --show-current
```

```
IF current branch == "main" OR "master":
  # Create bug fix branch
  slug = sanitize($ARGUMENTS) # lowercase, hyphens, max 50 chars

  git checkout -b bug/{slug}

  IF git command fails:
    OUTPUT: "Failed to create branch. Check git status."
    STOP
```

## Step 7: Write State

Generate UUID and timestamp:
```bash
node -e "console.log(require('crypto').randomUUID())"
node -e "console.log(new Date().toISOString())"
```

READ current state, then update:

```
# If there was an active task, move it to pausedTasks
IF state.currentTask exists:
  interruptedTask = state.currentTask
  interruptedTask.status = "interrupted"
  interruptedTask.interruptedAt = "{timestamp}"
  interruptedTask.interruptedBy = "{new bug task id}"

  state.pausedTasks = state.pausedTasks || []
  state.pausedTasks.push(interruptedTask)
```

WRITE `{globalPath}/storage/state.json`:
```json
{
  "currentTask": {
    "id": "{uuid}",
    "description": "$ARGUMENTS",
    "type": "bug",
    "severity": "{severity}",
    "status": "active",
    "startedAt": "{timestamp}",
    "branch": "bug/{slug}",
    "affectedFiles": ["{files from exploration}"]
  },
  "pausedTasks": [{interruptedTask if any}]
}
```

## Step 8: Log Event

APPEND to `{globalPath}/memory/events.jsonl`:
```json
{"type":"bug_reported","taskId":"{uuid}","description":"$ARGUMENTS","severity":"{severity}","timestamp":"{timestamp}","branch":"bug/{slug}"}
```

---

## Output

```
🐛 [{severity}] $ARGUMENTS

Affected: {files from exploration}
Branch: bug/{slug}

{IF interruptedTask: "Paused: {interruptedTask.description}"}

Next:
- Fix the bug → work on code
- When fixed → `p. done`
- Resume previous → `p. resume`
```
