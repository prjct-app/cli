---
allowed-tools: [Read]
description: 'Project context and status overview'
---

# /p:recap

## Usage

```
/p:recap              # Full overview
/p:context            # Alias for recap
```

## Flow

1. Read: all data layers (core, progress, planning, analysis, memory)
2. Aggregate: project overview + metrics + recent activity
3. Display: comprehensive context and status

## Response

```
📊 PROJECT OVERVIEW
━━━━━━━━━━━━━━━━━━

📦 PROJECT
Type: {type}
Stack: {stack}

🎯 CURRENT FOCUS
Task: {task}
Started: {time_ago} ({duration})

📈 PROGRESS
Shipped: {X} this week
Velocity: {X.X} features/day

💡 PLANNING
Queue: {N} tasks
Ideas: {M} captured
Roadmap: {X}% complete

🔄 RECENT ACTIVITY
• {event}: {desc} ({time_ago})
• {event}: {desc} ({time_ago})
• {event}: {desc} ({time_ago})

{motivational_message}

/p:now | /p:status | /p:next
```
