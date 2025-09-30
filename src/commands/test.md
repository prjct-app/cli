---
allowed-tools: [Bash, Read, Edit, Glob]
description: 'Run tests and auto-fix simple failures'
---

# /p:test - Smart Test Execution

## Purpose

Run tests, show failures clearly, and auto-fix obvious issues. Ship with confidence.

## Usage

```
/p:test [all|unit|e2e|failed]
```

Default: all

## Execution

Execute the command silently and show only the final result:

```bash
prjct test
```

The command handles all file operations internally. Show only the final message.
## Implementation

**Test detection**:

```bash
# Auto-detect test command from package.json or config
- npm test / npm run test
- pytest / python -m pytest
- go test ./...
- cargo test
```

**Auto-fixable issues**:

- Snapshot updates → Update automatically
- Timeout errors → Increase timeout
- Import errors → Fix imports
- Expected vs received → Show diff clearly

**Response format for success**:

```
✅ All tests passing!

📊 Test Results:
• Unit: 45/45 passed
• Integration: 12/12 passed
• E2E: 8/8 passed

🎯 Coverage: 87% (+2%)
⚡ Time: 4.2s

🚀 Ready to ship!
```

**Response format for failures**:

```
❌ 3 tests failing

1️⃣ UserService.test.js:
   Expected: "John Doe"
   Received: "John"

   💡 Auto-fix available: /p:test fix

2️⃣ auth.e2e.js:
   Timeout after 5000ms

   💡 Increasing timeout to 10000ms...

📊 Summary: 62/65 passed (95%)
```

**Quick commands**:

- `/p:test` - Run all tests
- `/p:test failed` - Re-run only failed tests
- `/p:test watch` - Run in watch mode
- `/p:test fix` - Apply available auto-fixes

## Features

- Smart failure detection
- Clear error messages
- Auto-fix common issues
- Coverage tracking
- Performance monitoring
