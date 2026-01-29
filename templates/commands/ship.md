---
allowed-tools: [Read, Write, Bash, AskUserQuestion]
---

# p. ship "$ARGUMENTS"

## ⛔ MANDATORY WORKFLOW - DO NOT SKIP ANY STEP

**CRITICAL: Execute steps IN ORDER. Each step MUST complete before proceeding.**

---

### STEP 1: Pre-flight Checks (BLOCKING)

```bash
# 1a. Check current branch
BRANCH=$(git branch --show-current)
```

**⛔ IF branch is `main` or `master`:**
```
STOP. DO NOT PROCEED.
Tell user: "Cannot ship from main branch. Create a feature branch first."
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
# 1c. Check for changes
git status --porcelain
```

**⛔ IF no changes:**
```
STOP. DO NOT PROCEED.
Tell user: "No changes to ship."
ABORT the ship command entirely.
```

---

### STEP 2: Show Plan and Get Approval (BLOCKING)

**⛔ DO NOT execute any commits/pushes until user explicitly approves.**

Show the user:
```
## Ship Plan

Branch: {branch}
Changes:
{git diff --stat}

Will do:
1. Run tests (if configured)
2. Bump version (patch/minor/major)
3. Update CHANGELOG.md
4. Commit with prjct footer
5. Push branch
6. Create PR to main

Proceed? (yes/no)
```

**⛔ WAIT for explicit "yes" or approval. Do not assume.**

---

### STEP 3: Quality Checks

```bash
# Run tests if package.json has test script
npm test 2>/dev/null || bun test 2>/dev/null || echo "No tests configured"
```

```bash
# Run lint if configured
npm run lint 2>/dev/null || echo "No lint configured"
```

---

### STEP 4: Version Bump (REQUIRED)

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

### STEP 5: Update CHANGELOG.md (REQUIRED)

Add entry at top of CHANGELOG.md:
```markdown
## [X.X.X] - YYYY-MM-DD

### {Fixed/Added/Changed}
- {description of changes}
```

---

### STEP 6: Commit (REQUIRED FORMAT)

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

### STEP 7: Push and Create PR (REQUIRED)

```bash
git push -u origin {branch}
gh pr create --title "{type}: {description}" --base main --body "$(cat <<'EOF'
## Summary
{bullet points}

## Changes
{what changed}

## Test Plan
{how to verify}

Generated with [p/](https://www.prjct.app/)
EOF
)"
```

---

### STEP 8: Update Linear/Issue Tracker (if applicable)

If task has `linearId`:
- Update issue status to "In Review" or appropriate state
- Add comment with PR link

---

## Output Format

```
🚀 Shipped: {feature}

Version: {old} → {new}
PR: {url}
Branch: {branch}

Next:
- Review PR → {url}
- Merge when ready → `p. merge`
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

**These violations make prjct useless. Follow the workflow.**
