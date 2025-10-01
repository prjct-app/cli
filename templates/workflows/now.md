---
title: prjct now
invocable_name: p:now
description: Set or show current focus task using global prjct architecture
---

# Steps

## Without Arguments - Show Current Task

1. Read project config from `.prjct/prjct.config.json`
2. Extract `projectId` from config
3. Construct path: `~/.prjct-cli/projects/{projectId}/core/now.md`
4. Read and display current task
5. If empty, suggest using `/p:now {task}` to set focus

## With Task Argument - Set New Focus

1. Read project config from `.prjct/prjct.config.json`
2. Extract `projectId` and `author` from config
3. Clear existing task in `~/.prjct-cli/projects/{projectId}/core/now.md`
4. Write new task with timestamp
5. Log action to `~/.prjct-cli/projects/{projectId}/memory/context.jsonl` with author
6. Display confirmation: "🎯 Now working on: {task}"
7. Suggest related tasks from `~/.prjct-cli/projects/{projectId}/core/next.md`

# Response Format

```
🎯 Now working on: {task description}

📝 Task set at: {timestamp}

💡 Tip: Use /p:done when complete
```

# Global Architecture Notes

- **Data Location**: `~/.prjct-cli/projects/{id}/core/now.md`
- **Config Location**: `{project}/.prjct/prjct.config.json`
- **Author Tracking**: All operations logged with author information
- **Single Focus**: Only one task at a time for clarity
