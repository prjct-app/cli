---
allowed-tools: [Read, Write, Bash, AskUserQuestion]
---

# p. done

```bash
prjct context done
```

IF no `currentTask` → "No active task. Use p. task"

IF has subtasks AND more remaining:
  Ask: "Next subtask?" | "Complete all?" | "Continue current?"
  IF next → update `currentSubtaskIndex++`, output progress, STOP
  IF continue → STOP

Mark complete:
- `currentTask.status = "completed"`
- `currentTask.completedAt = {now}`
- Move to `previousTask`, set `currentTask = null`

WRITE `{globalPath}/storage/state.json`

---

## Sync Issue Tracker Status

IF `currentTask.linearId` exists:

```
# Update Linear issue to Done using sync layer
# This updates both Linear API and local issues.json cache

IMPORT: linearSync from core/integrations/linear
CALL: linearSync.pushStatus(projectId, currentTask.linearId, 'done')

OUTPUT: "Linear: {linearId} → Done"
```

ELSE IF `currentTask.externalId` AND `currentTask.externalProvider == "jira"`:

```
# Update JIRA issue to Done
IMPORT: jiraService from core/integrations/jira
CALL: jiraService.markDone(currentTask.externalId)
OUTPUT: "JIRA: {externalId} → Done"
```

---

**Output**:
```
{task} ({duration})

Files: {count} | Commits: {count}
{linearId ? "Linear: {linearId} → Done" : ""}

Next:
- More work? → `p. task "description"`
- Ready to ship? → `p. ship`
- See queue → `p. next`
```
