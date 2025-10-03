---
allowed-tools: [Read, Bash, Edit]
description: "Quick troubleshooting and fixes"
---

# /p:fix

## Usage
```
/p:fix              # Diagnose current issue
/p:fix [error]      # Fix specific error
```

## Flow
1. Read: `core/now.md` → get context
2. Parse: error message OR diagnose current state
3. Detect: common patterns (deps, config, syntax, tests)
4. Apply: automatic fix OR suggest solution
5. Verify: test fix works
6. Log: `memory/context.jsonl`

## Common Fixes
- **Dependencies**: `npm install` missing packages
- **Config**: Fix malformed JSON/YAML
- **Syntax**: ESLint/Prettier auto-fix
- **Tests**: Update snapshots, fix imports
- **Git**: Resolve merge conflicts

## Response (auto-fixed)
```
✅ Fixed: {error_type}

{fix_details}

Verify: {command_to_test}
```

## Response (manual)
```
🔍 Diagnosed: {issue}

Suggested fixes:
1. {fix_option_1}
2. {fix_option_2}

/p:done after fixing
```

