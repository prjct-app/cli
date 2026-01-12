---
allowed-tools: [Read, Write, Bash, AskUserQuestion]
description: 'Complete subtask or mark implement phase done'
---

# p. done - Complete Subtask

**See:** `@templates/shared/standard.md` for context variables and patterns.

---

## Step 1: Validate & Load (PARALLEL)

```
READ (parallel):
- .prjct/prjct.config.json → {projectId}
- {globalPath}/storage/state.json → {state}

IF no config: "No prjct project" → STOP
IF no currentTask: "No active task" → STOP
```

---

## Step 2: Handle Subtasks

IF subtasks exist:
```
IF more subtasks remaining:
  AskUserQuestion:
    - "Next: {nextSubtask}" → advance index, continue
    - "Complete feature" → skip remaining, complete
    - "More work needed" → STOP

ELSE (last subtask):
  Mark complete → continue to Step 3
```

---

## Step 3: Calculate Metrics (Single Git Call)

```bash
git rev-list --count --since="{startedAt}" HEAD && git diff --stat HEAD~1 2>/dev/null
```

EXTRACT: `{commits}`, `{filesChanged}`, `{linesAdded}`, `{linesRemoved}`
CALCULATE: `{duration}` = now - startedAt
IF estimate: `{accuracy}` = 100 - |((actual - estimate) / estimate) * 100|

---

## Step 4: Update Storage (PARALLEL WRITES)

```
WRITE (parallel):
- {globalPath}/storage/state.json → move to previousTask, clear currentTask
- {globalPath}/context/now.md → "_No active task_"

APPEND: {globalPath}/memory/events.jsonl
APPEND: {globalPath}/sync/pending.json
```

---

## Step 5: Bug Resume (Conditional)

IF task.type == "bug" AND state.interruptedTask:
```
AskUserQuestion:
  - "Resume previous" → restore interruptedTask
  - "Pick from queue" → show top 3
  - "Done for now" → clear
```

---

## Output

```
✅ {task} ({duration})
{IF estimate}Accuracy: {accuracy}%{ENDIF}
Files: {filesChanged} | +{linesAdded}/-{linesRemoved}
{IF queue}Queue: {count} | Next: {topTask}{ENDIF}

p. task | p. ship
```
