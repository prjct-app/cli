---
allowed-tools: [Bash]
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

Execute the command silently and show only the final result:

```bash
# Without arguments - show current task
prjct now

# With arguments - set new task
prjct now "[task]"
```

The command handles all file operations internally. Show only the final message.

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
