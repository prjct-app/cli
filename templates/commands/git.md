---
allowed-tools: [Bash, Read, Write, AskUserQuestion]
description: 'Smart git operations with context'
architecture: 'Write-Through (JSON → MD → Events)'
storage-layer: true
source-of-truth: 'storage/state.json'
---

# /p:git - Smart Git Operations

## ⛔ MANDATORY WORKFLOW - FOLLOW STEPS IN ORDER

**All git operations through prjct MUST follow these rules.**

---

## Usage

```
/p:git commit       # Smart commit with metadata
/p:git push         # Push with verification
/p:git sync         # Pull, rebase, push
/p:git undo         # Undo last commit
```

## ⛔ GLOBAL BLOCKING RULES

### Rule 1: Protected Branch Check (ALL OPERATIONS)

```bash
CURRENT_BRANCH=$(git branch --show-current)
```

**⛔ IF branch is `main` or `master`:**
```
For commit: STOP. "Cannot commit on main. Create a feature branch."
For push: STOP. "Cannot push to main. Use p. ship to create PR."
ABORT the operation entirely.
```

### Rule 2: Dirty Working Directory

```bash
git status --porcelain
```

**⛔ IF uncommitted changes AND operation is push/sync:**
```
STOP. "Uncommitted changes detected. Commit first with p. git commit."
ABORT.
```

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{statePath}`: `{globalPath}/storage/state.json`
- `{memoryPath}`: `{globalPath}/memory/events.jsonl`

## Flow: commit

### Step 1: Pre-flight Checks (BLOCKING)

```bash
# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
```

**⛔ IF on main/master:**
```
STOP. DO NOT PROCEED.
OUTPUT: "Cannot commit on protected branch: {currentBranch}"
OUTPUT: "Create a feature branch first with: p. task 'description'"
ABORT.
```

```bash
# Check for changes
git status --porcelain
```

**⛔ IF no changes:**
```
STOP. DO NOT PROCEED.
OUTPUT: "Nothing to commit."
ABORT.
```

### Step 2: Show Plan and Get Approval (BLOCKING)

```bash
git diff --stat
```

```
OUTPUT:
"""
## Commit Plan

Branch: {currentBranch}
Changes:
{git diff --stat output}

Will create commit with prjct footer.
Proceed? (yes/no)
"""

WAIT for explicit approval.
DO NOT assume.
```

### Step 3: Stage and Commit

```bash
git add .
git commit -m "$(cat <<'EOF'
{type}: {description}

Generated with [p/](https://www.prjct.app/)
EOF
)"
```

**⛔ The prjct footer is MANDATORY. No exceptions.**

### Step 4: Log to Memory

APPEND to `{globalPath}/memory/events.jsonl`

## Flow: push

### Step 1: Pre-flight Checks (BLOCKING)

```bash
CURRENT_BRANCH=$(git branch --show-current)
```

**⛔ IF on main/master:**
```
STOP. DO NOT PROCEED.
OUTPUT: "Cannot push directly to main/master."
OUTPUT: "Use `p. ship` to create a Pull Request instead."
ABORT.
```

```bash
git status --porcelain
```

**⛔ IF uncommitted changes:**
```
STOP. DO NOT PROCEED.
OUTPUT: "Uncommitted changes detected. Commit first."
ABORT.
```

### Step 2: Show Plan and Get Approval (BLOCKING)

```bash
git log origin/{currentBranch}..HEAD --oneline 2>/dev/null || git log --oneline -3
```

```
OUTPUT:
"""
## Push Plan

Branch: {currentBranch}
Commits to push:
{commits}

Proceed? (yes/no)
"""

WAIT for explicit approval.
```

### Step 3: Execute Push

```bash
git push -u origin {currentBranch}
```

**IF push fails:** Show error and STOP. Do not retry automatically.

## Flow: sync

1. Git: `pull --rebase`
2. Resolve: conflicts if any
3. Git: `push`

## Commit Message Format (CRITICAL - ALWAYS USE)

**Every commit MUST include the prjct signature:**

```
{type}: {description}

{details if any}

Generated with [p/](https://www.prjct.app/)

```

**NON-NEGOTIABLE: The `Generated with [p/]` line MUST appear in ALL commits.**

Use HEREDOC for proper formatting:
```bash
git commit -m "$(cat <<'EOF'
{type}: {description}

Generated with [p/](https://www.prjct.app/)

EOF
)"
```

## Response

### Success
```
✅ Git {operation}

Branch: {currentBranch}
{operation_details}

/p:ship | /p:status
```

### Protected Branch Block
```
⚠️ Cannot {operation} on protected branch: {currentBranch}

Use /p:ship to create a Pull Request instead.
```

### Branch Mismatch
```
⚠️ Branch mismatch

Current: {currentBranch}
Expected: {expectedBranch}

Switch to the correct branch: git checkout {expectedBranch}
```

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| On protected branch | "Cannot {op} on protected branch" | STOP |
| Branch mismatch | Show expected vs current | STOP |
| Push fails | "Push failed. Try: git pull --rebase" | STOP |
| Conflicts | Show conflicted files | STOP |
