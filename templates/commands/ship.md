---
allowed-tools: [Read, Bash, AskUserQuestion]
---

# p. ship "$ARGUMENTS"

## ⛔ MANDATORY WORKFLOW - DO NOT SKIP ANY STEP

**CRITICAL: Execute steps IN ORDER. Each step MUST complete before proceeding.**

---

### STEP 1: Pre-flight Checks

```bash
# 1a. Check current branch
BRANCH=$(git branch --show-current)
```

**IF branch is `main` or `master`:**

```bash
git log -1 --pretty=format:"%s" | head -1
```

**IF last commit is a merge/squash from a PR:**
```
# POST-MERGE FLOW - Update issue tracker
OUTPUT: "Detected: Already on main after merge."
GOTO: **POST-MERGE FINALIZE** section at the bottom
```

**IF no recent merge (user is trying to ship from main):**
```
⛔ STOP. DO NOT PROCEED.
Tell user: "Cannot ship from main branch. Create a feature branch first: git checkout -b feature/your-feature"
ABORT the ship command entirely.
```

```bash
# 1b. Check GitHub auth
gh auth status
```

**⛔ IF not authenticated:**
```
STOP. Tell user: "GitHub CLI not authenticated. Run: gh auth login"
```

```bash
# 1c. Check for changes
git status --porcelain
git diff --stat HEAD~1..HEAD 2>/dev/null || git diff --stat
```

**⛔ IF no changes AND on feature branch:**
```
STOP. Tell user: "No changes to ship."
```

---

### STEP 2: Gather Ship Documentation (MANDATORY)

**⛔ Every ship MUST have documentation.**

```
AskUserQuestion:
  question: "Describe what was implemented in this feature"
  header: "Implementation"
  options:
    - label: "Provide description"
      description: "Describe the implementation details"
```

SAVE the implementation description.

```
AskUserQuestion:
  question: "What did you learn while implementing this?"
  header: "Learnings"
  options:
    - label: "Add learnings"
      description: "Patterns discovered, gotchas, insights"
    - label: "No specific learnings"
      description: "Skip this section"
```

---

### STEP 3: Generate QA Test Plan (MANDATORY)

**⛔ Every ship MUST include test steps.**

Based on the changes, generate:

```markdown
## Test Plan

### For QA Team
1. [Specific step to test feature]
2. [Expected behavior]
3. [Edge cases to verify]

### For End Users
**What changed:** [User-facing description]
**How to use:** [Steps to use the new feature]
**Breaking changes:** [Any breaking changes, or "None"]
```

Show user and ask for approval.

---

### STEP 4: Show Ship Plan and Get Approval (BLOCKING)

**⛔ DO NOT execute any commits/pushes until user explicitly approves.**

Show the user:
```
## Ship Plan

Branch: {branch}
Changes: {git diff --stat}

Will do:
1. Run tests (if configured)
2. Bump version (patch/minor/major)
3. Update CHANGELOG.md
4. Commit with prjct footer
5. Push branch
6. Create PR to main with test plan
7. Update Linear/JIRA status
```

```
AskUserQuestion:
  question: "Ready to ship these changes?"
  header: "Ship"
  options:
    - label: "Yes, ship it (Recommended)"
      description: "Run tests, bump version, create PR"
    - label: "No, cancel"
      description: "Abort ship operation"
    - label: "Show full diff"
      description: "See all file changes before deciding"
```

**If "No, cancel":** `OUTPUT: "✅ Ship cancelled"` → STOP

---

### STEP 5: Quality Checks

```bash
npm test 2>/dev/null || bun test 2>/dev/null || echo "No tests configured"
```

```bash
npm run lint 2>/dev/null || npm run check 2>/dev/null || echo "No lint configured"
```

---

### STEP 6: Version Bump (REQUIRED)

Determine version bump type:
- `fix:` commits → **patch** (0.0.X)
- `feat:` commits → **minor** (0.X.0)
- `BREAKING:` in commits → **major** (X.0.0)

```bash
OLD_VERSION=$(node -p "require('./package.json').version")
```

---

### STEP 7: Update CHANGELOG.md (REQUIRED)

Add entry at top with implementation details, learnings, and test plan.

---

### STEP 8: Commit (REQUIRED FORMAT)

```bash
git add .
git commit -m "$(cat <<'EOF'
{type}: {description}

{body if needed}

Generated with [p/](https://www.prjct.app/)
EOF
)"
```

**⛔ The prjct footer MUST be included. No exceptions.**

---

### STEP 9: Push and Create PR (REQUIRED)

```bash
git push -u origin {branch}
gh pr create --title "{type}: {description}" --base main --body "$(cat <<'EOF'
## Summary
{bullet points of what changed}

## Implementation
{implementation details}

## Test Plan
{QA test steps}

---
Generated with [p/](https://www.prjct.app/)
EOF
)"
```

---

### STEP 10: Ship via CLI

```bash
prjct ship "{feature}"
```

The CLI handles:
- Recording shipped feature in SQLite
- Updating task state
- Event logging

---

### STEP 11: Update Issue Tracker (REQUIRED - DO NOT SKIP)

**⛔ This step is MANDATORY if there's a linked issue.**

```bash
# If there was a linked Linear issue:
prjct linear comment "{linearId}" "## Ship Complete

**PR:** {pr_url}
**Version:** {version}"

prjct linear done "{linearId}"
```

```bash
# If there was a linked JIRA issue:
prjct jira comment "{jiraId}" "PR: {pr_url}"
prjct jira transition "{jiraId}" "Done"
```

---

## Output Format

```
🚀 Shipped: {feature}

Version: {old} → {new}
PR: {url}
Branch: {branch}
{linearId ? "Linear: {linearId} → Done ✓" : ""}

Next:
- Review PR → {url}
- New task → `p. task "description"`
```

---

## ⛔ VIOLATIONS

- ❌ Committing directly to main
- ❌ Pushing without creating PR
- ❌ Skipping version bump
- ❌ Skipping CHANGELOG update
- ❌ Not waiting for user approval
- ❌ Missing prjct footer in commit
- ❌ Not updating Linear/JIRA status

---

## POST-MERGE FINALIZE

When user runs `p. ship` on main after a merge:

### 1. Update Issue Tracker to Done (MANDATORY)

```bash
prjct linear done "{linearId}"
```

### 2. Output

```
✅ Merged: {linearId}

PR #{number} → main
Linear: {linearId} → Done ✓

Ready for next task.
```

**⛔ NEVER output "Merged" without updating the issue tracker first.**
