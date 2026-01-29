---
allowed-tools: [Read, Write, Bash, Task, Glob, Grep, AskUserQuestion]
---

# p. task "$ARGUMENTS"

```bash
prjct context task $ARGUMENTS
```

## Step 0: Detect Issue Tracker Reference

IF `$ARGUMENTS` matches pattern `/^[A-Z]+-\d+$/` (e.g., PRJ-123, PROJ-456):

```
READ: {globalPath}/project.json
CHECK: integrations.linear OR integrations.jira

IF integrations.linear.enabled:
  # Linear issue detected - use LOCAL-FIRST approach
  # Try local cache first (issues.json), then API if not found

  RUN: bun core/cli/linear.ts --project {projectId} get-local "$ARGUMENTS"

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

IF `currentTask` active → Ask: complete, pause, or cancel?

USE Task(Explore) → find similar code, affected files
READ `agents[].filePath` → get patterns
Classify: feature|bug|improvement|refactor|chore
Break into subtasks

IF on main → `git checkout -b {type}/{slug}`

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
