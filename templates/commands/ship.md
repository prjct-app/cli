---
allowed-tools: [Read, Write, Bash, Glob, Grep]
description: 'Ship feature with automated workflow'
---

# /p:ship - Ship Feature

Ship completed work with pre-flight checks, code review, and quality gates.

## Usage
```
/p:ship [feature] [--blocking] [--skip-review]
```
- `feature`: Name of the feature being shipped (required)
- `--blocking`: Abort if any check fails
- `--skip-review`: Skip code review (for trivial changes)

## Flow

### Step 1: Validate Project
READ: `.prjct/prjct.config.json` → extract `projectId`
IF missing: "No prjct project. Run /p:init first." → STOP

SET: `{globalPath}` = `~/.prjct-cli/projects/{projectId}`

### Step 2: Pre-flight Checks

#### 2.1 Check for changes
BASH: `git status --porcelain`
IF empty: "No changes to ship." → STOP

#### 2.2 Analyze change scope
BASH: `git diff --stat HEAD`
EXTRACT: {filesChanged}, {insertions}, {deletions}
SET: {totalLines} = {insertions} + {deletions}

#### 2.3 Detect trivial changes
IF {totalLines} < 10 AND {filesChanged} <= 2:
  SET: {changeType} = "trivial"
  OUTPUT: "Trivial changes detected ({totalLines} lines in {filesChanged} files)"
ELSE IF {totalLines} < 50:
  SET: {changeType} = "small"
ELSE IF {totalLines} < 200:
  SET: {changeType} = "medium"
ELSE:
  SET: {changeType} = "large"
  OUTPUT: "Large change detected ({totalLines} lines). Full review recommended."

### Step 3: Quality Checks
BASH: `npm run lint 2>&1 || echo "LINT_SKIP"`
BASH: `npm test 2>&1 || echo "TEST_SKIP"`

IF `--blocking` AND (lint failed OR tests failed):
  OUTPUT: "Quality checks failed. Ship blocked."
  STOP

### Step 4: Code Review with Confidence Scoring

IF `--skip-review` OR {changeType} == "trivial":
  OUTPUT: "Skipping code review."
  → Go to Step 5
ELSE:
  OUTPUT: "Running code review..."

#### 4.1 Get changed files
BASH: `git diff --name-only HEAD`
SET: {changedFiles} = result

#### 4.2 Review each file for issues
FOR each file in {changedFiles}:
  BASH: `git diff HEAD -- {file}`

  Analyze diff for:
  - Missing error handling
  - Security issues (hardcoded secrets, SQL injection, XSS)
  - Logic errors
  - Missing null checks
  - Resource leaks

  FOR each issue found:
    ASSIGN confidence score (0-100):
    - 90-100: Definite bug/security issue
    - 70-89: Likely problem, should fix
    - 50-69: Maybe a problem
    - 0-49: Nitpick/style preference

#### 4.3 Filter and report
SET: {issues} = issues with confidence >= 70

IF {issues}.length > 0:
  OUTPUT: """
  ## Code Review Results

  Found {issues.length} issues (confidence >= 70%):

  {FOR each issue:}
  - [{confidence}%] {description}
    File: {file}:{line}
  {END FOR}
  """

  IF `--blocking`:
    OUTPUT: "Fix issues before shipping."
    STOP
  ELSE:
    PROMPT: "Continue with ship? (y/n)"
    IF no: STOP
ELSE:
  OUTPUT: "Code review passed. No high-confidence issues found."

### Step 5: Version Bump
READ: `package.json` (or Cargo.toml, pyproject.toml)
EXTRACT: current version

BASH: `git log --oneline -10`
Determine bump type:
- "BREAKING" or "major:" → major
- "feat:" or "feature:" → minor
- else → patch

UPDATE version file with new version

### Step 6: Update CHANGELOG
BASH: `git log --oneline -20 --pretty=format:"- %s"`
INSERT new entry in CHANGELOG.md

### Step 7: Git Commit & Push
BASH: `git add .`
BASH: `git commit -m "feat: Ship {feature} v{newVersion}

🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Claude](https://www.anthropic.com/claude)
"`
BASH: `git push`

### Step 8: Update Storage
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

### Step 9: Output
```
🚀 Shipped: {feature}

Version: {oldVersion} → {newVersion}
Changes: {changeType} ({totalLines} lines in {filesChanged} files)
Quality: Lint {lintStatus} | Tests {testStatus}
Review: {reviewStatus}

Next: /p:feature | /p:recap
```

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No git repo | "Not a git repository" | STOP |
| No changes | "No changes to ship" | STOP |
| Lint/test fails (blocking) | "Quality checks failed" | STOP |
| Lint/test fails (non-blocking) | Show warning | CONTINUE |
| Code review finds issues (blocking) | "Fix issues before shipping" | STOP |
| Code review finds issues (non-blocking) | Prompt to continue | ASK |
| Push fails | "Push failed. Try: git pull --rebase" | CONTINUE |

## Examples

### Example 1: Trivial Change (auto-skip review)
```
/p:ship "fix typo"

Pre-flight: Trivial changes (3 lines in 1 file)
Quality: Lint ✅ | Tests ✅
Review: Skipped (trivial)

🚀 Shipped: fix typo
Version: 1.2.0 → 1.2.1
```

### Example 2: Medium Change (with review)
```
/p:ship "add auth"

Pre-flight: Medium changes (87 lines in 5 files)
Quality: Lint ✅ | Tests ✅
Review: Running...

## Code Review Results
Found 2 issues (confidence >= 70%):
- [85%] Missing error handling in OAuth callback
  File: src/auth/oauth.ts:67
- [72%] Token not validated before use
  File: src/auth/validate.ts:23

Continue with ship? (y/n)
```

### Example 3: Blocking Mode
```
/p:ship "deploy script" --blocking

Pre-flight: Small changes (28 lines in 2 files)
Quality: Lint ✅ | Tests ✅
Review: Running...

## Code Review Results
Found 1 issue (confidence >= 70%):
- [95%] Hardcoded credentials detected
  File: scripts/deploy.sh:12

Fix issues before shipping.
```

## References
- Architecture details: `~/.prjct-cli/docs/architecture.md`
- Validation patterns: `~/.prjct-cli/docs/validation.md`
