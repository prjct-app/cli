---
allowed-tools: [Bash]
description: 'Show progress metrics for specified period'
---

# /p:progress - Progress Metrics

## Purpose

Display detailed progress metrics and trends for a specified time period.

## Usage

```
/p:progress [day|week|month]
```

Default: week

## Execution

Execute the command silently and show only the final result:

```bash
prjct progress [period]
```

The command handles all file operations internally. Show only the final message.
## Implementation

1. **Parse timeframe**:
   - day: last 24 hours
   - week: current ISO week
   - month: current calendar month

2. **Calculate layered metrics**:
   - **Progress Layer**: Features shipped, velocity, trends
   - **Core Layer**: Task completion rate, focus time
   - **Planning Layer**: Roadmap progress, idea conversion rate
   - **Memory Layer**: Decision impact, learning velocity

3. **Enhanced response format**:

   ```
   📈 PROGRESS - This Week
   ━━━━━━━━━━━━━━━━━━━━━━━

   🚀 SHIPPED FEATURES
   Count: 7 features (↗ +40% vs last week)
   Velocity: 1.4 features/day
   Quality: 95% passed validation

   ⚡ CORE PRODUCTIVITY
   Tasks completed: 12 (avg 1.7/day)
   Focus time: 28h (70% efficiency)
   Context switches: 3 (↘ -50%)

   💡 PLANNING EXECUTION
   Roadmap progress: 23% complete
   Ideas converted: 4/8 (50% rate)
   Strategic alignment: High

   🧠 LEARNING & DECISIONS
   Decisions logged: 3 critical
   Key insights: Architecture patterns
   Knowledge growth: +15% complexity

   Recent ships:
   • ✅ User authentication (2h ago)
   • ✅ Dashboard redesign (1d ago)
   • ✅ API optimization (2d ago)

   🏆 Best day: Tuesday (3 features)
   🔥 Current streak: 5 days

   📂 Deep dive:
   - Metrics: .prjct/progress/metrics.md
   - Shipped: .prjct/progress/shipped.md
   ```

4. **Visual indicators**:
   - 📈 Improving
   - ➡️ Steady
   - 📉 Declining
5. **Motivational insights**:
   - "You're 40% more productive than last week!"
   - "On track to ship 10 features this week!"
   - "Your best week yet!"
