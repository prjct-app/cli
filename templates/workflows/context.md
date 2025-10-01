---
title: prjct context
invocable_name: p:context
description: Show project context and recent activity using global prjct architecture
---

# Steps

1. Read project config from `.prjct/prjct.config.json`
2. Extract all metadata: projectId, dataPath, author, timestamps
3. Read recent actions from `~/.prjct-cli/projects/{projectId}/memory/context.jsonl` (last 10)
4. Read current task from `~/.prjct-cli/projects/{projectId}/core/now.md`
5. Read project context from `~/.prjct-cli/projects/{projectId}/core/context.md`
6. Calculate summary statistics
7. Format and display comprehensive context

# Response Format

```
📁 Project Context

🆔 Project: {project-id}
👤 Author: {name} ({github-username})
📧 Email: {email}
📍 Project Path: {absolute-path}
💾 Data Location: ~/.prjct-cli/projects/{id}/

📊 Current State:
🎯 Focus: {current task or "No task set"}
📝 Queued: X tasks
💡 Ideas: Y ideas captured
🚀 Shipped: Z features (A this week)

🕒 Recent Activity (Last 10 Actions):
- {timestamp} | {author}: {action 1}
- {timestamp} | {author}: {action 2}
- {timestamp} | {author}: {action 3}
- {timestamp} | {author}: {action 4}
- {timestamp} | {author}: {action 5}
- {timestamp} | {author}: {action 6}
- {timestamp} | {author}: {action 7}
- {timestamp} | {author}: {action 8}
- {timestamp} | {author}: {action 9}
- {timestamp} | {author}: {action 10}

⏱️  Session Info:
- Initialized: {created timestamp}
- Last Activity: {lastSync timestamp}
- Active Days: X days

🔧 Configuration:
- Version: 0.2.1
- Global Architecture: Enabled
- Multi-Editor Sync: Active
```

# Action Types in Memory Log

Log entries include:
- Task changes: now, done
- Feature ships: ship
- Idea captures: idea
- Context updates: context
- Progress checks: recap, progress

# Global Architecture Notes

- **Config Location**: `{project}/.prjct/prjct.config.json`
- **Memory Location**: `~/.prjct-cli/projects/{id}/memory/context.jsonl`
- **Context File**: `~/.prjct-cli/projects/{id}/core/context.md`
- **Author Tracking**: Every action includes author for team visibility
- **Use Case**: Team coordination, session restoration, debugging
