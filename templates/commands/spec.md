---
allowed-tools: [Bash, Read, Write, AskUserQuestion, Task]
---

# p. spec $ARGUMENTS

## Step 1: Validate
If $ARGUMENTS is empty, ASK the user for a feature name.

## Step 2: Create spec via CLI
```bash
prjct spec "$ARGUMENTS" --md
```

## Step 3: Follow CLI instructions
The CLI will guide through requirements, design decisions, and task breakdown.
Search the codebase for relevant patterns.

## Step 4: Get approval
Show the spec to the user and get explicit approval before adding tasks to queue.
