---
allowed-tools: [Read, Bash, Edit]
description: 'Troubleshooting, guidance, and fixes'
---

# /p:fix

## Usage

```
/p:fix              # Diagnose current issue or get unstuck
/p:fix [error]      # Fix specific error
/p:stuck [issue]    # Alias for fix (guidance mode)
```

## Flow

1. Read: `core/now.md` + `analysis/` → get context
2. Parse: error message OR issue description
3. Detect: issue type (error/bug/design/perf/feature/blocked)
4. Apply: automatic fix OR provide guidance
5. Verify: test fix works (if auto-fix)
6. Log: `memory/context.jsonl`

## Auto-Fix (Technical Errors)

- **Dependencies**: `npm install` missing packages
- **Config**: Fix malformed JSON/YAML
- **Syntax**: ESLint/Prettier auto-fix
- **Tests**: Update snapshots, fix imports
- **Git**: Resolve merge conflicts

## Guidance (When Stuck)

- **Bug**: 🔍 Check logs → Isolate → Search error → Test fix
- **Design**: 🎨 Define requirements → Start simple → Ship MVP → Iterate
- **Performance**: ⚡ Profile first → Fix slowest → Cache ops → Measure
- **Blocked**: 💡 Break into tasks → Start smallest → Ship incrementally
- **Default**: Break down → Prioritize → Start → Ship

## Response (auto-fixed)

```
✅ Fixed: {error_type}

{fix_details}

Verify: {command_to_test}

/p:test | /p:done
```

## Response (guidance)

```
💡 {type_guidance}

Let's break it down:
1. {subtask} (~{time})
2. {subtask} (~{time})
3. {subtask} (~{time})

Start with: /p:now "{first_subtask}"

/p:now | /p:task
```

## Response (manual diagnosis)

```
🔍 Diagnosed: {issue}

Suggested fixes:
1. {fix_option_1}
2. {fix_option_2}
3. {fix_option_3}

/p:done after fixing
```
