---
allowed-tools: [Bash]
---

# p. idea "$ARGUMENTS"

## Step 1: Validate Arguments

```
IF $ARGUMENTS is empty:
  ASK: "What's your idea?"
  WAIT for response
```

## Step 2: Capture Idea

```bash
prjct idea "$ARGUMENTS"
```

The CLI handles:
- Detecting simple vs complex ideas
- Priority classification
- Storing in SQLite
- Event logging

---

## Output

```
💡 $ARGUMENTS

Next:
- Start work → `p. task "$ARGUMENTS"`
- See ideas → `p. dash`
```
