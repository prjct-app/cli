---
allowed-tools: [Read, Glob]
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

1. Read current task from `.prjct/core/now.md`
2. Aggregate metrics from `.prjct/progress/metrics.md`
3. Count shipped features from `.prjct/progress/shipped.md`
4. Count queue items from `.prjct/core/next.md`
5. Count ideas from `.prjct/planning/ideas.md`
6. Reference project analysis and context
7. Display comprehensive layered summary

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
