---
allowed-tools: [Bash, Read, AskUserQuestion]
---

# p. review $ARGUMENTS

## Step 1: Run review
```bash
prjct review $ARGUMENTS --md
```

## Step 2: Analyze changes
Read changed files and check for security issues, logic errors, and missing error handling.

## Step 3: Create/check PR
If no PR exists, create one with `gh pr create`.
If PR exists, check approval status with `gh pr view`.

## Step 4: Follow CLI next steps
The CLI output indicates what to do next (fix issues, wait for approval, merge).
