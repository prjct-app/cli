---
allowed-tools: [Bash, AskUserQuestion]
---

# p. merge

## Pre-flight (BLOCKING)
Verify: active task exists, PR exists, PR is approved, CI passes, no conflicts.

## Step 1: Get merge plan
```bash
prjct merge --md
```

## Step 2: Get approval (BLOCKING)
ASK: "Merge this PR?" Yes / No

## Step 3: Execute
```bash
gh pr merge {prNumber} --squash --delete-branch
git checkout main && git pull origin main
```

## Step 4: Update issue tracker
If linked to Linear/JIRA, mark as Done via CLI.
