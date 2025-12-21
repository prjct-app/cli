---
allowed-tools: [Bash, Read, Write, Edit]
description: 'Run tests with auto-fix and AI generation'
timestamp-rule: 'GetTimestamp() for ALL timestamps'
---

# /p:test

## Usage

```
/p:test [all|unit|e2e|failed|fix|ai]
        [--blocking]           # Exit with error if tests fail
        [--testsprite]         # Force TestSprite even if native runner exists
        [--scope=codebase|diff] # TestSprite: test all or only changed files
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
- {useTestSprite} = false
- {testScope} = "diff"

PARSE args:
- IF arg is "ai": {useTestSprite} = true
- IF arg is "all|unit|e2e|failed|fix": {testMode} = arg
- IF arg contains "--blocking": {blocking} = true
- IF arg contains "--testsprite": {useTestSprite} = true
- IF arg contains "--scope=codebase": {testScope} = "codebase"

## Step 3: Check TestSprite API Key (If Needed)

IF {useTestSprite}:
  READ: `{configPath}`

  ### Check if user dismissed TestSprite
  IF config.testspriteSkip == "never":
    OUTPUT: "ℹ️ TestSprite disabled. Using native tests."
    {useTestSprite} = false
    → Go to Step 4

  IF config.testspriteSkip == "later" AND config.testspriteSkipUntil > now:
    OUTPUT: "ℹ️ TestSprite reminder snoozed. Using native tests."
    {useTestSprite} = false
    → Go to Step 4

  ### Check for existing API key
  IF config.testspriteApiKey exists AND is not empty:
    SET: {apiKey} = config.testspriteApiKey
    → Continue to Step 4

  ### No API key - show options (NON-BLOCKING)
  OUTPUT: "🤖 TestSprite AI Testing (Optional)"
  OUTPUT: ""
  OUTPUT: "TestSprite can generate and run AI-powered tests."
  OUTPUT: "Free API key at: https://testsprite.com/dashboard/api-keys"
  OUTPUT: ""

  ASK with options:
    1. "Enter API key" → Prompt for key
    2. "Skip for now" → Use native tests this time
    3. "Remind me in a week" → Snooze reminder
    4. "Never ask again" → Disable permanently

  HANDLE response:

  IF option 1 (Enter API key):
    ASK: "Paste your TestSprite API key:"
    SET: {apiKey} = user input

    UPDATE config.json:
    - testspriteApiKey: {apiKey}

    OUTPUT: "✅ API key saved"
    → Continue to Step 4

  IF option 2 (Skip for now):
    OUTPUT: "⏭️ Skipping TestSprite. Using native tests."
    {useTestSprite} = false
    → Go to Step 4

  IF option 3 (Remind me in a week):
    SET: {skipUntil} = now + 7 days

    UPDATE config.json:
    - testspriteSkip: "later"
    - testspriteSkipUntil: {skipUntil}

    OUTPUT: "⏰ Will ask again in a week. Using native tests."
    {useTestSprite} = false
    → Go to Step 4

  IF option 4 (Never ask again):
    UPDATE config.json:
    - testspriteSkip: "never"

    OUTPUT: "🔕 Won't ask again. Use --testsprite flag to enable manually."
    {useTestSprite} = false
    → Go to Step 4

## Step 4: Detect Testing Strategy

IF {useTestSprite}:
  → Go to Step 6 (TestSprite AI Testing)

### Check for Native Test Runner

READ: `package.json`
IF has "scripts.test":
  {runner} = "npm"
  {runnerCmd} = "npm test"
  → Go to Step 5 (Native Testing)

IF file exists: `pytest.ini` OR `pyproject.toml` with pytest:
  {runner} = "pytest"
  {runnerCmd} = "pytest"
  → Go to Step 5

IF file exists: `Cargo.toml`:
  {runner} = "cargo"
  {runnerCmd} = "cargo test"
  → Go to Step 5

IF no runner found:
  OUTPUT: "No test runner detected."
  OUTPUT: ""
  OUTPUT: "Options:"
  OUTPUT: "• /p:test ai - Generate tests with AI (TestSprite)"
  OUTPUT: "• Add 'test' script to package.json"
  STOP

## Step 5: Native Test Runner

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

→ Go to Step 8 (Results)

## Step 6: TestSprite AI Testing

OUTPUT: "🤖 Running AI-powered tests with TestSprite..."

### 6.1 Bootstrap Tests

CALL MCP TOOL: `testsprite_bootstrap_tests`
PARAMETERS:
- projectPath: current working directory (absolute path)
- type: auto-detect based on project (frontend/backend)
- testScope: {testScope}

CAPTURE: bootstrap result

### 6.2 Generate and Execute Tests

CALL MCP TOOL: `testsprite_generate_code_and_execute`
PARAMETERS:
- projectName: from package.json "name" or directory name
- projectPath: current working directory (absolute path)
- testIds: [] (run all)

CAPTURE: execution result

### 6.3 Parse TestSprite Results

READ: `testsprite_tests/test_results.json`

EXTRACT:
- {passed}: count of passed tests
- {failed}: count of failed tests
- {coverage}: coverage percentage if available

IF {failed} == 0:
  {testStatus} = "passed"
ELSE:
  {testStatus} = "failed"

### Handle Fix Mode with TestSprite
IF {testMode} == "fix" AND {testStatus} == "failed":
  OUTPUT: "🔧 Running auto-healing..."

  CALL MCP TOOL: `testsprite_rerun_tests`
  PARAMETERS:
    - projectPath: current working directory

  READ: `testsprite_tests/test_results.json` (updated)
  Re-parse results

→ Go to Step 8 (Results)

## Step 7: (Reserved for future expansion)

## Step 8: Results & Response

### Log to Memory

SET: {now} = GetTimestamp()

APPEND to `{memoryPath}`:
```json
{"ts":"{now}","type":"test_run","tool":"{runner|testsprite}","passed":{passed},"failed":{failed},"mode":"{testMode}"}
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
  IF {useTestSprite}:
    OUTPUT: "📋 Report: testsprite_tests/TestSprite_MCP_Test_Report.html"
  ELSE:
    OUTPUT: "{testOutput}"  # Show relevant failure output
  OUTPUT: ""
  OUTPUT: "💡 Auto-fix: /p:test fix"
  OUTPUT: ""
  OUTPUT: "📊 Summary: {passed}/{passed + failed} passed"

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| No project | "No prjct project" | STOP |
| No test runner | "No test runner detected" | Suggest /p:test ai |
| TestSprite API key missing | Show options | Fallback to native (non-blocking) |
| TestSprite dismissed | Skip silently | Use native tests |
| Tests timeout | "Tests timed out" | Suggest increasing timeout |
| MCP tool not available | "TestSprite not configured" | Fallback to native tests |

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

### Example 2: AI Tests with Failures
```
🤖 Running AI-powered tests with TestSprite...

❌ 3 tests failing

📋 Report: testsprite_tests/TestSprite_MCP_Test_Report.html

💡 Auto-fix: /p:test fix

📊 Summary: 39/42 passed
```

### Example 3: Blocking Mode
```
🧪 Running tests with npm...

❌ 2 tests failed. Blocking.

Fix failing tests or run without --blocking flag.
```

### Example 4: First Time TestSprite (No API Key)
```
🤖 TestSprite AI Testing (Optional)

TestSprite can generate and run AI-powered tests.
Free API key at: https://testsprite.com/dashboard/api-keys

Options:
1. Enter API key
2. Skip for now
3. Remind me in a week
4. Never ask again

> 2

⏭️ Skipping TestSprite. Using native tests.

🧪 Running tests with npm...
...
```

### Example 5: TestSprite Snoozed
```
ℹ️ TestSprite reminder snoozed. Using native tests.

🧪 Running tests with npm...
...
```
