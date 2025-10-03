---
allowed-tools: [Bash, Read, Edit]
description: "Run tests with auto-fix"
---

# /p:test

## Usage
```
/p:test [all|unit|e2e|failed|fix]  # Default: all
```

## Flow
1. Detect: test runner (jest/vitest/pytest/etc)
2. Run: tests with appropriate command
3. Parse: results
4. Auto-fix: simple failures (snapshots, timeouts, imports)
5. Update: coverage in `progress/metrics.md`

## Response (success)
```
✅ All tests passing!

📊 Results:
• Unit: {N}/{N}
• Integration: {N}/{N}
• E2E: {N}/{N}

🎯 Coverage: {X}%
⚡ Time: {X}s

/p:ship
```

## Response (failures)
```
❌ {N} tests failing

{failure_details}

💡 Auto-fix: /p:test fix

📊 Summary: {passed}/{total} ({X}%)
```

