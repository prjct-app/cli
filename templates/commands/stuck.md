---
allowed-tools: [Read]
description: "Get help when stuck on a problem"
---

## Global Architecture
This command uses the global prjct architecture:
- Data stored in: `~/.prjct-cli/projects/{id}/`
- Config stored in: `{project}/.prjct/prjct.config.json`
- Commands synchronized across all editors



# /p:stuck - Get Unstuck

## Purpose
Provide contextual help and suggestions when stuck on a problem.

## Usage
```
/p:stuck <issue description>
```

## Execution
1. Analyze the issue type and context
2. Reference project layers for additional context
3. Provide relevant debugging steps or approach
4. Suggest breaking into smaller tasks
5. Log insights to memory layer
6. Offer encouragement and next steps

## Implementation

1. **Issue categorization**:
   - **Bug/Error**: Debugging steps
   - **Design/Architecture**: Design approaches
   - **Performance**: Optimization strategies
   - **Feature**: Implementation breakdown
   - **General**: Problem-solving framework

2. **Response patterns**:

   **For bugs/errors**:
   ```
   🔍 Debugging approach for: [issue]
   
   1. 📋 Check error message/logs
   2. 🧑‍💻 Isolate the problem
   3. 🧪 Test smallest case
   4. 🔄 Try known working state
   5. 📚 Check documentation
   
   💡 Quick fix: [specific suggestion]
   ```

   **For design/architecture**:
   ```
   🎨 Design approach for: [issue]
   
   1. 📝 Define requirements clearly
   2. 🎯 Identify constraints
   3. 🧩 Sketch possible solutions
   4. ⚖️ Evaluate trade-offs
   5. 🌱 Start with MVP
   
   💡 Consider: [pattern/approach]
   ```

   **For performance**:
   ```
   ⚡ Performance approach for: [issue]
   
   1. 📊 Measure first (profile)
   2. 🎯 Find bottlenecks
   3. 🍎 Pick low-hanging fruit
   4. 🔄 Cache what you can
   5. 🏎️ Optimize critical path
   
   💡 Try: [optimization technique]
   ```

3. **Context integration**:
   Reference relevant layers for additional insights:
   - **Analysis Layer**: Check `.prjct/analysis/repo-summary.md` for technical context
   - **Planning Layer**: Review `.prjct/planning/roadmap.md` for strategic context
   - **Memory Layer**: Search `.prjct/memory/context.jsonl` for similar past issues
   - **Progress Layer**: Check `.prjct/progress/metrics.md` for capacity considerations

4. **Break it down**:
   ```
   🧩 Let's break this into smaller tasks:

   1. [Subtask 1] - 15 min
   2. [Subtask 2] - 30 min
   3. [Subtask 3] - 15 min

   Start with #1: /p:now "[subtask 1]"

   📂 Context available:
   - Technical: .prjct/analysis/repo-summary.md
   - Strategic: .prjct/planning/roadmap.md
   - Historical: .prjct/memory/context.jsonl
   ```

5. **Log insights**:
   Save problem-solving approach to `.prjct/memory/context.jsonl`:
   ```json
   {
     "action": "stuck",
     "issue": "[issue_description]",
     "category": "[bug|design|performance|feature|general]",
     "approach": "[debugging_strategy]",
     "timestamp": "[ISO]",
     "layer": "memory",
     "resolution_status": "in_progress"
   }
   ```

6. **Encouragement**:
   - "Every expert was once stuck here too!"
   - "This is a learning opportunity!"
   - "You're closer than you think!"
   - "Take a break, come back fresh!"