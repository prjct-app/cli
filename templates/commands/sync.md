---
allowed-tools: [Read, Bash, TodoWrite]
description: "Sync project state and agents"
---

# /p:sync

## Flow
1. Run: `/p:analyze` → get current state
2. Compare: with previous analysis
3. Update: all existing agents with new context
4. Add: newly required agents
5. Remove: obsolete agents (with confirmation)
6. Log: changes to `memory/context.jsonl`

## Response
```
🔄 Sync complete!

📊 Changes:
• {N} agents updated
• {N} agents added
• {N} agents removed

Stack changes:
• {changes_list}

/p:status | /p:context
```

