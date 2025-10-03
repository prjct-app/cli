---
allowed-tools: [Read]
description: "Project context and activity"
---

# /p:context

## Flow
1. Read: all layers (core, analysis, planning, progress, memory)
2. Aggregate: project overview + recent activity
3. Display: comprehensive context

## Response
```
🌍 PROJECT CONTEXT
━━━━━━━━━━━━━━━━━

📦 PROJECT
Type: {type}
Stack: {stack}

🎯 CURRENT FOCUS
Task: {task}
Started: {time_ago}

🔄 RECENT ACTIVITY
• {event}: {desc} ({time_ago})
• {event}: {desc} ({time_ago})

💡 PLANNING
Queue: {N} tasks
Ideas: {M} captured

/p:now | /p:status
```

