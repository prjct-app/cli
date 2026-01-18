---
allowed-tools: [Read, Write, Bash, Task, Glob, Grep, AskUserQuestion]
---

# p. task "$ARGUMENTS"

```bash
prjct context task $ARGUMENTS
```

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
{"currentTask":{"id":"{uuid}","description":"{subtask}","type":"{type}","status":"active","startedAt":"{now}","subtasks":[...],"currentSubtaskIndex":0,"parentDescription":"$ARGUMENTS"}}
```

**Output**:
```
✅ {type}: $ARGUMENTS

Branch: {branch} | Subtasks: {count}

Next: Work on subtask, then `p. done`
```
