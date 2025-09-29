---
allowed-tools: [Read, Write, Edit, TodoWrite]
description: 'Manage current focus task in prjct'
---

# /p:now - Current Focus Management

## Purpose

Set or display the current task you're working on. Maintains single-task focus.

## Usage

```
/p:now              # Show current task
/p:now [task]       # Set new current task
```

## Execution

### Without arguments (Show current):

1. Read `.prjct/core/now.md`
2. Display current task with start time
3. Show elapsed time if task is active
4. Show related context from analysis and planning layers

### With arguments (Set new task):

1. Check if task already in progress
2. Update `.prjct/core/now.md` with new task
3. Update `.prjct/core/context.md` with current focus
4. Update `.prjct/progress/metrics.md` with active task count
5. Log to `.prjct/memory/context.jsonl`
6. Display confirmation with cross-references

## Implementation

### Reading current task:

```
📍 Current focus: [task description]
Started: [timestamp]
Time elapsed: [duration]
```

### Setting new task:

1. **Update core/now.md**:

   ```markdown
   # NOW: [task]

   Started: [ISO_TIMESTAMP]

   ## Task

   [task description]

   ## Context

   - **Analysis**: See `.prjct/analysis/repo-summary.md`
   - **Planning**: See `.prjct/planning/roadmap.md`
   - **Progress**: See `.prjct/progress/metrics.md`

   ## Notes

   [Any context or implementation notes]
   ```

2. **Update cross-references**:
   - Update `.prjct/core/context.md` with current focus
   - Update `.prjct/progress/metrics.md` with active task count
   - Log to `.prjct/memory/context.jsonl`:

   ```json
   {
     "action": "now",
     "task": "[task]",
     "timestamp": "[ISO]",
     "previous": "[old_task]",
     "layer": "core"
   }
   ```

3. **Response format**:

   ```
   📍 Focus set: [task]
   Started at: [time]
   📊 Updated: core/now.md, core/context.md, progress/metrics.md

   💡 Stay focused! Use these commands:
   - `/p:done` when finished
   - `/p:analyze` for project insights
   - `/p:roadmap` for planning context
   ```

## Best Practices

- One task at a time
- Clear, actionable task descriptions
- Complete before switching with `/p:done`
