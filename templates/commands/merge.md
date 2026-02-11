---
allowed-tools: [Bash, Read, Write, AskUserQuestion]
---

# p. merge

## ⛔ MANDATORY WORKFLOW - DO NOT SKIP ANY STEP

---

### STEP 1: Pre-flight Checks (BLOCKING)

```bash
# 1a. Check if there's an active task with a PR
```

**⛔ IF no `currentTask`:**
```
STOP. DO NOT PROCEED.
Tell user: "No active task. Use p. task first."
ABORT.
```

**⛔ IF no PR number in task state:**
```
STOP. DO NOT PROCEED.
Tell user: "No PR found. Run p. ship first to create a PR."
ABORT.
```

---

### STEP 2: Check PR Status (BLOCKING)

```bash
gh pr view {prNumber} --json reviewDecision,mergeable,state,statusCheckRollup
```

**⛔ IF PR is not approved:**
```
STOP. DO NOT PROCEED.
Tell user: "PR needs approval. Get reviews first."
Show: gh pr view {prNumber} --web
ABORT.
```

**⛔ IF PR has merge conflicts:**
```
STOP. DO NOT PROCEED.
Tell user: "PR has conflicts. Resolve them first:
  git checkout {branch}
  git pull origin main
  # fix conflicts
  git push"
ABORT.
```

**⛔ IF CI checks are failing:**
```
STOP. DO NOT PROCEED.
Tell user: "CI checks are failing. Fix them first."
Show failing checks.
ABORT.
```

---

### STEP 3: Show Plan and Get Approval (BLOCKING)

Show the user:
```
## Merge Plan

PR: #{prNumber} - {title}
Branch: {branch} → main
Strategy: squash

Will do:
1. Merge PR with squash
2. Delete feature branch
3. Update local main
```

Then ask for confirmation:

```
AskUserQuestion:
  question: "Merge this PR?"
  header: "Merge"
  options:
    - label: "Yes, merge (Recommended)"
      description: "Squash merge and delete branch"
    - label: "No, cancel"
      description: "Keep PR open"
```

**Handle responses:**

**If "No, cancel":**
```
OUTPUT: "✅ Merge cancelled"
STOP - Do not continue
```

**If "Yes, merge":**
CONTINUE to Step 4

---

### STEP 4: Execute Merge

```bash
gh pr merge {prNumber} --squash --delete-branch
```

---

### STEP 5: Update Local

```bash
git checkout main
git pull origin main
```

---

### STEP 6: Update Task State

- Set `currentTask.status = "merged"`
- Set `currentTask.mergedAt = {now}`
- Clear PR reference

---

### STEP 7: Update Issue Tracker (REQUIRED - DO NOT SKIP)

**⛔ This step is MANDATORY if there's a linked issue.**

Check CLI output from Step 1 for linked issue IDs (linearId, jiraId).

**IF linearId exists:**
```bash
# USE prjct CLI DIRECTLY - NOT $PRJCT_CLI (may be unset)
prjct linear done "{linearId}"
prjct linear comment "{linearId}" "✅ PR #{prNumber} merged and released"
```
OUTPUT: "Linear: {linearId} → Done ✓"

**ELSE IF jiraId exists:**
```bash
prjct jira transition "{jiraId}" "Done"
prjct jira comment "{jiraId}" "✅ PR #{prNumber} merged and released"
```
OUTPUT: "JIRA: {jiraId} → Done ✓"

**ELSE (no issue tracker):**
```
# No issue tracker linked - that's OK, just skip this step
OUTPUT: "✓ No issue tracker linked"
```

---

### STEP 8: Complete Task State

```bash
# The CLI completes the task in SQLite
prjct done --merged
```

# Events are logged automatically by the CLI

---

## Output Format

```
✅ Merged: {title}

PR: #{prNumber}
Strategy: squash
Branch: {branch} (deleted)

Next:
- New task → `p. task "description"`
- See backlog → `p. next`
```

---

## ⛔ VIOLATIONS

- ❌ Merging without PR approval
- ❌ Merging with failing CI
- ❌ Merging with conflicts
- ❌ Not waiting for user approval
