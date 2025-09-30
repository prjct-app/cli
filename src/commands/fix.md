---
allowed-tools: [Read, Grep, Bash, Edit]
description: 'Quick troubleshooting and automatic fixes'
---

# /p:fix - Quick Fix & Troubleshooting

## Purpose

Instantly diagnose and fix common issues. Get unstuck in seconds, not minutes.

## Usage

```
/p:fix [error message or description]
```

## Execution

Execute the command silently and show only the final result:

```bash
prjct fix "<issue>"
```

The command handles all file operations internally. Show only the final message.
## Common Fixes

**Auto-fixable**:

- Missing semicolons, brackets, quotes
- Import statements for undefined variables
- Package.json dependencies
- Simple type errors
- Linting issues

**Guided fixes**:

- Null/undefined errors → Add null checks
- Module not found → Install package or fix path
- Build failures → Check configs and deps
- Test failures → Show diff and fix approach

## Implementation

**Error detection**:

```bash
# Check for common issues
- npm run lint 2>&1
- npm run typecheck 2>&1
- Check recent git changes
- Analyze error stack trace
```

**Response format for auto-fix**:

```
🔧 Fixed automatically!

Problem: Missing import for useState
Solution: Added import from 'react'
File: components/UserForm.tsx:1

✅ Error resolved - continue working!
```

**Response format for guided fix**:

```
🔍 Issue identified: Cannot read property 'id' of undefined

📍 Location: services/auth.js:45
🐛 Cause: user might be null

💡 Quick fix:
if (!user?.id) {
  return null;
}

Apply with: /p:fix apply
```

## Smart Features

- Learns from previous fixes
- Suggests preventive measures
- Links to relevant documentation
- Tracks fix patterns in memory
