---
allowed-tools: [Read, Write, Bash, AskUserQuestion]
---

# p. pause "$ARGUMENTS"

```bash
prjct context pause
```

IF no `currentTask` → "No active task to pause"
IF already paused → Show paused state, STOP

IF no reason provided, Ask: "Why pausing?"
- Blocked (waiting on external)
- Switching task
- Taking a break
- Researching

IF blocked → Ask what's blocking

Calculate duration since `startedAt`

UPDATE `{globalPath}/storage/state.json`:
- `pausedTask` = currentTask with `status: "paused"`, `pausedAt`, `pauseReason`
- `currentTask` = null

**Output**:
```
⏸️ Paused: {task}

Duration: {time}
Reason: {reason}

Next:
- Resume → `p. resume`
- New task → `p. task "description"`
- Complete without resuming → `p. done`
```
