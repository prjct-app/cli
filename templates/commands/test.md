---
allowed-tools: [Bash, Read, Write, Edit]
description: 'Run tests and advance workflow phase'
timestamp-rule: 'GetTimestamp() for ALL timestamps'
architecture: 'Write-Through (JSON -> MD -> Events)'
storage-layer: true
source-of-truth: 'storage/state.json'
---

# /p:test

Run tests to advance from implement phase to test phase in the workflow.

## Usage

```
/p:test [all|unit|e2e|failed|fix]
        [--blocking]           # Exit with error if tests fail
```

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{configPath}`: `~/.prjct-cli/config.json`
- `{statePath}`: `{globalPath}/storage/state.json`
- `{memoryPath}`: `{globalPath}/memory/events.jsonl`
- `{syncPath}`: `{globalPath}/sync/pending.json`

## Step 1: Read Project Config

READ: `.prjct/prjct.config.json`
EXTRACT: `projectId`

IF file not found:
  OUTPUT: "No prjct project. Run /p:init first."
  STOP

## Step 1.5: Validate Workflow Phase

READ: `{globalPath}/storage/state.json`

IF currentTask is null:
  OUTPUT: "No active task. Use p. task to start one."
  STOP

IF currentTask.workflow exists:
  IF currentTask.workflow.phase != "implement":
    OUTPUT:
    ```
    Cannot run tests. Current phase: {currentTask.workflow.phase}

    Required phase: implement

    Workflow: analyze → branch → implement → test → review → merge → ship → verify
    ```
    STOP

## Step 2: Parse Arguments

SET defaults:
- {testMode} = "all"
- {blocking} = false

PARSE args:
- IF arg is "all|unit|e2e|failed|fix": {testMode} = arg
- IF arg contains "--blocking": {blocking} = true

## Step 3: Detect Testing Strategy

### Check for Native Test Runner

READ: `package.json`
IF has "scripts.test":
  Detect package manager (package.json "packageManager" or lockfiles):
  - pnpm-lock.yaml → pnpm
  - yarn.lock → yarn
  - bun.lock/bun.lockb → bun
  - else → npm

  {runner} = "{packageManager}"
  {runnerCmd} = "{packageManager} test"
  → Go to Step 4 (Native Testing)

IF file exists: `pytest.ini` OR `pyproject.toml` with pytest:
  {runner} = "pytest"
  {runnerCmd} = "pytest"
  → Go to Step 4

IF file exists: `Cargo.toml`:
  {runner} = "cargo"
  {runnerCmd} = "cargo test"
  → Go to Step 4

IF file exists: `go.mod`:
  {runner} = "go"
  {runnerCmd} = "go test ./..."
  → Go to Step 4

IF file exists: `*.sln` OR `*.csproj`:
  {runner} = "dotnet"
  {runnerCmd} = "dotnet test"
  → Go to Step 4

IF no runner found:
  OUTPUT: "No test runner detected."
  OUTPUT: ""
  OUTPUT: "Options:"
  OUTPUT: "• Add 'test' script to package.json"
  OUTPUT: "• Add pytest.ini for Python projects"
  OUTPUT: "• Add Cargo.toml for Rust projects"
  OUTPUT: "• Add go.mod for Go projects"
  OUTPUT: "• Add a .sln/.csproj for .NET projects"
  STOP

## Step 4: Native Test Runner

OUTPUT: "🧪 Running tests with {runner}..."

BASH: `{runnerCmd} 2>&1`
CAPTURE output as {testOutput}

### Parse Results

IF {testOutput} contains "passed" AND NOT contains "failed":
  {testStatus} = "passed"
  {passed} = extract number of passed tests
  {failed} = 0
ELSE IF {testOutput} contains "failed" OR contains "FAIL":
  {testStatus} = "failed"
  {passed} = extract passed count
  {failed} = extract failed count
ELSE:
  {testStatus} = "unknown"

### Handle Fix Mode
IF {testMode} == "fix" AND {testStatus} == "failed":
  OUTPUT: "🔧 Attempting auto-fix..."

  IF {runner} == "npm" OR {runner} == "pnpm" OR {runner} == "yarn" OR {runner} == "bun":
    # Reason: only JS test runners commonly support snapshot update flags.
    BASH: `{runnerCmd} -- -u 2>&1`  # Update snapshots (best effort)

  OUTPUT: "Snapshots updated. Re-running tests..."
  BASH: `{runnerCmd} 2>&1`
  CAPTURE and re-parse results

→ Go to Step 5 (Results)

## Step 5: Results & Response

### Log to Memory

SET: {now} = GetTimestamp()

APPEND to `{memoryPath}`:
```json
{"ts":"{now}","type":"test_run","tool":"{runner}","passed":{passed},"failed":{failed},"mode":"{testMode}"}
```

### Check Blocking Mode

IF {blocking} AND {failed} > 0:
  OUTPUT: "❌ {failed} tests failed. Blocking."
  OUTPUT: ""
  OUTPUT: "Fix failing tests or run without --blocking flag."
  EXIT with error (non-zero)

### Success Response

IF {testStatus} == "passed":
  ### Update Workflow Phase (if workflow exists)
  IF currentTask.workflow exists:
    SET: {now} = GetTimestamp()

    SET: currentTask.workflow.phase = "test"
    SET: currentTask.workflow.checkpoints.implement = {
      "completedAt": "{now}",
      "data": { "filesChanged": {count}, "commits": {count} }
    }
    SET: currentTask.workflow.checkpoints.test = {
      "completedAt": "{now}",
      "data": { "passed": {passed}, "coverage": "{coverage}" }
    }
    SET: currentTask.workflow.lastCheckpoint = "test"

    WRITE: `{statePath}`

    ### Log workflow events
    APPEND to `{memoryPath}`:
    ```json
    {"timestamp":"{now}","action":"phase_advanced","taskId":"{currentTask.id}","from":"implement","to":"test"}
    {"timestamp":"{now}","action":"checkpoint_completed","taskId":"{currentTask.id}","checkpoint":"implement"}
    {"timestamp":"{now}","action":"checkpoint_completed","taskId":"{currentTask.id}","checkpoint":"test"}
    ```

    ### Queue sync event
    APPEND to `{syncPath}`:
    ```json
    {"type":"workflow.phase_advanced","data":{"taskId":"{currentTask.id}","from":"implement","to":"test"},"timestamp":"{now}"}
    ```

  OUTPUT: "✅ All tests passing!"
  OUTPUT: ""
  OUTPUT: "📊 Results:"
  OUTPUT: "• Passed: {passed}"
  IF {coverage}:
    OUTPUT: "• Coverage: {coverage}%"

  IF currentTask.workflow exists:
    OUTPUT: ""
    OUTPUT: "Phase: test (4/11 checkpoints)"
    OUTPUT: ""
    OUTPUT: "Workflow:"
    OUTPUT: "1. analyze ✓"
    OUTPUT: "2. branch ✓"
    OUTPUT: "3. implement ✓"
    OUTPUT: "4. test ✓"
    OUTPUT: "5. review ← next"
    OUTPUT: ""
    OUTPUT: "🎯 Next: p. review"
  ELSE:
    OUTPUT: ""
    OUTPUT: "🎯 Next: /p:ship"

### Failure Response

IF {testStatus} == "failed":
  OUTPUT: "❌ {failed} tests failing"
  OUTPUT: ""
  OUTPUT: "{testOutput}"  # Show relevant failure output
  OUTPUT: ""
  OUTPUT: "💡 Auto-fix: /p:test fix"
  OUTPUT: ""
  OUTPUT: "📊 Summary: {passed}/{passed + failed} passed"

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No project | "No prjct project" | STOP |
| No test runner | "No test runner detected" | Show setup options |
| Tests timeout | "Tests timed out" | Suggest increasing timeout |

## Examples

### Example 1: Native Tests Pass
```
🧪 Running tests with npm...

✅ All tests passing!

📊 Results:
• Passed: 42
• Coverage: 87%

🎯 Next: /p:ship
```

### Example 2: Tests with Failures
```
🧪 Running tests with npm...

❌ 3 tests failing

[test output here]

💡 Auto-fix: /p:test fix

📊 Summary: 39/42 passed
```

### Example 3: Blocking Mode
```
🧪 Running tests with npm...

❌ 2 tests failed. Blocking.

Fix failing tests or run without --blocking flag.
```
