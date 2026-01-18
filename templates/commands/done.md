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

**Output**:
```
✅ {task} ({duration})

Files: {count} | Commits: {count}

Next:
- More work? → `p. task "description"`
- Ready to ship? → `p. ship`
- See queue → `p. next`
```
