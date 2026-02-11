---
allowed-tools: [Bash, Task, AskUserQuestion]
---

# p. bug $ARGUMENTS

## Step 1: Validate
If $ARGUMENTS is empty, ASK the user for a bug description.

## Step 2: Report and explore
```bash
prjct bug "$ARGUMENTS" --md
```

Explore the codebase for affected files using Task with subagent_type=Explore.

## Step 3: Fix now or queue
ASK: "Fix this bug now?" Fix now / Queue for later

If fix now: create branch `bug/{slug}` and start working.
If queue: done -- bug is tracked.
