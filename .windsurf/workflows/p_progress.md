---
title: prjct progress
invocable_name: p:progress
description: Show progress metrics for specified period using global prjct architecture
---

# Steps

1. Read project config from `.prjct/prjct.config.json`
2. Extract `projectId` from config
3. Parse period argument (default: week):
   - `day` or `today` - Today's progress
   - `week` - This week (Mon-Sun)
   - `month` - This month
   - `all` or `total` - All-time
4. Read all shipped features from `~/.prjct-cli/projects/{projectId}/progress/shipped.md`
5. Filter entries by timestamp for specified period
6. Calculate metrics:
   - Total features shipped
   - Average velocity
   - Completion rate
   - Momentum indicators
7. Read metrics file for additional stats
8. Format and display progress report

# Response Format

## Daily Progress
```
📊 Progress Report - Today

🚀 Features Shipped: X features
⏱️  Active Time: Y hours
✅ Tasks Completed: Z tasks

📈 Momentum: {High/Medium/Low}

Keep it up! 💪
```

## Weekly Progress
```
📊 Progress Report - This Week

🚀 Features Shipped: X features
📅 Days Active: Y of 7 days
⚡ Velocity: A features/day
✅ Tasks Completed: Z tasks

📈 Week Trend: {Up/Steady/Down}
💡 Ideas Captured: B ideas

{comparison to last week}

🎯 Next Week Goal: {suggestion}
```

## Monthly Progress
```
📊 Progress Report - This Month

🚀 Features Shipped: X features
📅 Active Days: Y of 30 days
⚡ Monthly Velocity: A features/week
✅ Total Tasks: Z tasks
💡 Ideas Generated: B ideas

📈 Month Highlights:
- Best week: {date} with {n} features
- Most productive day: {day} with {n} tasks
- Momentum: {analysis}

🎯 Month-End Goal: {progress toward goal}
```

## All-Time Progress
```
📊 Progress Report - All Time

🚀 Total Features Shipped: X features
📅 Project Duration: Y days
⚡ Average Velocity: A features/week
✅ Total Tasks Completed: Z tasks
💡 Total Ideas: B ideas

📈 Milestones:
- {milestone 1}
- {milestone 2}
- {milestone 3}

🏆 Achievements:
- Most productive week: {date}
- Longest streak: {n} days
- Best month: {month}

Keep building! 🚀
```

# Calculations

- **Velocity**: Features / Time Period
- **Momentum**: Based on recent trend (last 3 data points)
- **Active Days**: Days with at least 1 logged action
- **Streak**: Consecutive days with activity

# Global Architecture Notes

- **Data Source**: `~/.prjct-cli/projects/{id}/progress/`
  - `shipped.md` - All completed features with timestamps
  - `metrics.md` - Aggregated statistics
- **Memory Source**: `~/.prjct-cli/projects/{id}/memory/context.jsonl` for activity
- **Config Location**: `{project}/.prjct/prjct.config.json`
- **Use Case**: Standups, retrospectives, velocity tracking
