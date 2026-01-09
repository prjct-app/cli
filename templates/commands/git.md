---
allowed-tools: [Bash, Read, Write]
description: 'Smart git operations with context'
architecture: 'Write-Through (JSON → MD → Events)'
storage-layer: true
source-of-truth: 'storage/state.json'
---

# /p:git - Smart Git Operations

## Architecture: Write-Through Pattern

Reads from **Storage (JSON)** as source of truth.

**Source of Truth**: `storage/state.json`

## Usage

```
/p:git commit       # Smart commit with metadata
/p:git push         # Push with verification
/p:git sync         # Pull, rebase, push
/p:git undo         # Undo last commit
```

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{statePath}`: `{globalPath}/storage/state.json`
- `{memoryPath}`: `{globalPath}/memory/events.jsonl`

## Flow: commit

### Step 1: Validate Branch
READ: `.prjct/prjct.config.json` → extract `projectId`
SET: `{globalPath}` = `~/.prjct-cli/projects/{projectId}`

READ: `{globalPath}/storage/state.json`
IF currentTask AND currentTask.branch:
  SET: {expectedBranch} = currentTask.branch.name
ELSE:
  SET: {expectedBranch} = null

BASH: `git branch --show-current`
SET: {currentBranch} = result

IF {currentBranch} == "main" OR {currentBranch} == "master":
  OUTPUT:
  ```
  ⚠️ Cannot commit on protected branch: {currentBranch}

  Start a task first with /p:now "task name" to create a feature branch.
  ```
  STOP

IF {expectedBranch} AND {currentBranch} != {expectedBranch}:
  OUTPUT:
  ```
  ⚠️ Branch mismatch

  Current: {currentBranch}
  Expected: {expectedBranch}

  Switch to the correct branch: git checkout {expectedBranch}
  ```
  STOP

### Step 2: Stage and Commit
1. Git: `add .` → stage changes
2. Create: commit message with prjct metadata
3. Commit: with message
4. Log: `memory/events.jsonl`

## Flow: push

### Step 1: Check Protected Branch
BASH: `git branch --show-current`
SET: {currentBranch} = result

IF {currentBranch} == "main" OR {currentBranch} == "master":
  OUTPUT:
  ```
  ⚠️ Cannot push directly to protected branch: {currentBranch}

  Use /p:ship to create a Pull Request instead.
  ```
  STOP

### Step 2: Push
1. Git: `status` → verify clean
2. Git: `push -u origin {currentBranch}` with branch tracking
3. Handle: errors (upstream, conflicts)

## Flow: sync

1. Git: `pull --rebase`
2. Resolve: conflicts if any
3. Git: `push`

## Commit Message Format (CRITICAL - ALWAYS USE)

**Every commit MUST include the prjct signature:**

```
{type}: {description}

{details if any}

🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Claude](https://www.anthropic.com/claude)

```

**NON-NEGOTIABLE: The `🤖 Generated with [p/]` line MUST appear in ALL commits.**

Use HEREDOC for proper formatting:
```bash
git commit -m "$(cat <<'EOF'
{type}: {description}

🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Claude](https://www.anthropic.com/claude)

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
