---
allowed-tools: [Bash]
description: 'Show project status overview'
---

# /p:recap - Project Recap

## Purpose

Display a comprehensive overview of project status and progress.

## Usage

```
/p:recap
```

## Execution

Execute the command silently and show only the final result:

```bash
prjct recap
```

The command handles all file operations internally. Show only the final message.
## Implementation

1. **Gather cross-layer metrics**:
   - **Core Layer**: Current task and duration, next queue
   - **Progress Layer**: Shipped features, metrics, velocity trends
   - **Planning Layer**: Ideas count, roadmap progress
   - **Analysis Layer**: Repository insights, technical context
   - **Memory Layer**: Decision history, learnings

2. **Enhanced response format**:

   ```
   📊 PROJECT RECAP
   ━━━━━━━━━━━━━━━━━━━

   🎯 FOCUS
   Current: [task] (2h 15m)
   Queue: [N] tasks pending

   📈 PROGRESS
   Shipped: [X] this week, [Y] total
   Velocity: [X.X] features/day
   Streak: [N] days shipping

   💡 PLANNING
   Ideas: [M] captured
   Roadmap: [X]% complete

   🔍 INSIGHTS
   Repository: [project_type] with [tech_stack]
   Architecture: [key_patterns]

   🧠 MEMORY
   Decisions: [N] logged
   Learnings: [key_insights]

   [Motivational message based on metrics]

   📂 Quick Access:
   - Core: .prjct/core/ (focus & priorities)
   - Progress: .prjct/progress/ (metrics & shipped)
   - Planning: .prjct/planning/ (ideas & roadmap)
   - Analysis: .prjct/analysis/ (technical insights)
   ```

3. **Motivational messages**:
   - High velocity: "🔥 You're on fire! Keep shipping!"
   - Many ideas: "💡 Creative flow is strong!"
   - Long streak: "🏆 Consistency champion!"
   - Empty queue: "🎆 Time to dream bigger!"

## Visual Elements

- Use progress bars for completion
- Show week-over-week trends
- Highlight achievements
