---
title: prjct recap
invocable_name: p:recap
description: Show comprehensive project overview using global prjct architecture
---

# Steps

1. Read project config from `.prjct/prjct.config.json`
2. Extract `projectId` and `author` from config
3. Read current focus from `~/.prjct-cli/projects/{projectId}/core/now.md`
4. Read recent shipped features from `~/.prjct-cli/projects/{projectId}/progress/shipped.md` (last 5)
5. Read priority queue from `~/.prjct-cli/projects/{projectId}/core/next.md` (top 3)
6. Read recent ideas from `~/.prjct-cli/projects/{projectId}/planning/ideas.md` (count)
7. Calculate metrics from `~/.prjct-cli/projects/{projectId}/progress/metrics.md`
8. Read recent context from `~/.prjct-cli/projects/{projectId}/memory/context.jsonl` (last 3 actions)
9. Format and display comprehensive overview

# Response Format

```
📊 Project Recap for {project-name}

🎯 Current Focus:
{current task or "No task set - use /p:now to set focus"}

🚀 Recently Shipped (Last 5):
- {feature 1} - {timestamp}
- {feature 2} - {timestamp}
- {feature 3} - {timestamp}
- {feature 4} - {timestamp}
- {feature 5} - {timestamp}

📋 Coming Up Next (Top 3):
1. {priority 1}
2. {priority 2}
3. {priority 3}

💡 Ideas Backlog: X ideas captured
📝 Total queued tasks: Y tasks

📈 Progress Metrics:
- This week: X features shipped
- This month: Y features shipped
- Total: Z features shipped
- Average velocity: A features/week

🕒 Recent Activity:
- {timestamp}: {action 1}
- {timestamp}: {action 2}
- {timestamp}: {action 3}

👤 Author: {name} ({github})
```

# Global Architecture Notes

- **Data Sources**: Multiple layers in `~/.prjct-cli/projects/{id}/`
  - `core/now.md` - Current task
  - `core/next.md` - Priority queue
  - `progress/shipped.md` - Completed features
  - `progress/metrics.md` - Statistics
  - `planning/ideas.md` - Ideas backlog
  - `memory/context.jsonl` - Action history
- **Config Location**: `{project}/.prjct/prjct.config.json`
- **Use Case**: Daily standup, status updates, context restoration
