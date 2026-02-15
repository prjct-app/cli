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

Search the codebase for affected files.

## Step 3: Fix now or queue
ASK: "Fix this bug now?" Fix now / Queue for later

If fix now: create branch `bug/{slug}` and start working.
If queue: done -- bug is tracked.

## Presentation
Format bug reports as:

1. `**Bug reported**: {description}`
2. Show affected files with `code formatting` for paths
3. Present fix/queue options clearly
