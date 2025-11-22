---
allowed-tools: [Read, Write, Bash, TodoWrite]
description: 'Sync state + generate agents'
---

# /p:sync

## Flow
1. Execute `/p:analyze`
2. Read `analysis/repo-summary.md`
3. Generate agents per technology → `agents/`
4. Log to memory

Use: `generateDynamicAgent(name, config)`

## Response
`🔄 Synced | Generated: {agents} | Next: /p:context`
