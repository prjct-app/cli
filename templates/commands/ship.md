---
allowed-tools: [Read, Write, Bash, Glob, Grep, AskUserQuestion]
description: 'Ship feature with automated PR workflow'
---

# /p:ship - Ship Feature

Ship completed work with pre-flight checks, code review, PR creation, and CI verification.

## Usage
```
/p:ship [feature] [--blocking] [--skip-review] [--draft]
```
- `feature`: Name of the feature being shipped (required)
- `--blocking`: Abort if any check fails
- `--skip-review`: Skip code review (for trivial changes)
- `--draft`: Create PR as draft

## Flow

### Step 1: Validate Project
READ: `.prjct/prjct.config.json` → extract `projectId`
IF missing: "No prjct project. Run /p:init first." → STOP

SET: `{globalPath}` = `~/.prjct-cli/projects/{projectId}`

### Step 1.5: Validate Workflow Phase

READ: `{globalPath}/storage/state.json`

IF currentTask exists AND currentTask.workflow exists:
  IF currentTask.workflow.phase != "merge":
    OUTPUT:
    ```
    Cannot ship. Current phase: {currentTask.workflow.phase}

    Required phase: merge

    Workflow: analyze → branch → implement → test → review → merge → ship → verify

    Complete previous phases first:
    - p. test (if in implement)
    - p. review (if in test)
    - p. merge (if in review)
    ```
    STOP

### Step 1.6: Validate Open Tasks (AGENTIC)

IF currentTask exists AND status == "active":
  SET: {openTaskDescription} = currentTask.description
  SET: {elapsedTime} = time since currentTask.startedAt (format: "Xh Ym" or "Xm")

  ### Check for related subtasks
  IF currentTask.subtasks exists:
    SET: {pendingSubtasks} = subtasks where status == "pending"
    SET: {pendingCount} = {pendingSubtasks}.length + 1  # +1 for current
  ELSE:
    SET: {pendingCount} = 1

  USE AskUserQuestion:
  ```
  question: "Active task: '{openTaskDescription}' ({elapsedTime}). {pendingCount} task(s) open. Ship anyway?"
  header: "Open Tasks"
  options:
    - label: "Complete all and ship"
      description: "Mark {pendingCount} task(s) as done, then ship"
    - label: "Complete current only"
      description: "Finish '{openTaskDescription}', ship now"
    - label: "Cancel"
      description: "Return to work, ship later"
  ```

  IF choice == "Cancel":
    OUTPUT: "Ship cancelled. Continue working on: {openTaskDescription}"
    STOP

  IF choice == "Complete all and ship":
    ### Mark all subtasks complete
    IF currentTask.subtasks exists:
      SET: {now} = GetTimestamp()
      FOR each subtask in currentTask.subtasks:
        IF subtask.status != "completed":
          SET: subtask.status = "completed"
          SET: subtask.completedAt = "{now}"

    ### Mark current task complete
    SET: {now} = GetTimestamp()
    SET: previousTask = {
      ...currentTask,
      "status": "completed",
      "completedAt": "{now}"
    }
    SET: currentTask = null
    WRITE: `{globalPath}/storage/state.json`

    APPEND to `{globalPath}/memory/events.jsonl`:
    ```json
    {"timestamp":"{now}","action":"task_auto_completed","reason":"ship","taskId":"{previousTask.id}"}
    ```

    OUTPUT: "✅ Completed: {openTaskDescription}"

  IF choice == "Complete current only":
    SET: {now} = GetTimestamp()
    SET: previousTask = {
      ...currentTask,
      "status": "completed",
      "completedAt": "{now}"
    }
    SET: currentTask = null
    WRITE: `{globalPath}/storage/state.json`

    APPEND to `{globalPath}/memory/events.jsonl`:
    ```json
    {"timestamp":"{now}","action":"task_auto_completed","reason":"ship","taskId":"{previousTask.id}"}
    ```

    OUTPUT: "✅ Completed: {openTaskDescription}"

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
Detect and run the project's existing quality commands (do not assume JS tooling):

- **Lint**: run only if the project already has a lint command configured (e.g. `npm run lint`, `pnpm run lint`, `yarn lint`, `bun run lint`)
- **Tests**: run the repo's test runner:
  - JS: `{packageManager} test` (npm/pnpm/yarn/bun)
  - Python: `pytest`
  - Go: `go test ./...`
  - Rust: `cargo test`
  - .NET: `dotnet test`
  - Java: `mvn test` or `./gradlew test`

