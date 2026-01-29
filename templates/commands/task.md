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

### Check 2: Check for Active Task

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
    # Fallback to API
    IMPORT: linearSync from core/integrations/linear
    CALL: linearSync.getIssue(projectId, "$ARGUMENTS")  # Fetches + caches

  IF issue found:
    SET: task.linearId = issue.identifier     # "PRJ-123"
    SET: task.linearUuid = issue.id           # Linear internal UUID
    SET: task.description = issue.title
    SET: $ARGUMENTS = issue.title  # Use title for task

    # Mark issue as In Progress in Linear (pushes status change)
    IMPORT: linearSync from core/integrations/linear
    CALL: linearSync.pushStatus(projectId, issue.identifier, 'in_progress')

    OUTPUT: "Linked to Linear: {issue.identifier} - {issue.title}"
    OUTPUT: "Linear: In Progress"

ELSE IF integrations.jira.enabled:
  # JIRA issue detected
  IMPORT: jiraService from core/integrations/jira
  CALL: jiraService.fetchIssue("$ARGUMENTS")

  IF issue found:
    SET: task.externalId = issue.externalId
    SET: task.externalProvider = "jira"
    SET: task.description = issue.title
    SET: $ARGUMENTS = issue.title  # Use title for task

    # Mark issue as In Progress in JIRA
    CALL: jiraService.markInProgress(issue.externalId)

    OUTPUT: "Linked to JIRA: {issue.externalId} - {issue.title}"
    OUTPUT: "JIRA: In Progress"

ELSE:
  OUTPUT: "Issue tracker not configured. Run `p. linear setup` or `p. jira setup`"
```

---

## Main Flow

### Step A: Show Plan and Get Approval (BLOCKING)

**⛔ DO NOT create branches or modify state without user approval.**

```
OUTPUT:
"""
## Task Plan

Description: $ARGUMENTS
Type: {classified type}
Branch: {type}/{slug}

Will do:
1. Create feature branch from current branch
2. Initialize task tracking in state.json
3. Break down into subtasks
4. {If Linear: Update issue status to In Progress}

Proceed? (yes/no)
"""

WAIT for explicit "yes" or approval
DO NOT assume
```

### Step B: Explore Codebase

```
USE Task(Explore) → find similar code, affected files
READ agents/*.md → get domain patterns
```

### Step C: Classify Task

Determine type: feature | bug | improvement | refactor | chore

### Step D: Create Branch (if needed)

```bash
CURRENT_BRANCH=$(git branch --show-current)
```

```
IF CURRENT_BRANCH == "main" OR CURRENT_BRANCH == "master":
  OUTPUT: "Creating feature branch: {type}/{slug}"

  git checkout -b {type}/{slug}

  IF git command fails:
    OUTPUT: "Failed to create branch. Check git status."
    STOP
```

```bash
prjct work "$ARGUMENTS"
```

WRITE `{globalPath}/storage/state.json`:
```json
{
  "currentTask": {
    "id": "{uuid}",
    "description": "{subtask}",
    "type": "{type}",
    "status": "active",
    "startedAt": "{now}",
    "subtasks": [...],
    "currentSubtaskIndex": 0,
    "parentDescription": "$ARGUMENTS",
    "linearId": "{identifier or null}",      // "PRJ-123" - Linear identifier
    "linearUuid": "{uuid or null}"           // Linear internal UUID
  }
}
```

**Output**:
```
{type}: $ARGUMENTS

Branch: {branch} | Subtasks: {count}
{linearId ? "Linear: {linearId} → In Progress" : ""}

Next: Work on subtask, then `p. done`
```
