---
allowed-tools: [Read, Write, Bash, AskUserQuestion]
---

# p. done

## Step 1: Resolve Project Paths

```bash
# Get projectId from local config
cat .prjct/prjct.config.json | grep -o '"projectId"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4
```

Set `globalPath = ~/.prjct-cli/projects/{projectId}`

## Step 2: Read Current State

READ `{globalPath}/storage/state.json`

```
IF no currentTask OR currentTask is null:
  OUTPUT: "No active task. Use `p. task` to start one."
  STOP
```

## Step 3: Handle Subtasks

```
IF currentTask.subtasks exists AND has items:
  current = currentTask.subtasks[currentTask.currentSubtaskIndex]
  remaining = subtasks where status != "completed"

  IF remaining.length > 1:
    # More subtasks after current one
    AskUserQuestion:
      question: "Subtask complete. What next?"
      header: "Done"
      options:
        - label: "Next subtask (Recommended)"
          description: "Mark current done, move to next"
        - label: "Complete all remaining"
          description: "Mark entire task as done"
        - label: "Continue current"
          description: "Keep working on this subtask"

    IF "Next subtask":
      # Mark current subtask as completed
      currentTask.subtasks[currentSubtaskIndex].status = "completed"
      currentTask.currentSubtaskIndex++
      currentTask.subtasks[currentSubtaskIndex].status = "active"
      currentTask.description = currentTask.subtasks[currentSubtaskIndex].description

      WRITE state.json

      OUTPUT:
      """
      ✅ Subtask complete: {completed subtask}

      Progress: {completed}/{total} subtasks

      Current: {next subtask description}

      Next: Continue working, then `p. done`
      """
      STOP

    IF "Continue current":
      OUTPUT: "Continuing: {current subtask}"
      STOP

    # If "Complete all" - fall through to complete task
```

## Step 4: Complete Task

Generate timestamp:
```bash
node -e "console.log(new Date().toISOString())"
```

Calculate duration from `currentTask.startedAt` to now.

Update state:
```
# Mark all subtasks as completed
FOR each subtask in currentTask.subtasks:
  subtask.status = "completed"

# Update task status
currentTask.status = "completed"
currentTask.completedAt = "{timestamp}"

# Move to previousTask
previousTask = currentTask
currentTask = null
```

WRITE `{globalPath}/storage/state.json`:
```json
{
  "currentTask": null,
  "previousTask": {
    "id": "{task.id}",
    "description": "{task.parentDescription}",
    "type": "{task.type}",
    "status": "completed",
    "startedAt": "{task.startedAt}",
    "completedAt": "{timestamp}",
    "subtasks": [...],
    "branch": "{task.branch}",
    "linearId": "{task.linearId or null}"
  },
  "pausedTasks": []
}
```

## Step 5: Sync Issue Tracker Status

```
IF previousTask.linearId exists:
  # Update Linear issue to Done
  RUN: bun $PRJCT_CLI/core/cli/linear.ts --project {projectId} status "{linearId}" "done"
  OUTPUT: "Linear: {linearId} → Done"

ELSE IF previousTask.externalId AND previousTask.externalProvider == "jira":
  # Update JIRA issue to Done
  RUN: bun $PRJCT_CLI/core/cli/jira.ts --project {projectId} status "{externalId}" "done"
  OUTPUT: "JIRA: {externalId} → Done"
```

## Step 6: Log Event

APPEND to `{globalPath}/memory/events.jsonl`:
```json
{"type":"task_completed","taskId":"{id}","description":"{parentDescription}","timestamp":"{timestamp}","duration":"{duration}"}
```

## Step 7: Count Stats

```bash
# Count files changed
git diff --stat HEAD~1 2>/dev/null | tail -1 || echo "0 files"

# Count commits on branch
git rev-list --count HEAD ^main 2>/dev/null || echo "0"
```

---

## Output

```
✅ {task description} ({duration})

Files: {count} | Commits: {count}
{linearId ? "Linear: {linearId} → Done" : ""}

Next:
- More work? → `p. task "description"`
- Ready to ship? → `p. ship`
- See queue → `p. next`
```
