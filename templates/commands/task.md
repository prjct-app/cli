---
allowed-tools: [Read, Write, Bash, Task, Glob, Grep, AskUserQuestion]
---

# p. task "$ARGUMENTS"

## ⛔ MANDATORY PRE-FLIGHT CHECKS

**Execute these checks BEFORE any task creation:**

### Check 1: Validate Arguments

```
IF $ARGUMENTS is empty:
  ASK: "What task do you want to start?"
  WAIT for response
  DO NOT proceed with empty task
```

### Check 2: Resolve Project Paths

```bash
# Get projectId from local config
cat .prjct/prjct.config.json | grep -o '"projectId"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4
```

Set `globalPath = ~/.prjct-cli/projects/{projectId}`

### Check 3: Check for Active Task

```
READ: {globalPath}/storage/state.json

IF currentTask exists AND currentTask.status == "active":
  OUTPUT:
  """
  ⚠️ Active task detected: {currentTask.description}

  Options:
  1. Complete current task first → `p. done`
  2. Pause current task → `p. pause`
  3. Switch anyway (current task will be paused)
  """

  ASK: "What would you like to do?"
  WAIT for explicit choice
  DO NOT automatically switch tasks
```

### Check 4: Validate Git State

```bash
git status --porcelain
```

```
IF uncommitted changes exist:
  OUTPUT:
  """
  ⚠️ You have uncommitted changes:
  {list of files}

  Commit or stash them before starting a new task.
  """

  ASK: "Would you like to commit these changes first?"
  WAIT for response
```

---

## Step 0: Detect Issue Tracker Reference

IF `$ARGUMENTS` matches pattern `/^[A-Z]+-\d+$/` (e.g., PRJ-123, PROJ-456):

```
READ: {globalPath}/project.json
CHECK: integrations.linear OR integrations.jira

IF integrations.linear.enabled:
  # Linear issue detected - use LOCAL-FIRST approach
  # Try local cache first (issues.json), then API if not found

  RUN: bun $PRJCT_CLI/core/cli/linear.ts --project {projectId} get-local "$ARGUMENTS"

  IF issue found in local cache:
    USE cached issue data (no API call needed)
  ELSE:
    # Fallback to API - sync and retry
    RUN: bun $PRJCT_CLI/core/cli/linear.ts --project {projectId} sync
    RUN: bun $PRJCT_CLI/core/cli/linear.ts --project {projectId} get-local "$ARGUMENTS"

  IF issue found:
    SET: task.linearId = issue.identifier     # "PRJ-123"
    SET: task.linearUuid = issue.id           # Linear internal UUID
    SET: task.description = issue.title
    SET: $ARGUMENTS = issue.title  # Use title for task

    # Mark issue as In Progress in Linear (REQUIRED - DO NOT SKIP)
    RUN: bun $PRJCT_CLI/core/cli/linear.ts --project {projectId} start "{task.linearId}"

    OUTPUT: "Linked to Linear: {issue.identifier} - {issue.title}"
    OUTPUT: "Linear: → In Progress ✓"

ELSE IF integrations.jira.enabled:
  # JIRA issue detected
  RUN: bun $PRJCT_CLI/core/cli/jira.ts --project {projectId} get "$ARGUMENTS"

  IF issue found:
    SET: task.externalId = issue.externalId
    SET: task.externalProvider = "jira"
    SET: task.description = issue.title
    SET: $ARGUMENTS = issue.title  # Use title for task

    # Mark issue as In Progress in JIRA
    RUN: bun $PRJCT_CLI/core/cli/jira.ts --project {projectId} status "$ARGUMENTS" "in_progress"

    OUTPUT: "Linked to JIRA: {issue.externalId} - {issue.title}"
    OUTPUT: "JIRA: In Progress"

ELSE:
  OUTPUT: "Issue tracker not configured. Run `p. linear setup` or `p. jira setup`"
```

---

## Main Flow

### Step A: Explore Codebase (for context)

```
USE Task(Explore) → find similar code, affected files
READ {globalPath}/agents/*.md → get domain patterns (if they exist)
```

### Step B: Classify Task

Determine type based on keywords:
- `add`, `create`, `implement`, `new` → **feature**
- `fix`, `repair`, `broken`, `error` → **bug**
- `improve`, `enhance`, `optimize` → **improvement**
- `refactor`, `clean`, `reorganize` → **refactor**
- `update`, `upgrade`, `migrate` → **chore**

Default: **feature**

### Step C: Break Down into Subtasks

Create 2-5 actionable subtasks based on the task description.

### Step D: Show Plan and Get Approval (BLOCKING)

**⛔ DO NOT create branches or modify state without user approval.**

Show the user:
```
## Task Plan

Description: $ARGUMENTS
Type: {classified type}
Branch: {type}/{slug}

Subtasks:
1. {subtask 1}
2. {subtask 2}
...

Will do:
1. Create feature branch from current branch
2. Initialize task tracking in state.json
3. Begin work on first subtask
{If Linear: 4. Update issue status to In Progress}
```

Then ask for confirmation:

```
AskUserQuestion:
  question: "Start this task?"
  header: "Task"
  options:
    - label: "Yes, start task (Recommended)"
      description: "Create branch and begin tracking"
    - label: "No, cancel"
      description: "Don't create task"
    - label: "Modify plan"
      description: "Change type, branch name, or subtasks"
```

**Handle responses:**

**If "Modify plan":**
- Ask: "What would you like to change?"
- Update plan accordingly
- Ask again with Yes/No options only

**If "No, cancel":**
```
OUTPUT: "✅ Task creation cancelled"
STOP - Do not continue
```

**If "Yes, start task":**
CONTINUE to Step E

### Step E: Create Branch (if needed)

```bash
git branch --show-current
```

```
IF current branch == "main" OR "master":
  OUTPUT: "Creating feature branch: {type}/{slug}"

  git checkout -b {type}/{slug}

  IF git command fails:
    OUTPUT: "Failed to create branch. Check git status."
    STOP
```

### Step F: Write State

Generate UUID and timestamp:
```bash
# UUID
node -e "console.log(require('crypto').randomUUID())"

# Timestamp
node -e "console.log(new Date().toISOString())"
```

WRITE `{globalPath}/storage/state.json`:
```json
{
  "currentTask": {
    "id": "{uuid}",
    "description": "{first subtask description}",
    "type": "{type}",
    "status": "active",
    "startedAt": "{timestamp}",
    "subtasks": [
      {"description": "{subtask 1}", "status": "active"},
      {"description": "{subtask 2}", "status": "pending"},
      {"description": "{subtask 3}", "status": "pending"}
    ],
    "currentSubtaskIndex": 0,
    "parentDescription": "$ARGUMENTS",
    "branch": "{type}/{slug}",
    "linearId": "{identifier or null}",
    "linearUuid": "{uuid or null}"
  },
  "pausedTasks": []
}
```

### Step G: Log Event

APPEND to `{globalPath}/memory/events.jsonl`:
```json
{"type":"task_started","taskId":"{uuid}","description":"$ARGUMENTS","timestamp":"{timestamp}","branch":"{branch}"}
```

---

## Output

```
✅ {type}: $ARGUMENTS

Branch: {branch} | Subtasks: {count}
{linearId ? "Linear: {linearId} → In Progress" : ""}

Current: {first subtask}

Next: Work on subtask, then `p. done`
```