BASH: `{lintCommand} 2>&1 || echo "LINT_SKIP"`  # if detected
BASH: `{testCommand} 2>&1 || echo "TEST_SKIP"`  # if detected

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

### Step 7: Create Pull Request

#### 7.1 Check gh CLI
BASH: `which gh 2>/dev/null`
IF result empty:
  OUTPUT:
  ```
  ⚠️ GitHub CLI (gh) not installed

  Install: https://cli.github.com/
  Or: brew install gh

  After installing, run: gh auth login
  ```
  STOP

#### 7.2 Check Authentication
BASH: `gh auth status 2>&1`
IF not authenticated:
  OUTPUT: "Run `gh auth login` to authenticate with GitHub"
  STOP

#### 7.3 Get Branch Info
READ: `{globalPath}/storage/state.json`
IF currentTask AND currentTask.branch:
  SET: {branchName} = currentTask.branch.name
  SET: {baseBranch} = currentTask.branch.baseBranch OR "main"
ELSE:
  BASH: `git branch --show-current`
  SET: {branchName} = result
  SET: {baseBranch} = "main"

IF {branchName} == "main" OR {branchName} == "master":
  OUTPUT:
  ```
  ⚠️ Cannot ship from protected branch: {branchName}

  Create a feature branch first with /p:now "task name"
  ```
  STOP

#### 7.4 Commit Changes

**CRITICAL: Include BOTH prjct footer AND Claude Code Co-Author**

BASH: `git add .`

BASH: `git commit -m "$(cat <<'EOF'
feat: {feature}

{code review summary if any issues were found}

🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Claude](https://www.anthropic.com/claude)

EOF
)"`

**The commit MUST include:**
1. `🤖 Generated with [p/](https://www.prjct.app/)` - prjct signature (REQUIRED)
2. `Designed for [Claude](https://www.anthropic.com/claude)` - attribution
3. `Co-Authored-By: Claude <noreply@anthropic.com>` - Claude Code standard

#### 7.5 Push Branch
BASH: `git push -u origin {branchName}`
IF push fails:
  OUTPUT: "Push failed. Check your git credentials or try: git pull --rebase"
  STOP

#### 7.6 Create Pull Request
SET: {prTitle} = "feat: {feature}"
SET: {prBody} = """
## Summary
{feature description}

## Changes
- {totalLines} lines changed in {filesChanged} files
- Type: {changeType}

## Quality Checks
- Lint: {lintStatus}
- Tests: {testStatus}
- Review: {reviewStatus}

{IF issues found:}
### Review Notes
{list of issues found during code review}
{END IF}

---
🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Claude](https://www.anthropic.com/claude)
"""

IF `--draft`:
  SET: {draftFlag} = "--draft"
ELSE:
  SET: {draftFlag} = ""

BASH: `gh pr create --title "{prTitle}" --base {baseBranch} {draftFlag} --body "$(cat <<'EOF'
{prBody}
EOF
)"`

IF command fails:
  # PR might already exist
  BASH: `gh pr view --json url,number`
  IF exists:
    EXTRACT: {prUrl}, {prNumber}
    OUTPUT: "PR already exists: {prUrl}"
  ELSE:
    OUTPUT: "Failed to create PR. Check gh auth status."
    STOP
ELSE:
  EXTRACT: {prUrl} from output
  EXTRACT: {prNumber} from output

OUTPUT: "📎 PR created: {prUrl}"

#### 7.7 Wait for CI Checks
OUTPUT: "Waiting for CI checks..."

SET: {maxWaitTime} = 600  # 10 minutes
SET: {checkInterval} = 30  # 30 seconds
SET: {elapsed} = 0

