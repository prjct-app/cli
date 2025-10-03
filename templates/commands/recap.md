---
allowed-tools: [Read]
description: "Project status overview"
---

# /p:recap

## Flow
1. Read: all data layers (core, progress, planning, analysis, memory)
2. Aggregate: metrics and status from each layer
3. Display: comprehensive overview

## Response
```
📊 PROJECT RECAP
━━━━━━━━━━━━━━━━

🎯 FOCUS
Current: {task} ({duration})
Queue: {N} tasks

📈 PROGRESS
Shipped: {X} this week
Velocity: {X.X} features/day

💡 PLANNING
Ideas: {M} captured
Roadmap: {X}% complete

{motivational_message}

/p:now | /p:status | /p:next
```

