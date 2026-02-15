---
allowed-tools: [Bash, Read, Write, AskUserQuestion, Task]
---

# p. prd $ARGUMENTS

## Step 1: Validate
If $ARGUMENTS is empty, ASK the user for a feature title.

## Step 2: Create PRD via CLI
```bash
prjct prd "$ARGUMENTS" --md
```

## Step 3: Follow CLI methodology
The CLI guides through discovery, sizing, and phase execution.
Search the codebase for architecture patterns.

## Step 4: Get approval
Show the PRD summary and get explicit approval.
ASK: "Add to roadmap now?" Yes / No (keep as draft)
