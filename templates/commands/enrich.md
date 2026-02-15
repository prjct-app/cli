---
allowed-tools: [Bash, Read, Task, AskUserQuestion]
---

# p. enrich $ARGUMENTS

## Step 1: Validate
If $ARGUMENTS is empty, ASK for an issue ID or description.

## Step 2: Fetch and analyze
```bash
prjct enrich "$ARGUMENTS" --md
```

Search the codebase for similar implementations and affected files.

## Step 3: Publish
ASK: "Update description / Add as comment / Just show me"

Follow the CLI instructions for publishing.
