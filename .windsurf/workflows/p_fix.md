---
title: prjct fix
invocable_name: p:fix
description: Quick troubleshooting and automatic fixes using global prjct architecture
---

# Steps

1. Read project config from `.prjct/prjct.config.json`
2. Extract `projectId` and `author` from config
3. Parse issue description from arguments
4. Analyze problem type:
   - Build/compilation errors
   - Test failures
   - Runtime errors
   - Configuration issues
   - Dependency problems
5. Read project context from `~/.prjct-cli/projects/{projectId}/analysis/repo-summary.md`
6. Read recent activity from `~/.prjct-cli/projects/{projectId}/memory/context.jsonl`
7. Identify potential causes and solutions
8. Apply automatic fixes where possible
9. Provide manual fix instructions for complex issues
10. Log fix attempt to memory
11. Display results and next steps

# Response Format

```
🔧 Quick Fix: {issue-description}

🔍 Diagnosis:
Problem Type: {error-type}
Location: {file-or-component}
Severity: {High/Medium/Low}

{if-automatic-fix-available}
✅ Auto-Fix Applied:

Changes Made:
- {change-1}
- {change-2}
- {change-3}

Verification:
{run-verification-command}

Status: {Success/Partial/Failed}
{endif}

{if-manual-fix-needed}
🛠️  Manual Fix Required:

Steps to Fix:
1. {step-1}
2. {step-2}
3. {step-3}

Why This Fix:
{explanation-of-the-fix}

Verification:
{verification-commands}
{endif}

📚 Related Resources:
- {documentation-link}
- {stack-overflow-link}
- {similar-issue-in-memory}

💡 Prevention:
{how-to-avoid-this-issue-in-future}

{if-fixed}
✅ Issue Resolved!
Ready to continue? Use /p:now
{endif}

{if-not-fixed}
🤔 Still having issues?
- Get more help: /p:stuck "{detailed-description}"
- Save for later: /p:idea "Investigate {issue}"
{endif}
```

# Common Fixes

## Build Errors

**Missing Dependencies**:
```
Auto-Fix: npm install / yarn install
Verification: npm run build
```

**Type Errors**:
```
Analysis: Check type definitions
Manual Fix: Add type imports or fix type mismatches
```

**Import Errors**:
```
Auto-Fix: Update import paths
Verification: Check compilation
```

## Test Failures

**Outdated Snapshots**:
```
Auto-Fix: npm test -- -u
Verification: Run tests again
```

**Missing Mocks**:
```
Manual Fix: Add mock definitions
Guide: Provide mock template
```

**Async Issues**:
```
Analysis: Identify async/await problems
Manual Fix: Add proper async handling
```

## Runtime Errors

**Environment Variables**:
```
Auto-Check: .env file exists
Manual Fix: Add missing variables
Template: Provide .env.example
```

**API Errors**:
```
Analysis: Check endpoint and auth
Debug Steps: Test with curl/Postman
Fix: Update API configuration
```

## Configuration Issues

**Linter Errors**:
```
Auto-Fix: npm run lint -- --fix
Verification: Check linter output
```

**Formatting**:
```
Auto-Fix: npm run format
Apply: Prettier/ESLint auto-fix
```

## Dependency Problems

**Version Conflicts**:
```
Analysis: Check package.json
Resolution: Update peer dependencies
Command: npm install --legacy-peer-deps
```

**Lock File Issues**:
```
Auto-Fix: Remove lock file, reinstall
Fresh Install: npm ci
```

# Fix Strategies

1. **Identify Root Cause**: Don't just fix symptoms
2. **Try Safe Fixes First**: Non-destructive approaches
3. **Verify Each Fix**: Test before moving on
4. **Document Solution**: Log to memory for future reference
5. **Prevent Recurrence**: Suggest preventive measures

# Safety Protocols

- **Backup First**: Suggest git commit before major fixes
- **Incremental**: Apply one fix at a time
- **Reversible**: Provide rollback instructions
- **Tested**: Verify each fix works

# Integration with Workflow

- If fix takes >15min, suggest `/p:task "Fix {issue}"`
- Log successful fixes for pattern recognition
- Update project analysis if configuration changes
- Suggest `/p:stuck` if automatic fix fails

# Global Architecture Notes

- **Project Analysis**: `~/.prjct-cli/projects/{id}/analysis/repo-summary.md`
- **Recent History**: `~/.prjct-cli/projects/{id}/memory/context.jsonl`
- **Config Source**: `{project}/.prjct/prjct.config.json`
- **Memory Logging**: Record all fix attempts and outcomes
- **Pattern Learning**: Build knowledge base of common fixes
- **Use Case**: Rapid problem resolution, reducing debugging time
