---
allowed-tools: [Read, Write, Bash, TodoWrite]
description: 'Sync project state and generate dynamic agents'
---

# /p:sync

## Flow

1. Run: `/p:analyze` → get current state
2. **Read**: `analysis/repo-summary.md`
3. **Generate**: Dynamic agents for each technology
4. Log: changes to `memory/context.jsonl`

## Agent Generation

**See `templates/agents/AGENTS.md` for complete reference** with examples and guidelines.

Use `generator.generateDynamicAgent(name, config)` for each specialist.

## Response

```
🔄 Sync complete!

🤖 Agents Generated:
• {agent_name_1} - {role}
• {agent_name_2} - {role}

📋 Based on: analysis/repo-summary.md
💡 See templates/agents/AGENTS.md for generation reference

/p:context
```
