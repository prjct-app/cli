---
allowed-tools: [Bash, AskUserQuestion]
---

# p. pause "$ARGUMENTS"

## ⚡ FAST COMMAND — Execute with optional reason

### Step 1: Get Pause Reason (if not provided)

```
IF $ARGUMENTS is empty:
  AskUserQuestion:
    question: "Why are you pausing?"
    header: "Pause"
    options:
      - label: "Blocked (waiting on external)"
        description: "Waiting for review, dependency, or other team"
      - label: "Switching task"
        description: "Need to work on something else"
      - label: "Taking a break"
        description: "Stepping away temporarily"
      - label: "Researching"
        description: "Need to investigate before continuing"

  SET pauseReason = selected option
ELSE:
  SET pauseReason = $ARGUMENTS
```

### Step 2: Execute

```bash
prjct pause "{pauseReason}"
```

The CLI handles all state updates and event logging internally.

---

## Output

```
⏸️ Paused: {task description}

Duration: {time worked}
Reason: {pauseReason}

Next:
- Resume → `p. resume`
- New task → `p. task "description"`
- Fix bug → `p. bug "description"`
```