LOOP:
  BASH: `gh pr checks {prNumber} --json name,state,conclusion 2>/dev/null || echo "[]"`
  PARSE: {ciChecks}

  IF {ciChecks} is empty OR all checks have conclusion:
    # All checks completed
    SET: {failedChecks} = checks where conclusion != "success" AND conclusion != "skipped"

    IF {failedChecks}.length > 0:
      SET: {ciStatus} = "failed"
      OUTPUT:
      ```
      ❌ CI checks failed:
      {FOR each failed check:}
      - {name}: {conclusion}
      {END FOR}

      Fix issues and push again. PR: {prUrl}
      ```
      → Continue to Step 8 (don't stop, just record the failure)
    ELSE:
      SET: {ciStatus} = "passed"
      OUTPUT: "✅ All CI checks passed"
    BREAK

  SET: {pendingCount} = checks where state == "pending" OR state == "queued"
  OUTPUT: "⏳ Waiting for {pendingCount} CI checks..."

  WAIT: {checkInterval} seconds
  SET: {elapsed} = {elapsed} + {checkInterval}

  IF {elapsed} >= {maxWaitTime}:
    SET: {ciStatus} = "timeout"
    OUTPUT: "⏰ CI still running after 10 minutes. Check PR: {prUrl}"
    BREAK

#### 7.8 Update State with PR Info
READ: `{globalPath}/storage/state.json`
IF currentTask:
  UPDATE currentTask.branch:
  ```json
  {
    "branch": {
      ...existing,
      "prUrl": "{prUrl}",
      "prNumber": {prNumber},
      "ciStatus": "{ciStatus}"
    }
  }
  ```
  WRITE: `{globalPath}/storage/state.json`

### Step 8: Update Storage and Workflow Checkpoints
GET timestamp: `bun -e "console.log(new Date().toISOString())" 2>/dev/null || node -e "console.log(new Date().toISOString())"`
GET uuid: `bun -e "console.log(crypto.randomUUID())" 2>/dev/null || node -e "console.log(require('crypto').randomUUID())"`

SET: {now} = timestamp
SET: {shippedId} = uuid

### 8.1 Update Workflow Checkpoints (if workflow exists)
READ: `{globalPath}/storage/state.json`

IF currentTask AND currentTask.workflow exists:
  SET: currentTask.workflow.phase = "register"

  ### Set tag checkpoint
  SET: currentTask.workflow.checkpoints.tag = {
    "completedAt": "{now}",
    "data": { "version": "{newVersion}", "tagName": "v{newVersion}" }
  }

  ### Set release checkpoint
  SET: currentTask.workflow.checkpoints.release = {
    "completedAt": "{now}",
    "data": { "prUrl": "{prUrl}", "prNumber": {prNumber} }
  }

  ### Set deploy checkpoint (manual reminder)
  SET: currentTask.workflow.checkpoints.deploy = {
    "completedAt": "{now}",
    "data": { "reminded": true, "manual": true }
  }

  ### Set register checkpoint
  SET: currentTask.workflow.checkpoints.register = {
    "completedAt": "{now}",
    "data": { "shippedId": "{shippedId}", "version": "{newVersion}" }
  }

  SET: currentTask.workflow.lastCheckpoint = "register"

  WRITE: `{globalPath}/storage/state.json`

  ### Log workflow events
  APPEND to `{globalPath}/memory/events.jsonl`:
  ```json
  {"timestamp":"{now}","action":"phase_advanced","taskId":"{currentTask.id}","from":"merge","to":"register"}
  {"timestamp":"{now}","action":"checkpoint_completed","taskId":"{currentTask.id}","checkpoint":"tag","data":{"version":"{newVersion}"}}
  {"timestamp":"{now}","action":"checkpoint_completed","taskId":"{currentTask.id}","checkpoint":"release"}
  {"timestamp":"{now}","action":"checkpoint_completed","taskId":"{currentTask.id}","checkpoint":"deploy"}
  {"timestamp":"{now}","action":"checkpoint_completed","taskId":"{currentTask.id}","checkpoint":"register"}
  ```

### 8.2 Update shipped.json
READ: `{globalPath}/storage/shipped.json` (or create default)
PREPEND new ship object:
```json
{
  "id": "{shippedId}",
  "name": "{feature}",
  "version": "{newVersion}",
  "shippedAt": "{now}",
  "lint": "{lintStatus}",
  "tests": "{testStatus}",
  "branch": "{branchName}",
  "prUrl": "{prUrl}",
  "prNumber": {prNumber},
  "ciStatus": "{ciStatus}",
  "taskId": "{currentTask.id}"
}
```
WRITE: `{globalPath}/storage/shipped.json`

### 8.3 Generate context
WRITE: `{globalPath}/context/shipped.md`

### 8.4 Queue sync event
APPEND to `{globalPath}/sync/pending.json`:
```json
{"type":"feature.shipped","data":{"taskId":"{currentTask.id}","version":"{newVersion}","prUrl":"{prUrl}"},"timestamp":"{now}"}
```

### 8.5 Deploy reminder
OUTPUT:
```
📦 Deploy Reminder

Version {newVersion} is ready to deploy.

Remember to deploy to your platform when ready.
```

### Step 9: Output

IF {ciStatus} == "passed":
```
🚀 Shipped: {feature}

Version: {oldVersion} → {newVersion}
Changes: {changeType} ({totalLines} lines in {filesChanged} files)
Quality: Lint {lintStatus} | Tests {testStatus}
CI: ✅ Passed

📎 PR: {prUrl}

Phase: register (10/11 checkpoints)

Workflow:
1. analyze ✓
2. branch ✓
3. implement ✓
4. test ✓
5. review ✓
6. merge ✓
7. tag ✓ - v{newVersion}
8. release ✓
9. deploy ✓ - (manual)
10. register ✓
11. verify ← next

Next: p. verify to complete workflow
```

IF {ciStatus} == "failed":
```
⚠️ PR Created (CI Failed): {feature}

Version: {oldVersion} → {newVersion}
Quality: Lint {lintStatus} | Tests {testStatus}
CI: ❌ Failed

📎 PR: {prUrl}

Fix CI issues and push again.
```

IF {ciStatus} == "timeout":
```
🚀 PR Created: {feature}

Version: {oldVersion} → {newVersion}
Quality: Lint {lintStatus} | Tests {testStatus}
CI: ⏳ Still running

📎 PR: {prUrl}

Check CI status on GitHub.
```

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No git repo | "Not a git repository" | STOP |
| No changes | "No changes to ship" | STOP |
| On protected branch | "Cannot ship from main/master" | STOP |
| gh CLI not installed | Show install instructions | STOP |
| gh not authenticated | "Run gh auth login" | STOP |
| Lint/test fails (blocking) | "Quality checks failed" | STOP |
| Lint/test fails (non-blocking) | Show warning | CONTINUE |
| Code review finds issues (blocking) | "Fix issues before shipping" | STOP |
| Code review finds issues (non-blocking) | Prompt to continue | ASK |
| Push fails | "Push failed. Try: git pull --rebase" | STOP |
| PR creation fails | Check if PR exists | CONTINUE |
| CI fails | Show failed checks, record in storage | CONTINUE |
| CI timeout | Show PR URL, continue | CONTINUE |

## Examples

### Example 1: Successful Ship with PR
```
/p:ship "add user auth"

Pre-flight: Medium changes (87 lines in 5 files)
Quality: Lint ✅ | Tests ✅
Review: Passed

📎 PR created: https://github.com/user/repo/pull/42
Waiting for CI checks...
⏳ Waiting for 3 CI checks...
✅ All CI checks passed

🚀 PR Ready: add user auth

Version: 1.2.0 → 1.3.0
Changes: medium (87 lines in 5 files)
Quality: Lint ✅ | Tests ✅
CI: ✅ Passed

📎 PR: https://github.com/user/repo/pull/42

Next steps:
1. Request review from team
2. Merge when approved
```

### Example 2: Ship with CI Failure
```
/p:ship "fix login bug"

Pre-flight: Small changes (28 lines in 2 files)
Quality: Lint ✅ | Tests ✅
Review: Passed

📎 PR created: https://github.com/user/repo/pull/43
Waiting for CI checks...

❌ CI checks failed:
- build: failure
- test: failure

⚠️ PR Created (CI Failed): fix login bug

📎 PR: https://github.com/user/repo/pull/43

Fix CI issues and push again.
```

### Example 3: Blocked on Protected Branch
```
/p:ship "new feature"

⚠️ Cannot ship from protected branch: main

Create a feature branch first with /p:now "task name"
```

### Example 4: Draft PR
```
/p:ship "work in progress" --draft

📎 PR created (draft): https://github.com/user/repo/pull/44

🚀 PR Created: work in progress
CI: ⏳ Still running

📎 PR: https://github.com/user/repo/pull/44
```

## References
- Architecture details: `~/.prjct-cli/docs/architecture.md`
- Validation patterns: `~/.prjct-cli/docs/validation.md`
