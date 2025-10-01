---
allowed-tools: [Bash, Read, Grep, Glob]
description: "Smart git operations with auto-generated commit messages"
---

## Global Architecture
This command uses the global prjct architecture:
- Data stored in: `~/.prjct-cli/projects/{id}/`
- Config stored in: `{project}/.prjct/prjct.config.json`
- Commands synchronized across all editors



# /p:git - Smart Git Operations

## Purpose
Execute git operations with intelligent commit messages and automatic best practices. No thinking required.

## Usage
```
/p:git [commit|push|status|sync]
```

Default: commit

## Execution

### `/p:git` or `/p:git commit`
1. Run `git status` to see changes
2. Analyze changes to generate smart commit message
3. Stage all changes with `git add -A`
4. Commit with generated message
5. Log to `.prjct/memory/context.jsonl`

### `/p:git push`
1. Commit any pending changes first
2. Push to current branch
3. Show deployment status if applicable

### `/p:git status`
1. Show clean git status with emoji indicators
2. Suggest next logical action

### `/p:git sync`
1. Pull latest changes
2. Commit local changes if any
3. Push to remote
4. Handle merge conflicts if needed

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