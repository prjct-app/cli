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

1. **Read indexes**: Recent data from core/, progress/, planning/ (last 30 days)
2. **Read sessions**: Last 7 days from all session directories
3. **Aggregate**: Metrics from sessions (features added, tasks done, ships)
4. **Display**: Comprehensive context and status

## Session Queries

```javascript
// Aggregate last 7 days activity
const recentSessions = await readSessions('*/sessions', -7, 'now')
const shipped = recentSessions.filter(s => s.type === 'feature_ship').length
const tasksComplete = recentSessions.filter(s => s.type === 'task_complete').length
const velocity = shipped / 7 // features per day
```

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
