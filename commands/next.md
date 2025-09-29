---
allowed-tools: [Read, Write, Edit]
description: 'Display and manage priority queue'
---

# /p:next - Priority Queue

## Purpose

Display the prioritized queue of upcoming tasks.

## Usage

```
/p:next
```

## Execution

1. Read `.prjct/core/next.md`
2. Display numbered list of pending tasks with context
3. Show task count and suggest next action
4. Reference related planning and progress layers

## Implementation

1. **Read core/next.md**:
   - Parse markdown list of tasks
   - Number them for easy reference
   - Show task priorities and contexts

2. **Context integration**:
   - Reference planning/roadmap.md for strategic context
   - Show progress/metrics.md for capacity planning
   - Link to analysis/repo-summary.md for technical context

3. **Response format**:

   ```
   📋 Priority Queue ([count] tasks):

   1. [first task]
      - Context: [link to planning/analysis if relevant]
      - Priority: [high/medium/low]
   2. [second task]
   3. [third task]
   ...

   💡 Start next task with: /p:now "[first task]"
   📊 Context: See planning/roadmap.md for strategic priorities
   ```

   Or if empty:

   ```
   📋 Queue is empty!

   Add tasks:
   - Directly edit .prjct/core/next.md
   - Use /p:idea for quick capture
   - Check /p:roadmap for strategic planning

   📂 Related:
   - Planning: .prjct/planning/roadmap.md
   - Ideas: .prjct/planning/ideas.md
   ```

## Tips

- Keep queue short (5-10 items)
- Most important tasks first
- Review and reprioritize regularly
