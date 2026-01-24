---
allowed-tools: [Read, Write, Bash, Glob, AskUserQuestion]
---

# p. resume

```bash
prjct context resume
```

IF `currentTask` active → "Already active: {task}", STOP
IF no `pausedTask` AND no `interruptedTask` → "Nothing to resume", STOP

IF both exist → Ask which to resume

Calculate away duration

UPDATE `{globalPath}/storage/state.json`:
- `currentTask` = resumed task with `status: "active"`, `resumedAt`
- Clear `pausedTask` or `interruptedTask`

Load agents from `{globalPath}/agents/` for context

**Output**:
```
▶️ Resumed: {task}

Was paused: {duration}
{IF workflow: Phase: {phase}}

Next:
- Finish work → `p. done`
- Pause again → `p. pause`
```
