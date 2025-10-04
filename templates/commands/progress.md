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
2. Read: `progress/shipped.md` + `progress/metrics.md`
3. Calculate: velocity, trends, quality
4. Display: detailed metrics

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
