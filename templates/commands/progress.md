---
allowed-tools: [Read]
description: 'Progress metrics for period'
---

# /p:progress

## Usage

```
/p:progress [day|week|month]  # Default: week
```

## Flow

1. Parse: timeframe (day/week/month)
2. **Calculate date range**: Based on timeframe
3. **Read sessions**: Query `progress/sessions/{YYYY-MM}/` for date range
4. **Aggregate**: Ships, tasks, duration from sessions
5. **Calculate**: Velocity, trends, quality metrics
6. Display: detailed metrics

## Session Queries by Period

```javascript
// Day: Today's sessions
const today = await readSessionFile('progress/sessions', today)
const shipped = today.filter(s => s.type === 'feature_ship')

// Week: Last 7 days
const weekSessions = await readSessions('progress/sessions', -7, 'now')
const velocity = weekSessions.filter(s => s.type === 'feature_ship').length / 7

// Month: Last 30 days
const monthSessions = await readSessions('progress/sessions', -30, 'now')
const totalTime = monthSessions
  .filter(s => s.type === 'feature_ship')
  .reduce((sum, s) => sum + parseTime(s.duration), 0)
```

## Response

```
📈 PROGRESS - This {period}
━━━━━━━━━━━━━━━━━━━━━

🚀 SHIPPED: {N} features
⚡ VELOCITY: {X.X} features/day
📊 TREND: {↗ +X%}

Recent ships:
• ✅ {feature} ({time_ago})
• ✅ {feature} ({time_ago})

🏆 Best day: {day} ({N} features)
🔥 Streak: {N} days

/p:ship | /p:status
```
