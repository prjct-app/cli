---
allowed-tools: [Bash, Read, Write, Edit]
description: 'Run tests with auto-fix'
timestamp-rule: 'GetTimestamp() for ALL timestamps'
---

# /p:test

## Usage

```
/p:test [all|unit|e2e|failed|fix]
        [--blocking]           # Exit with error if tests fail
```

## Context Variables
- `{projectId}`: From `.prjct/prjct.config.json`
- `{globalPath}`: `~/.prjct-cli/projects/{projectId}`
- `{configPath}`: `~/.prjct-cli/config.json`
- `{memoryPath}`: `{globalPath}/memory/events.jsonl`

## Step 1: Read Project Config

READ: `.prjct/prjct.config.json`
EXTRACT: `projectId`

IF file not found:
  OUTPUT: "No prjct project. Run /p:init first."
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
  {runner} = "npm"
  {runnerCmd} = "npm test"
  → Go to Step 4 (Native Testing)

IF file exists: `pytest.ini` OR `pyproject.toml` with pytest:
  {runner} = "pytest"
  {runnerCmd} = "pytest"
  → Go to Step 4

IF file exists: `Cargo.toml`:
  {runner} = "cargo"
  {runnerCmd} = "cargo test"
  → Go to Step 4

IF no runner found:
  OUTPUT: "No test runner detected."
  OUTPUT: ""
  OUTPUT: "Options:"
  OUTPUT: "• Add 'test' script to package.json"
  OUTPUT: "• Add pytest.ini for Python projects"
  OUTPUT: "• Add Cargo.toml for Rust projects"
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

  IF {runner} == "npm":
    BASH: `npm test -- -u 2>&1`  # Update snapshots

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
  OUTPUT: "✅ All tests passing!"
  OUTPUT: ""
  OUTPUT: "📊 Results:"
  OUTPUT: "• Passed: {passed}"
  IF {coverage}:
    OUTPUT: "• Coverage: {coverage}%"
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
