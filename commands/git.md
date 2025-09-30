---
allowed-tools: [Bash, Read, Grep, Glob]
description: 'Smart git operations with auto-generated commit messages'
---

# /p:git - Smart Git Operations

## Purpose

Execute git operations with intelligent commit messages and automatic best practices. No thinking required.

## Usage

```
/p:git [commit|push|status|sync]
```

Default: commit

## Execution

Execute the command silently and show only the final result:

```bash
prjct git <operation>
```

The command handles all file operations internally. Show only the final message.
## Implementation

**Smart commit message generation**:

- Analyze file changes to determine type (feat/fix/docs/refactor)
- Extract meaningful description from changes
- Add emoji for visual clarity
- Include file scope when relevant

**Example messages**:

- "✨ feat: Add user authentication system"
- "🐛 fix: Resolve null pointer in auth middleware"
- "📝 docs: Update API documentation"
- "♻️ refactor: Simplify database connection logic"

**Response format**:

```
✅ Changes committed!

📝 Message: feat: Add user authentication
📊 Files: 3 changed, +150 lines
🔄 Branch: main

💡 Next: /p:git push to deploy
```

## Best Practices

- Always pulls before pushing
- Auto-stages all changes
- Generates conventional commit messages
- Tracks in project memory for context
