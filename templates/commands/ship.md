---
allowed-tools: [Read, Write, Bash]
description: 'Ship feature with automated workflow'
timestamp-rule: 'GetTimestamp() and GetDate() for ALL timestamps'
architecture: 'MD-first - MD files are source of truth'
---

# /p:ship - Ship Feature Workflow

## Architecture: MD-First

**Source of Truth**: `progress/shipped.md`, `planning/roadmap.md`

MD files are the source of truth. Write directly to MD files.

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{shippedPath}`: `{globalPath}/progress/shipped.md`
- `{roadmapPath}`: `{globalPath}/planning/roadmap.md`
- `{memoryPath}`: `{globalPath}/memory/context.jsonl`
- `{snapshotDir}`: `{globalPath}/snapshots`
- `{feature}`: User-provided feature name
- `{outcome}`: User-provided outcome status (optional)

## Outcome Categories

Track what happened after shipping:

| Outcome | Meaning | Use When |
|---------|---------|----------|
| `validated` | Confirmed working in production | Feature verified by users/tests |
| `monitoring` | Deployed, needs observation | Just shipped, watching metrics |
| `known-issues` | Working with caveats | Minor issues known, acceptable |

If no outcome provided, default to `monitoring`.

Prompt (optional):
```
Ship outcome? (default: monitoring)
1. validated - Confirmed working
2. monitoring - Watching metrics
3. known-issues - Has minor issues
```

## Step 1: Read Config

READ: `.prjct/prjct.config.json`
EXTRACT: `projectId`

IF file not found:
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

## Step 2: Validate Prerequisites

BASH: `git status --porcelain`

IF output empty (no changes):
  OUTPUT: "⚠️ No changes to ship. Make some commits first."
  STOP

BASH: `git rev-parse --is-inside-work-tree`

IF not a git repo:
  OUTPUT: "⚠️ Not a git repository. Initialize git first."
  STOP

## Step 3: Quality Checks (Non-Blocking)

### Lint Check
BASH: `npm run lint 2>&1 || echo "LINT_SKIP"`

CAPTURE output as {lintResult}

IF contains "LINT_SKIP" OR contains "missing script":
  {lintStatus} = "skipped"
ELSE IF contains "error":
  {lintStatus} = "warnings"
ELSE:
  {lintStatus} = "passed"

### Test Check
BASH: `npm test 2>&1 || echo "TEST_SKIP"`

CAPTURE output as {testResult}

IF contains "TEST_SKIP" OR contains "missing script":
  {testStatus} = "skipped"
ELSE IF contains "failed" OR contains "FAIL":
  {testStatus} = "failed"
ELSE:
  {testStatus} = "passed"

**Note**: These are NON-BLOCKING. Continue even if they fail.

## Step 4: Version Bump (MANDATORY)

**CRITICAL**: Version bump is ALWAYS required. No exceptions.

### Read Current Version (Language Agnostic)

Detect project type and read version from appropriate file:

| File | Language | Version Location |
|------|----------|------------------|
| `package.json` | Node.js | `"version": "X.Y.Z"` |
| `Cargo.toml` | Rust | `version = "X.Y.Z"` |
| `pyproject.toml` | Python | `version = "X.Y.Z"` |
| `go.mod` | Go | Use git tags |
| `VERSION` | Any | Plain text `X.Y.Z` |

BASH: Check which config exists:
```bash
ls package.json Cargo.toml pyproject.toml VERSION 2>/dev/null | head -1
```

READ appropriate file and EXTRACT: {currentVersion}

IF no version file found:
  CREATE: `VERSION` file with content `0.0.0`
  {currentVersion} = "0.0.0"

### Determine Bump Type

BASH: `git log --oneline -10`

ANALYZE commit messages:

IF any commit contains "BREAKING" OR "major:":
  {bumpType} = "major"
  {newVersion} = increment X in X.Y.Z, set Y=0, Z=0

ELSE IF any commit contains "feat:" OR "feature:":
  {bumpType} = "minor"
  {newVersion} = increment Y in X.Y.Z, set Z=0

ELSE:
  {bumpType} = "patch"
  {newVersion} = increment Z in X.Y.Z

### Update Version File (MANDATORY)

Update the same file where version was read:
- `package.json`: Update `"version"` field
- `Cargo.toml`: Update `version` in `[package]`
- `pyproject.toml`: Update `version` in `[project]`
- `VERSION`: Replace entire content

WRITE the updated file.

**This step MUST complete. If it fails, STOP and report error.**

## Step 5: Update CHANGELOG (MANDATORY)

**CRITICAL**: CHANGELOG.md MUST be created/updated. No exceptions.

### Check if CHANGELOG exists

BASH: `ls CHANGELOG.md 2>/dev/null || echo "NOT_FOUND"`

IF "NOT_FOUND":
  CREATE new CHANGELOG.md with header:
  ```markdown
  # Changelog

  All notable changes to this project will be documented in this file.

  The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
  and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

  ```

### Get Recent Commits for Changelog

BASH: `git log --oneline -20 --pretty=format:"- %s"`
CAPTURE as {commitList}

### Format New Entry

```markdown
## [{newVersion}] - {GetDate()}

