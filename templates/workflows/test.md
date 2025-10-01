---
title: prjct test
invocable_name: p:test
description: Execute tests with reporting and coverage tracking using global prjct architecture
---

# Steps

1. Read project config from `.prjct/prjct.config.json`
2. Extract `projectId` and `author` from config
3. Parse test type and arguments (unit, integration, e2e, all)
4. Detect test framework from project analysis
5. Execute appropriate test suite
6. Collect test results:
   - Pass/fail counts
   - Coverage metrics
   - Failed test details
   - Performance metrics
7. Update test metrics in `~/.prjct-cli/projects/{projectId}/progress/metrics.md`
8. Log test execution to memory
9. Display formatted results
10. Provide actionable suggestions

# Response Format

```
🧪 Test Execution: {test-type}

Framework: {jest/vitest/pytest/etc}
Environment: {node-version/python-version}

📊 Results:
✅ Passed: X tests
❌ Failed: Y tests
⏭️  Skipped: Z tests
⏱️  Duration: A.Bs

📈 Coverage:
- Statements: {X}%
- Branches: {Y}%
- Functions: {Z}%
- Lines: {A}%

{if-coverage-change}
Coverage Change: {+/-}% from last run
{endif}

{if-failures}
❌ Failed Tests:

1. {test-name}
   File: {file-path}:{line}
   Error: {error-message}

2. {test-name}
   File: {file-path}:{line}
   Error: {error-message}

🔧 Quick Fixes:
- Review failing test: {file-path}
- Check recent changes: git diff
- Debug: npm test -- --watch
- Get help: /p:stuck "Test failing: {test-name}"
{endif}

{if-all-passed}
✅ All Tests Passed!

🎉 Great work! Test suite is green.

{if-coverage-improved}
📈 Coverage improved by {X}%!
{endif}

Next Steps:
- Ship this: /p:ship "{feature-name}"
- Mark done: /p:done
- Continue work: /p:now
{endif}

💡 Suggestions:
{coverage-suggestions}
{performance-suggestions}
```

# Test Types

## unit (default)
```
npm test
# or
pytest tests/unit
# or
go test ./...
```

## integration
```
npm test -- tests/integration
# or
pytest tests/integration
```

## e2e
```
npm run test:e2e
# or
playwright test
# or
cypress run
```

## all
```
npm run test:all
# or run all test suites sequentially
```

## watch
```
npm test -- --watch
# Interactive test watcher
```

## coverage
```
npm test -- --coverage
# Detailed coverage report
```

# Framework Detection

Auto-detect test framework:
- **JavaScript/TypeScript**: Jest, Vitest, Mocha, Jasmine
- **Python**: Pytest, Unittest, Nose
- **Go**: Go test
- **Rust**: Cargo test
- **Ruby**: RSpec, Minitest

Auto-detect commands from:
- package.json scripts
- Makefile
- Test configuration files

# Coverage Analysis

**Good Coverage**:
- Statements: >80%
- Branches: >75%
- Functions: >80%
- Lines: >80%

**Suggestions Based on Coverage**:
- <50%: "Critical: Add basic tests for core functionality"
- 50-70%: "Add tests for edge cases and error paths"
- 70-85%: "Good coverage! Focus on complex branches"
- >85%: "Excellent! Maintain this level"

# Performance Metrics

Track:
- Total test duration
- Slowest tests (top 5)
- Flaky tests (inconsistent results)
- Test suite trends over time

Suggestions:
- Tests >5s: "Consider splitting or optimizing"
- Flaky tests: "Investigate timing or async issues"
- Growing duration: "Review test efficiency"

# Test Failure Analysis

For each failure:
1. **Extract Error**: Parse error message and stack trace
2. **Locate Code**: Find relevant source code
3. **Check Recent Changes**: Review related commits
4. **Suggest Fix**: Provide debugging guidance

Common Failure Types:
- **Assertion Failed**: Expected vs. actual mismatch
- **Timeout**: Async operation took too long
- **Exception**: Unhandled error in test
- **Setup Failed**: Test environment issue

# Continuous Integration

If in CI environment:
- Adjust output format for CI
- Generate CI-specific reports
- Set appropriate exit codes
- Provide machine-readable output

# Integration with Workflow

## Before Ship
```
/p:test all
# Ensure all tests pass before shipping
```

## During Development
```
/p:test watch
# Run tests continuously during development
```

## After Refactoring
```
/p:test coverage
# Ensure coverage didn't drop
```

## Debug Failures
```
/p:test unit
# Failed? Use /p:stuck "Test failing: {name}"
```

# Metrics Tracking

Update `~/.prjct-cli/projects/{id}/progress/metrics.md`:
```markdown
## Test Metrics

Last Run: {timestamp}
- Pass Rate: {X}%
- Coverage: {Y}%
- Duration: {Z}s

Historical:
- {date}: {pass-rate}% pass, {coverage}% coverage
- {date}: {pass-rate}% pass, {coverage}% coverage
```

# Global Architecture Notes

- **Metrics Location**: `~/.prjct-cli/projects/{id}/progress/metrics.md`
- **Memory Logging**: `~/.prjct-cli/projects/{id}/memory/context.jsonl`
- **Config Source**: `{project}/.prjct/prjct.config.json`
- **Integration**: Part of quality gates before shipping
- **Trend Analysis**: Track test health over time
- **Use Case**: Quality assurance, regression prevention, coverage tracking
