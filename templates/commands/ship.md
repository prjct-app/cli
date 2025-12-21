---
allowed-tools: [Read, Write, Bash]
description: 'Ship feature with automated workflow'
---

# /p:ship - Ship Feature

Ship completed work with quality checks, version bump, and git commit.

## Usage
```
/p:ship [feature] [--blocking]
```
- `feature`: Name of the feature being shipped (required)
- `--blocking`: Abort if lint/tests fail

## Flow

### Step 1: Validate
READ: `.prjct/prjct.config.json` → extract `projectId`
IF missing: "No prjct project. Run /p:init first." → STOP

SET: `{globalPath}` = `~/.prjct-cli/projects/{projectId}`

BASH: `git status --porcelain`
IF empty: "No changes to ship." → STOP

### Step 2: Quality Checks (optional)
BASH: `npm run lint 2>&1 || echo "LINT_SKIP"`
BASH: `npm test 2>&1 || echo "TEST_SKIP"`

IF `--blocking` AND (lint failed OR tests failed):
  OUTPUT: "Quality checks failed. Ship blocked."
  STOP

### Step 3: Version Bump
READ: `package.json` (or Cargo.toml, pyproject.toml)
EXTRACT: current version

BASH: `git log --oneline -10`
Determine bump type:
- "BREAKING" or "major:" → major
- "feat:" or "feature:" → minor
- else → patch

UPDATE version file with new version

### Step 4: Update CHANGELOG
BASH: `git log --oneline -20 --pretty=format:"- %s"`
INSERT new entry in CHANGELOG.md

### Step 5: Git Commit & Push
BASH: `git add .`
BASH: `git commit -m "feat: Ship {feature} v{newVersion}

🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Claude](https://www.anthropic.com/claude)
"`
BASH: `git push`

### Step 6: Update Storage
GET timestamp: `bun -e "console.log(new Date().toISOString())" 2>/dev/null || node -e "console.log(new Date().toISOString())"`
GET uuid: `bun -e "console.log(crypto.randomUUID())" 2>/dev/null || node -e "console.log(require('crypto').randomUUID())"`

READ: `{globalPath}/storage/shipped.json` (or create default)
PREPEND new ship object:
```json
{
  "id": "{uuid}",
  "name": "{feature}",
  "version": "{newVersion}",
  "shippedAt": "{timestamp}",
  "lint": "{lintStatus}",
  "tests": "{testStatus}"
}
```
WRITE: `{globalPath}/storage/shipped.json`

Generate context:
WRITE: `{globalPath}/context/shipped.md`

Queue sync event:
APPEND to `{globalPath}/sync/pending.json`

Log to memory:
APPEND to `{globalPath}/memory/events.jsonl`

### Step 7: Output
```
🚀 Shipped: {feature}

Version: {oldVersion} → {newVersion}
Lint: {lintStatus} | Tests: {testStatus}

Next: /p:feature | /p:recap
```

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No git repo | "Not a git repository" | STOP |
| No changes | "No changes to ship" | STOP |
| Lint/test fails (blocking) | "Quality checks failed" | STOP |
| Lint/test fails (non-blocking) | Show warning | CONTINUE |
| Push fails | "Push failed. Try: git pull --rebase" | CONTINUE |

## References
- Architecture details: `~/.prjct-cli/docs/architecture.md`
- Validation patterns: `~/.prjct-cli/docs/validation.md`