### {feature}

#### Changes
{commitList}

#### Quality
- Lint: {lintStatus}
- Tests: {testStatus}

---

```

### Insert Entry

READ: `CHANGELOG.md`
INSERT new entry after "# Changelog" header (or after the preamble text)
WRITE: `CHANGELOG.md`

**This step MUST complete. CHANGELOG.md MUST exist in repo after ship.**

## Step 6: Git Commit

### Stage Changes
BASH: `git add .`

### Create Commit
BASH: `git commit -m "$(cat <<'EOF'
feat: Ship {feature} v{newVersion}

🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Claude](https://www.anthropic.com/claude)
EOF
)"`

## Step 7: Git Push

BASH: `git push 2>&1`

CAPTURE output as {pushResult}

IF contains "rejected" OR contains "failed":
  OUTPUT: "⚠️ Push failed. Try: git pull --rebase && git push"
  CONTINUE (don't stop)

IF contains "no upstream":
  BASH: `git push -u origin HEAD`

## Step 8: Update Shipped (MD)

SET: {now} = GetTimestamp()
GENERATE: {shipId} = "ship_" + 8 random alphanumeric chars

READ: `{shippedPath}` (or create default if not exists)

Default structure:
```markdown
# Shipped

## Recent

_Nothing shipped yet_

## Archive

_No archived ships_
```

### Get changes from git
BASH: `git log --oneline -5`
CAPTURE commit messages as {changes}

### Update shipped.md

Parse existing content and add new ship under "## Recent" section:

```markdown
# Shipped

## Recent

### {feature} (v{newVersion})
- **ID**: {shipId}
- **Shipped**: {now}
- **Outcome**: {outcome}
- **Lint**: {lintStatus}
- **Tests**: {testStatus}
- **Changes**:
  {changes as bullet list}

{...existing recent ships}

## Archive

{...existing archive}
```

WRITE: `{shippedPath}`

## Step 9: Update Roadmap Status (MD)

READ: `{roadmapPath}`

### Find matching feature and update status
Look for feature entry matching {feature}:
- Change status from `pending` or `active` to `shipped`
- Add `Shipped: {now}` line
- Add `Version: {newVersion}` line

WRITE: `{roadmapPath}`

## Step 10: Log to Daily Session (for Dashboard Charts)

GET: {date} = YYYY-MM-DD from {now}
GET: {yearMonth} = YYYY-MM from {now}
SET: {dailySessionPath} = `{globalPath}/progress/sessions/{yearMonth}/{date}.jsonl`

BASH: `mkdir -p {globalPath}/progress/sessions/{yearMonth}`

APPEND to: `{dailySessionPath}`

Single line (JSONL format):
```json
{"ts":"{now}","type":"feature_ship","name":"{feature}","version":"{newVersion}"}
```

## Step 11: Log to Memory

APPEND to: `{memoryPath}`

Single line (JSONL):
```json
{"timestamp":"{now}","action":"feature_shipped","shipId":"{shipId}","feature":"{feature}","version":"{newVersion}","outcome":"{outcome}"}
```

## Step 12: Create Snapshot (Undo/Redo Support)

This creates a snapshot for the undo/redo system.

### Initialize Snapshot Directory
BASH: `mkdir -p {snapshotDir}`

### Check if Git Repo Exists
BASH: `ls {snapshotDir}/.git 2>/dev/null || echo "INIT_NEEDED"`

IF output contains "INIT_NEEDED":
  BASH: `cd {snapshotDir} && git init && git config user.email "prjct@local" && git config user.name "prjct-snapshots" && git commit --allow-empty -m "init: snapshot system"`

### Copy Changed Files to Snapshot
BASH: `git diff --name-only HEAD~1 2>/dev/null || git diff --name-only`
CAPTURE as {changedFiles}

For each file in {changedFiles}:
  - Source: `{projectPath}/{file}`
  - Destination: `{snapshotDir}/{file}`
  - Create parent directories if needed
  - Copy file content

### Commit Snapshot
BASH: `cd {snapshotDir} && git add -A && git commit -m "Ship: {feature} (v{newVersion})" 2>/dev/null || echo "NO_CHANGES"`

### Get Snapshot Hash
BASH: `cd {snapshotDir} && git rev-parse --short HEAD`
CAPTURE as {snapshotHash}

### Clear Redo Stack (new snapshot invalidates redo)
WRITE: `{snapshotDir}/redo-stack.json`
Content: `[]`

### Log Snapshot
APPEND to: `{snapshotDir}/manifest.jsonl`

Single line (JSONL):
```json
{"type":"snapshot","hash":"{snapshotHash}","message":"Ship: {feature}","version":"{newVersion}","timestamp":"{GetTimestamp()}"}
```

## Step 13: Update project.json (MANDATORY)

**CRITICAL**: `project.json` MUST be updated with new version. This is what the dashboard displays.

SET: {projectJsonPath} = `{globalPath}/project.json`

READ: `{projectJsonPath}`

UPDATE the following fields:
- `"version"`: Set to `{newVersion}`
- `"hasUncommittedChanges"`: Set to `false`
- `"lastSync"`: Set to `{now}`

WRITE: `{projectJsonPath}`

**This step is MANDATORY. If project.json is not updated, the dashboard will show stale data.**

## Step 14: Run Deep Sync

**CRITICAL**: After shipping, run a full sync to update ALL project data.

Execute `/p:sync` logic:
- Update `CLAUDE.md` Quick Reference table
- Sync `core/now.md` (clear completed task)
- Sync `core/next.md` (remove shipped items)
- Update commit count and file stats

This ensures the dashboard reflects the latest state after shipping.

## Output

SUCCESS:
```
🚀 Shipped: {feature}

Version: {currentVersion} → {newVersion}
Outcome: {outcome}
Lint: {lintStatus}
Tests: {testStatus}
Commit: {commitHash}
Snapshot: {snapshotHash}

🔄 Synced project data
├── Files: {fileCount}
├── Commits: {commitCount}
└── All MD files updated

Next:
• /p:undo - Revert this ship if needed
• /p:feature - Plan next feature
• /p:recap - See progress
```

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No git repo | "Not a git repository" | STOP |
| No changes | "No changes to ship" | STOP |
| Lint fails | Show warning | CONTINUE |
| Tests fail | Show warning | CONTINUE |
| Push fails | Show fix command | CONTINUE |
| No version file | CREATE `VERSION` file | CONTINUE |
| Version bump fails | "Failed to update version" | STOP |
| CHANGELOG fails | "Failed to update changelog" | STOP |

**MANDATORY outputs (never skip):**
- Version file updated (package.json, Cargo.toml, pyproject.toml, or VERSION)
- `CHANGELOG.md` with new entry
- Git commit with version in message

## Examples

### Example 1: Full Success (validated)
```
🚀 Shipped: user authentication

Version: 1.2.0 → 1.3.0
Outcome: validated
Lint: passed
Tests: passed
Commit: abc1234

Next: /p:feature | /p:recap | compact
```

### Example 2: With Warnings (monitoring)
```
🚀 Shipped: bug fixes

Version: 1.2.0 → 1.2.1
Outcome: monitoring
Lint: warnings (non-blocking)
Tests: skipped
Commit: def5678

⚠️ Consider fixing lint warnings

Next: /p:feature | /p:recap | compact
```

### Example 3: Known Issues
```
🚀 Shipped: performance updates

Version: 1.2.0 → 1.2.1
Outcome: known-issues
Lint: passed
Tests: passed
Commit: ghi9012

Note: Minor edge case in Safari, tracking issue #45

Next: /p:feature | /p:recap | compact
```
