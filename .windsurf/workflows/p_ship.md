---
title: prjct ship
invocable_name: p:ship
description: Ship and celebrate a completed feature using global prjct architecture
---

# Steps

1. Read project config from `.prjct/prjct.config.json`
2. Extract `projectId` and `author` from config
3. Validate feature description provided
4. Add feature to `~/.prjct-cli/projects/{projectId}/progress/shipped.md` with:
   - Feature name
   - Timestamp
   - Author information
5. Update weekly and total metrics in `~/.prjct-cli/projects/{projectId}/progress/metrics.md`
6. Log shipping event to `~/.prjct-cli/projects/{projectId}/memory/context.jsonl`
7. Generate celebration message with progress stats
8. Suggest momentum-maintaining next actions

# Response Format

```
🚀 Feature Shipped: {feature name}

🎉 Celebration Time!
{motivational message about the achievement}

📈 This Week: X features shipped
💪 Total Shipped: Y features

Keep the momentum! What's next?
- Check /p:next for priority queue
- Capture new ideas with /p:idea
- Start next task with /p:now
```

# Celebration Messages

Rotate through motivational messages:
- "Awesome work! Another feature in production!"
- "That's what I call shipping! 🔥"
- "Feature delivered! You're on fire! 🚀"
- "Boom! Another one shipped! 💥"
- "Progress! Keep the momentum going! ⚡"

# Global Architecture Notes

- **Data Location**: `~/.prjct-cli/projects/{id}/progress/`
  - `shipped.md` - Completed features (appended)
  - `metrics.md` - Weekly/total stats (updated)
- **Memory Location**: `~/.prjct-cli/projects/{id}/memory/context.jsonl`
- **Config Location**: `{project}/.prjct/prjct.config.json`
- **Author Tracking**: Ships logged with author for team coordination
