---
allowed-tools: [Read, Write, Bash]
description: 'Ship feature with automated workflow'
timestamp-rule: 'GetTimestamp() and GetDate() for ALL timestamps'
---

# /p:ship - Ship Feature Workflow

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{shippedPath}`: `{globalPath}/progress/shipped.md`
- `{memoryPath}`: `{globalPath}/memory/context.jsonl`
- `{feature}`: User-provided feature name

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

## Step 4: Version Bump

READ: `package.json`
EXTRACT: current version as {currentVersion}

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

### Update package.json

READ: `package.json`
REPLACE: `"version": "{currentVersion}"` with `"version": "{newVersion}"`
WRITE: `package.json`

## Step 5: Update CHANGELOG

READ: `CHANGELOG.md` (create if not exists)

### Format New Entry

```markdown
## [{newVersion}] - {GetDate()}

### {feature}
- Shipped by prjct-cli
- Lint: {lintStatus}
- Tests: {testStatus}
```

INSERT at top of file (after # Changelog header)

WRITE: `CHANGELOG.md`

## Step 6: Git Commit

### Stage Changes
BASH: `git add .`

### Create Commit
BASH: `git commit -m "$(cat <<'EOF'
feat: Ship {feature}

- Version: {newVersion}
- Lint: {lintStatus}
- Tests: {testStatus}

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

## Step 8: Log to Session

GET: {date} = GetDate()
EXTRACT: {yearMonth} = YYYY-MM from {date}

ENSURE directory exists:
BASH: `mkdir -p {globalPath}/progress/sessions/{yearMonth}`

APPEND to: `{globalPath}/progress/sessions/{yearMonth}/{date}.jsonl`

Single line (JSONL):
```json
{"ts":"{GetTimestamp()}","type":"feature_ship","name":"{feature}","version":"{newVersion}","lint":"{lintStatus}","tests":"{testStatus}"}
```

## Step 9: Update Shipped Index

READ: `{shippedPath}` (create if not exists)

### Format New Entry

```markdown
## {GetDate()} - {feature}
- Version: {newVersion}
- Lint: {lintStatus} | Tests: {testStatus}
```

INSERT at top (after # Shipped header)

### Archive Old Entries
IF file has entries older than 30 days:
  MOVE old entries to: `{globalPath}/progress/archive/shipped-{yearMonth}.md`

WRITE: `{shippedPath}`

## Step 10: Log to Memory

APPEND to: `{memoryPath}`

Single line (JSONL):
```json
{"timestamp":"{GetTimestamp()}","action":"feature_shipped","feature":"{feature}","version":"{newVersion}"}
```

## Output

SUCCESS:
```
🚀 Shipped: {feature}

Version: {currentVersion} → {newVersion}
Lint: {lintStatus}
Tests: {testStatus}
Commit: {commitHash}

Next:
• /p:feature - Plan next feature
• /p:recap - See progress
• compact - Clean up conversation
```

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No git repo | "Not a git repository" | STOP |
| No changes | "No changes to ship" | STOP |
| Lint fails | Show warning | CONTINUE |
| Tests fail | Show warning | CONTINUE |
| Push fails | Show fix command | CONTINUE |
| No package.json | Skip version bump | CONTINUE |

## Examples

### Example 1: Full Success
```
🚀 Shipped: user authentication

Version: 1.2.0 → 1.3.0
Lint: passed
Tests: passed
Commit: abc1234

Next: /p:feature | /p:recap | compact
```

### Example 2: With Warnings
```
🚀 Shipped: bug fixes

Version: 1.2.0 → 1.2.1
Lint: warnings (non-blocking)
Tests: skipped
Commit: def5678

⚠️ Consider fixing lint warnings

Next: /p:feature | /p:recap | compact
```

### Example 3: No Tests/Lint
```
🚀 Shipped: documentation update

Version: 1.2.0 → 1.2.1
Lint: skipped (no script)
Tests: skipped (no script)
Commit: ghi9012

Next: /p:feature | /p:recap | compact
```
