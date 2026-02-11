---
allowed-tools: [Read, Bash, Task, Glob, Grep, AskUserQuestion]
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

### Check 2: Check for Active Task

```bash
prjct dash compact
```

```
IF output shows an active task (🎯):
  OUTPUT:
  """
  ⚠️ Active task detected.

  Options:
  1. Complete current task first → `p. done`
  2. Pause current task → `p. pause`
  3. Switch anyway (current task will be paused)
  """

  ASK: "What would you like to do?"
  WAIT for explicit choice
  DO NOT automatically switch tasks

  IF "Switch anyway":
    prjct pause "switching to new task"
```

### Check 3: Validate Git State

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

**⛔ CRITICAL: READ LOCAL, WRITE REMOTE (Token Efficiency)**

```bash
# Read from local cache (SQLite) - NEVER call API for issue details
prjct linear get-local "$ARGUMENTS"
```

```
IF issue NOT found in local cache:
  OUTPUT: "Issue not in cache. Syncing..."
  prjct linear sync
  prjct linear get-local "$ARGUMENTS"

IF issue found:
  SET: task.linearId = issue.identifier
  SET: task.linearUuid = issue.id
  SET: task.description = issue.title
  SET: $ARGUMENTS = issue.title

  # WRITE TO REMOTE - Only status updates go to API
  prjct linear start "{task.linearId}"

  OUTPUT: "Linked to Linear: {issue.identifier} - {issue.title}"
  OUTPUT: "Linear: → In Progress ✓"
```

**For JIRA:**
```bash
prjct jira get-local "$ARGUMENTS"
```

Same pattern - read local, write remote.

---

## Main Flow

### Step A: Explore Codebase (for context)

```
USE Task(Explore) → find similar code, affected files
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
2. Initialize task tracking
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

**If "No, cancel":**
```
OUTPUT: "✅ Task creation cancelled"
STOP
```

**If "Modify plan":** Ask what to change, update, re-confirm.

**If "Yes, start task":** CONTINUE to Step E

### Step E: Create Branch (if needed)

```bash
git branch --show-current
```

```
IF current branch == "main" OR "master":
  OUTPUT: "Creating feature branch: {type}/{slug}"
  git checkout -b {type}/{slug}
```

### Step F: Start Task via CLI

```bash
prjct task "$ARGUMENTS"
```

The CLI handles:
- Creating task entry in SQLite
- Setting task state to active
- Event logging

---

## Output

```
✅ {type}: $ARGUMENTS

Branch: {branch} | Subtasks: {count}
{linearId ? "Linear: {linearId} → In Progress" : ""}

Current: {first subtask}

Next: Work on subtask, then `p. done`
```
