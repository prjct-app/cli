---
allowed-tools: [Read, Glob, Grep]
description: 'Analyze code patterns and conventions'
---

# Code Pattern Analysis

## Detection Steps

1. **Structure** (5-10 files): File org, exports, modules
2. **Patterns**: SOLID, DRY, factory/singleton/observer
3. **Conventions**: Naming, style, error handling, async
4. **Anti-patterns**: God class, spaghetti, copy-paste, magic numbers
5. **Performance**: Memoization, N+1 queries, leaks

## Output: analysis/patterns.md

```markdown
# Code Patterns - {Project}

> Generated: {GetTimestamp()}

## Patterns Detected
- **{Pattern}**: {Where} - {Example}

## SOLID Compliance
| Principle | Status | Evidence |
|-----------|--------|----------|
| Single Responsibility | ✅/⚠️/❌ | {evidence} |
| Open/Closed | ✅/⚠️/❌ | {evidence} |
| Liskov Substitution | ✅/⚠️/❌ | {evidence} |
| Interface Segregation | ✅/⚠️/❌ | {evidence} |
| Dependency Inversion | ✅/⚠️/❌ | {evidence} |

## Conventions (MUST FOLLOW)
- Functions: {camelCase/snake_case}
- Classes: {PascalCase}
- Files: {kebab-case/camelCase}
- Quotes: {single/double}
- Async: {async-await/promises}

## Anti-Patterns ⚠️

### High Priority
1. **{Issue}**: {file:line} - Fix: {action}

### Medium Priority
1. **{Issue}**: {file:line} - Fix: {action}

## Recommendations
1. {Immediate action}
2. {Best practice}
```

## Rules

1. Check patterns.md FIRST before writing code
2. Match conventions exactly
3. NEVER introduce anti-patterns
4. Warn if asked to violate patterns
