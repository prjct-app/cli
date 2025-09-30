---
allowed-tools: [Bash]
description: 'Show project context and recent activity'
---

# /p:context - Project Context

## Purpose

Display project context including type, current task, and recent activity.

## Usage

```
/p:context
```

## Execution

Execute the command silently and show only the final result:

```bash
prjct context
```

The command handles all file operations internally. Show only the final message.
## Implementation

1. **Layer aggregation**:
   - **Core Layer**: Current task from `.prjct/core/now.md`, queue from `.prjct/core/next.md`
   - **Analysis Layer**: Project insights from `.prjct/analysis/repo-summary.md`
   - **Planning Layer**: Roadmap status from `.prjct/planning/roadmap.md`
   - **Progress Layer**: Recent metrics from `.prjct/progress/metrics.md`
   - **Memory Layer**: Activity history from `.prjct/memory/context.jsonl`

2. **Enhanced context reading**:
   - Project type and architecture from analysis layer
   - Strategic alignment from planning layer
   - Performance metrics from progress layer
   - Decision history from memory layer

3. **Comprehensive response format**:

   ```
   🌍 PROJECT CONTEXT
   ━━━━━━━━━━━━━━━━━━━━━━━

   📦 PROJECT OVERVIEW
   Type: Next.js Application
   Location: /Users/dev/projects/app
   Framework: React 18, TypeScript
   Architecture: [from analysis layer]

   🎯 CURRENT FOCUS
   Task: Building user dashboard
   Started: 45 minutes ago
   Strategic alignment: High (roadmap priority #2)

   📈 RECENT PROGRESS
   Velocity: 1.4 features/day
   Streak: 5 days shipping
   Quality: 95% success rate

   🔄 RECENT ACTIVITY (from memory layer):
   • shipped: Authentication system (2h ago)
   • done: API endpoints (3h ago)
   • idea: Add real-time updates (4h ago)
   • now: Building user dashboard (45m ago)
   • decision: Chose Next.js over Nuxt (yesterday)

   💡 PLANNING STATUS
   Queue: 3 tasks pending
   Ideas: 7 captured
   Roadmap progress: 23% complete

   🧠 KEY INSIGHTS
   Recent decisions: 3 logged
   Learning areas: Architecture patterns
   Growth momentum: +15% complexity handling

   📂 LAYER NAVIGATION:
   - Core: .prjct/core/ (focus & priorities)
   - Analysis: .prjct/analysis/ (technical insights)
   - Planning: .prjct/planning/ (strategy & roadmap)
   - Progress: .prjct/progress/ (metrics & shipped)
   - Memory: .prjct/memory/ (decisions & history)

   🎯 NEXT SUGGESTED ACTION:
   Continue with current task or /p:done if complete
   ```

4. **Project insights**:
   - Dependencies summary
   - Test coverage if available
   - Build status
   - Last deploy info

5. **Smart suggestions**:
   Based on context, suggest:
   - "Long task - consider breaking down"
   - "Good time to ship and take a break"
   - "Review queue priorities"
