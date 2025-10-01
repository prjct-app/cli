---
title: prjct done
invocable_name: p:done
description: Complete current task and clear focus using global prjct architecture
---

# Steps

1. Read project config from `.prjct/prjct.config.json`
2. Extract `projectId` and `author` from config
3. Read current task from `~/.prjct-cli/projects/{projectId}/core/now.md`
4. If no task set, display message and exit
5. Append completed task to `~/.prjct-cli/projects/{projectId}/progress/shipped.md` with timestamp
6. Clear `~/.prjct-cli/projects/{projectId}/core/now.md`
7. Update metrics in `~/.prjct-cli/projects/{projectId}/progress/metrics.md`
8. Log completion to `~/.prjct-cli/projects/{projectId}/memory/context.jsonl` with author
9. Read priority queue from `~/.prjct-cli/projects/{projectId}/core/next.md`
10. Suggest top priority as next task

# Response Format

```
✅ Task completed: {task description}

📊 Progress Update:
- This week: X features shipped
- Total: Y features shipped

🎯 Suggested Next Action:
{top priority from next.md}

Ready to tackle it? Use /p:now {task} to start!
```

# Global Architecture Notes

- **Data Location**: Multiple layers in `~/.prjct-cli/projects/{id}/`
  - `core/now.md` - Current task (cleared)
  - `progress/shipped.md` - Completed tasks (appended)
  - `progress/metrics.md` - Stats (updated)
  - `memory/context.jsonl` - Action log (appended)
- **Config Location**: `{project}/.prjct/prjct.config.json`
- **Author Tracking**: Completion logged with author and timestamp
