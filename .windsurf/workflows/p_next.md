---
title: prjct next
invocable_name: p:next
description: Show priority queue of upcoming tasks using global prjct architecture
---

# Steps

1. Read project config from `.prjct/prjct.config.json`
2. Extract `projectId` from config
3. Read priority queue from `~/.prjct-cli/projects/{projectId}/core/next.md`
4. Parse task list with priorities
5. Format and display tasks with priority indicators
6. Show count of queued tasks
7. Suggest using `/p:now {task}` to start working

# Response Format

```
📋 Priority Queue:

1. 🔥 {high-priority task}
2. ⚡ {medium-priority task}
3. 📌 {normal-priority task}
...

Total queued: X tasks

Ready to start? Use /p:now {task number or description}
```

# Priority Indicators

- 🔥 High priority / urgent
- ⚡ Medium priority / important
- 📌 Normal priority / routine
- 💡 Nice to have / experimental

# Global Architecture Notes

- **Data Location**: `~/.prjct-cli/projects/{id}/core/next.md`
- **Config Location**: `{project}/.prjct/prjct.config.json`
- **File Format**: Markdown list with optional priority markers
- **Integration**: Tasks can be promoted to `now.md` with `/p:now`
