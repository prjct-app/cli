---
allowed-tools: [Read, Write, Bash]
description: 'Ship feature with automated workflow'
timestamp-rule: 'GetTimestamp() and GetDate() for ALL timestamps'
architecture: 'Write-Through (JSON → MD → Events)'
storage-layer: true
source-of-truth: 'storage/shipped.json'
claude-context: 'context/shipped.md'
backend-sync: 'sync/pending.json'
---

# /p:ship - Ship Feature Workflow

## Architecture: Write-Through Pattern

```
User Action → Storage (JSON) → Context (MD) → Sync Events
```

**Source of Truth**: `storage/shipped.json`
**Claude Context**: `context/shipped.md` (generated)
**Backend Sync**: `sync/pending.json` (events)

## Usage

```
/p:ship [feature] [outcome] [--blocking]
```

- `feature`: Name of the feature being shipped (required)
- `outcome`: Status category - validated|monitoring|known-issues (default: monitoring)
- `--blocking`: Abort ship if lint or tests fail

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{shippedStoragePath}`: `{globalPath}/storage/shipped.json`
- `{shippedContextPath}`: `{globalPath}/context/shipped.md`
- `{syncPath}`: `{globalPath}/sync/pending.json`
- `{memoryPath}`: `{globalPath}/memory/events.jsonl`
- `{snapshotDir}`: `{globalPath}/snapshots`
- `{feature}`: User-provided feature name
- `{outcome}`: User-provided outcome status (optional)
- `{blocking}`: Whether to abort on quality check failures

## Outcome Categories

Track what happened after shipping:

| Outcome | Meaning | Use When |
|---------|---------|----------|
| `validated` | Confirmed working in production | Feature verified by users/tests |
| `monitoring` | Deployed, needs observation | Just shipped, watching metrics |
| `known-issues` | Working with caveats | Minor issues known, acceptable |

If no outcome provided, default to `monitoring`.

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

## Step 3: Quality Checks

### Parse Blocking Flag

IF args contains "--blocking":
  {blocking} = true
ELSE:
  {blocking} = false

### Lint Check
BASH: `npm run lint 2>&1 || echo "LINT_SKIP"`
CAPTURE output as {lintResult}

IF contains "LINT_SKIP" OR contains "missing script":
  {lintStatus} = "skipped"
ELSE IF contains "error":
  {lintStatus} = "failed"
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

### Blocking Gate

IF {blocking}:
  IF {lintStatus} == "failed" OR {testStatus} == "failed":
    OUTPUT: "❌ Quality checks failed. Ship blocked."
    OUTPUT: ""
    OUTPUT: "• Lint: {lintStatus}"
    OUTPUT: "• Tests: {testStatus}"
    OUTPUT: ""
    OUTPUT: "Fix issues or ship without --blocking flag."
    STOP

**Note**: Without --blocking flag, quality checks are advisory only.
**Tip**: Use `/p:test ai` for AI-powered tests before shipping.

## Step 4: Version Bump (MANDATORY)

### Read Current Version
Detect project type and read version:

| File | Language | Version Location |
|------|----------|------------------|
| `package.json` | Node.js | `"version": "X.Y.Z"` |
| `Cargo.toml` | Rust | `version = "X.Y.Z"` |
| `pyproject.toml` | Python | `version = "X.Y.Z"` |
| `VERSION` | Any | Plain text `X.Y.Z` |

### Determine Bump Type
BASH: `git log --oneline -10`

IF any commit contains "BREAKING" OR "major:":
  {bumpType} = "major"
ELSE IF any commit contains "feat:" OR "feature:":
  {bumpType} = "minor"
ELSE:
  {bumpType} = "patch"

### Update Version File
Update the version file with {newVersion}

## Step 5: Update CHANGELOG (MANDATORY)

### Get Recent Commits
BASH: `git log --oneline -20 --pretty=format:"- %s"`
CAPTURE as {commitList}

### Create/Update CHANGELOG.md
INSERT new entry after header.

## Step 6: Git Commit

BASH: `git add .`

BASH: `git commit -m "$(cat <<'EOF'
feat: Ship {feature} v{newVersion}

🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Claude](https://www.anthropic.com/claude)
EOF
)"`

## Step 7: Git Push

BASH: `git push 2>&1`

IF contains "rejected" OR contains "failed":
  OUTPUT: "⚠️ Push failed. Try: git pull --rebase && git push"
  CONTINUE

## Step 8: Update Storage (SOURCE OF TRUTH)

SET: {now} = GetTimestamp()
GENERATE: {shipId} = UUID v4

### Read existing shipped
READ: `{shippedStoragePath}` or create default:
```json
{
  "shipped": [],
  "lastUpdated": null
}
```

### Create ship object
```json
{
  "id": "{shipId}",
  "name": "{feature}",
  "version": "{newVersion}",
  "outcome": "{outcome}",
  "shippedAt": "{now}",
  "lint": "{lintStatus}",
  "tests": "{testStatus}",
  "commits": {commits}
}
```

### Update shipped.json
PREPEND new ship to shipped array
SET: lastUpdated = {now}
WRITE: `{shippedStoragePath}`

## Step 9: Generate Context (FOR CLAUDE)

WRITE: `{shippedContextPath}`

```markdown
# SHIPPED 🚀

## {Month Year}

{FOR EACH ship in shipped WHERE month matches:}
- **{ship.name}** v{ship.version} - {ship.shippedAt}
{END FOR}

---

**Total shipped:** {shipped.length}
```

## Step 10: Queue Sync Event (FOR BACKEND)

READ: `{syncPath}` or create empty array
APPEND event:
```json
{
  "type": "feature.shipped",
  "path": ["shipped"],
  "data": {
    "shipId": "{shipId}",
    "name": "{feature}",
    "version": "{newVersion}",
    "outcome": "{outcome}",
    "shippedAt": "{now}"
  },
  "timestamp": "{now}",
  "projectId": "{projectId}"
}
```
WRITE: `{syncPath}`

## Step 11: Log to Daily Session

GET: {date} = YYYY-MM-DD from {now}
GET: {yearMonth} = YYYY-MM from {now}
SET: {dailySessionPath} = `{globalPath}/progress/sessions/{yearMonth}/{date}.jsonl`

BASH: `mkdir -p {globalPath}/progress/sessions/{yearMonth}`

APPEND to: `{dailySessionPath}`
```json
{"ts":"{now}","type":"feature_ship","name":"{feature}","version":"{newVersion}"}
```

## Step 12: Log to Memory (AUDIT TRAIL)

APPEND to: `{memoryPath}`
```json
{"timestamp":"{now}","action":"feature_shipped","shipId":"{shipId}","feature":"{feature}","version":"{newVersion}","outcome":"{outcome}"}
```

## Step 13: Update project.json

SET: {projectJsonPath} = `{globalPath}/project.json`

READ: `{projectJsonPath}`
UPDATE:
- `"version"`: Set to `{newVersion}`
- `"hasUncommittedChanges"`: Set to `false`
- `"lastSync"`: Set to `{now}`
WRITE: `{projectJsonPath}`

## Step 14: Run Deep Sync

Execute `/p:sync` logic to update all context files.

## Output

SUCCESS:
```
🚀 Shipped: {feature}

Version: {currentVersion} → {newVersion}
Outcome: {outcome}
Lint: {lintStatus}
Tests: {testStatus}
Commit: {commitHash}

🔄 Synced project data

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
| Version bump fails | "Failed to update version" | STOP |

## Examples

### Example 1: Full Success
```
🚀 Shipped: user authentication

Version: 1.2.0 → 1.3.0
Outcome: validated
Lint: passed
Tests: passed
Commit: abc1234

Next: /p:feature | /p:recap
```

### Example 2: With Warnings
```
🚀 Shipped: bug fixes

Version: 1.2.0 → 1.2.1
Outcome: monitoring
Lint: warnings
Tests: passed
Commit: def5678

⚠️ Consider fixing lint warnings

Next: /p:feature | /p:recap
```

### Example 3: Blocked by Failures
```
❌ Quality checks failed. Ship blocked.

• Lint: passed
• Tests: failed

Fix issues or ship without --blocking flag.
```
