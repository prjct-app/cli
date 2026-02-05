---
allowed-tools: [Read, Write, Bash, AskUserQuestion]
---

# p. ship "$ARGUMENTS"

## ⛔ MANDATORY WORKFLOW - DO NOT SKIP ANY STEP

**CRITICAL: Execute steps IN ORDER. Each step MUST complete before proceeding.**

---

### STEP 0: Resolve Project Context

```bash
# Get projectId from local config
cat .prjct/prjct.config.json 2>/dev/null | grep -o '"projectId"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4
```

Set `globalPath = ~/.prjct-cli/projects/{projectId}`

READ: `{globalPath}/storage/state.json` to get:
- `previousTask.linearId` or `currentTask.linearId`
- Task description

**⚠️ SAVE the linearId/jiraId NOW - you will need it at the end.**

---

### STEP 1: Pre-flight Checks

```bash
# 1a. Check current branch
BRANCH=$(git branch --show-current)
```

**IF branch is `main` or `master`:**

```bash
# Check if there's a recent merge (within last commit)
git log -1 --pretty=format:"%s" | head -1
```

**IF last commit is a merge/squash from a PR:**
```
# ═══════════════════════════════════════════════════════════════
# POST-MERGE FLOW - ISSUE TRACKER UPDATE IS MANDATORY
# ═══════════════════════════════════════════════════════════════

OUTPUT: "Detected: Already on main after merge."

# ⛔ IMMEDIATELY update issue tracker - DO NOT SKIP
GOTO: **POST-MERGE FINALIZE** section at the bottom of this file
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
STOP. DO NOT PROCEED.
Tell user: "GitHub CLI not authenticated. Run: gh auth login"
ABORT the ship command entirely.
```

```bash
# 1c. Check for changes (only if on feature branch)
git status --porcelain
git diff --stat HEAD~1..HEAD 2>/dev/null || git diff --stat
```

**⛔ IF no changes AND on feature branch:**
```
STOP. DO NOT PROCEED.
Tell user: "No changes to ship."
ABORT the ship command entirely.
```

---

### STEP 2: Gather Ship Documentation (MANDATORY)

**⛔ This step is NON-NEGOTIABLE. Every ship MUST have documentation.**

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

SAVE the learnings (if any).

---

### STEP 3: Generate QA Test Plan (MANDATORY)

**⛔ Every ship MUST include test steps. NO EXCEPTIONS.**

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

Show user the generated test plan and ask for approval:

```
AskUserQuestion:
  question: "Is this test plan accurate?"
  header: "Test Plan"
  options:
    - label: "Yes, looks good"
      description: "Proceed with this test plan"
    - label: "Modify test plan"
      description: "Edit the test steps"
```

---

### STEP 4: Show Ship Plan and Get Approval (BLOCKING)

**⛔ DO NOT execute any commits/pushes until user explicitly approves.**

Show the user:
```
## Ship Plan

Branch: {branch}
Changes: {git diff --stat}

Documentation:
- Implementation: {summary}
- Learnings: {summary or "None"}
- Test Plan: {summary}

Will do:
1. Run tests (if configured)
2. Bump version (patch/minor/major)
3. Update CHANGELOG.md with full documentation
4. Commit with prjct footer
5. Push branch
6. Create PR to main with test plan
7. Update Linear/JIRA status to "In Review"
```

Then ask for confirmation:

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

**Handle responses:**

**If "Show full diff":**
- Run `git diff` to show full changes
- Ask again with Yes/No options only

**If "No, cancel":**
```
OUTPUT: "✅ Ship cancelled"
STOP - Do not continue
```

**If "Yes, ship it":**
CONTINUE to Step 5

---

### STEP 5: Quality Checks

```bash
# Run tests if package.json has test script
npm test 2>/dev/null || bun test 2>/dev/null || echo "No tests configured"
```

```bash
# Run lint if configured
npm run lint 2>/dev/null || npm run check 2>/dev/null || echo "No lint configured"
```

---

### STEP 6: Version Bump (REQUIRED)

Determine version bump type:
- `fix:` commits → **patch** (0.0.X)
- `feat:` commits → **minor** (0.X.0)
- `BREAKING:` in commits → **major** (X.0.0)

```bash
# Read current version
OLD_VERSION=$(node -p "require('./package.json').version")

# Calculate new version and update package.json
# Use npm version OR manual edit
```

---

### STEP 7: Update CHANGELOG.md (REQUIRED - FULL DOCUMENTATION)

Add entry at top of CHANGELOG.md with COMPLETE documentation:

```markdown
## [X.X.X] - YYYY-MM-DD

### {Features/Bug Fixes/Changed}
- **{Feature name}**: {description}

### Implementation Details
{implementation description from Step 2}

### Learnings
{learnings from Step 2, or omit if none}

### Test Plan

#### For QA
{QA test steps from Step 3}

#### For Users
{User-facing changes from Step 3}
```

