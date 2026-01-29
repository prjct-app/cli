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

IF `currentTask.externalId` exists:

```
IF currentTask.externalProvider == "linear":
  # Update Linear issue to Done
  IMPORT: linearService from core/integrations/linear
  CALL: linearService.markDone(currentTask.externalId)
  OUTPUT: "Linear: {externalId} → Done"

ELSE IF currentTask.externalProvider == "jira":
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
{externalId ? "{externalProvider}: {externalId} → Done" : ""}

Next:
- More work? → `p. task "description"`
- Ready to ship? → `p. ship`
- See queue → `p. next`
```