---

### STEP 8: Commit (REQUIRED FORMAT)

```bash
git add .
git commit -m "$(cat <<'EOF'
{type}: {description}

{body if needed}

Implementation: {brief summary}
Test: {how to test}

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
{implementation details from Step 2}

## Changes
{list of files/modules affected}

## Test Plan

### For QA
{QA test steps}

### For Users
{User-facing documentation}

## Learnings
{learnings, if any}

---
Generated with [p/](https://www.prjct.app/)
EOF
)"
```

---

### STEP 10: Update Issue Tracker (REQUIRED - DO NOT SKIP)

**⛔ This step is MANDATORY if there's a linked issue. NEVER skip this.**

```
READ: {globalPath}/storage/state.json
GET: linearId or jiraId from currentTask or previousTask
```

**IF linearId exists:**
```bash
# ═══════════════════════════════════════════════════════════════
# USE prjct CLI DIRECTLY - NOT $PRJCT_CLI (may be unset)
# ═══════════════════════════════════════════════════════════════

# Add implementation comment to Linear issue
prjct linear comment "{linearId}" "## Implementation Complete

**PR:** {pr_url}
**Branch:** {branch}

### What was implemented
{implementation details}

### How to test
{test steps for QA}"

# ═══════════════════════════════════════════════════════════════
# ALWAYS mark as Done after ship (work is complete)
# ═══════════════════════════════════════════════════════════════
prjct linear done "{linearId}"
OUTPUT: "Linear: {linearId} → Done ✓"
```

**IF jiraId exists:**
```bash
# Similar flow for JIRA - always Done after ship
prjct jira comment "{jiraId}" "PR: {pr_url}"
prjct jira transition "{jiraId}" "Done"
OUTPUT: "JIRA: {jiraId} → Done ✓"
```

**IF no issue tracker configured:**
```
OUTPUT: "No issue tracker linked. Consider using `p. linear setup` for better tracking."
```

---

### STEP 11: Update Local State

```
UPDATE: {globalPath}/storage/state.json
SET: currentTask.status = "shipped" (if PR merged) or "in_review" (if PR open)
SET: currentTask.shippedAt = {timestamp}
SET: currentTask.prUrl = {pr_url}
```

APPEND to `{globalPath}/memory/events.jsonl`:
```json
{"type":"task_shipped","taskId":"{id}","linearId":"{linearId}","prUrl":"{pr_url}","version":"{version}","timestamp":"{timestamp}"}
```

---

## Output Format

```
🚀 Shipped: {feature}

Version: {old} → {new}
PR: {url}
Branch: {branch}
{linearId ? "Linear: {linearId} → In Review ✓" : ""}

Documentation:
- Implementation: ✓
- Test Plan: ✓
- Learnings: ✓

Next:
- Review PR → {url}
- After merge → Issues auto-updated to Done
```

---

## ⛔ VIOLATIONS

**If you skip ANY step, you are BREAKING the prjct workflow.**

Common violations:
- ❌ Committing directly to main
- ❌ Pushing without creating PR
- ❌ Skipping version bump
- ❌ Skipping CHANGELOG update
- ❌ Not waiting for user approval
- ❌ Missing prjct footer in commit
- ❌ **Skipping test plan documentation**
- ❌ **Not updating Linear/JIRA status**
- ❌ **Not adding implementation comments to issues**

**These violations make prjct useless. Follow the workflow.**

---

## ═══════════════════════════════════════════════════════════════
## POST-MERGE FINALIZE (Called from STEP 1 when on main after merge)
## ═══════════════════════════════════════════════════════════════

**⛔ THIS SECTION IS MANDATORY AFTER ANY MERGE. DO NOT SKIP.**

When user runs `p. ship` on main after a merge, execute ONLY this section:

### 1. Get Issue ID from State

```bash
# Read state to get linearId
cat ~/.prjct-cli/projects/$(cat .prjct/prjct.config.json 2>/dev/null | grep -o '"projectId"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)/storage/state.json 2>/dev/null
```

Extract `linearId` from `previousTask.linearId` or `currentTask.linearId`.

### 2. Update Issue Tracker to Done (MANDATORY)

**⛔ DO NOT OUTPUT SUCCESS UNTIL THIS COMPLETES**

```bash
# Use prjct CLI directly (NOT $PRJCT_CLI which may be unset)
prjct linear done "{linearId}"
```

**IF no prjct CLI available, use direct command:**
```bash
# Fallback - find CLI location
PRJCT_BIN=$(which prjct 2>/dev/null || echo "/opt/homebrew/bin/prjct")
$PRJCT_BIN linear done "{linearId}"
```

### 3. Output

```
✅ Merged: {linearId}

PR #{number} → main
Linear: {linearId} → Done ✓

Ready for next task.
```

**⛔ NEVER output "Merged" without updating the issue tracker first.**
