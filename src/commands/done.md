---
allowed-tools: [Bash]
description: 'Complete current task and clear focus'
---

# /p:done - Complete Current Task

## Purpose

Mark the current task as complete and clear your focus for the next task.

## Usage

```
/p:done
```

## Execution

Execute the command silently and show only the final result:

```bash
prjct done
```

The command handles all file operations internally. Show only the final message.

## Implementation

1. **Read current task**:
   - Get task description and start time from `.prjct/core/now.md`
   - Calculate duration

2. **Clear core/now.md**:

   ```markdown
   # NOW: No current task

   Start a new task with `/p:now [task description]`

   ## Context

   - **Analysis**: See `.prjct/analysis/repo-summary.md`
   - **Planning**: See `.prjct/planning/roadmap.md`
   - **Progress**: See `.prjct/progress/metrics.md`
   ```

3. **Update progress/metrics.md**:
   - Increment completed task count
   - Update daily/weekly progress
   - Calculate productivity metrics

4. **Update core/context.md**:
   - Remove current focus
   - Update latest achievement
   - Refresh context summary

5. **Log completion**:
   Log to `.prjct/memory/context.jsonl`:

   ```json
   {
     "action": "done",
     "task": "[completed_task]",
     "started": "[start_time]",
     "completed": "[end_time]",
     "duration": "[minutes]",
     "layer": "core",
     "timestamp": "[ISO]"
   }
   ```

6. **Check core/next.md for suggestions**:
   - Read first task from priority queue
   - Suggest starting it

7. **Response format**:

   ```
   ✅ Task completed: [task]
   Duration: [time]
   📊 Updated: core/now.md, core/context.md, progress/metrics.md

   📋 Next in queue: [next_task]
   Start with: /p:now [next_task]
   ```

   Or if no next task:

   ```
   ✅ Task completed: [task]
   Duration: [time]
   📊 Updated: core/now.md, core/context.md, progress/metrics.md

   🎉 Queue is empty! Time to celebrate or add new tasks.
   💡 Use these commands:
   - `/p:idea` to brainstorm new tasks
   - `/p:roadmap` to plan ahead
   - `/p:recap` to see your progress
   ```

## Error Handling

- Handle case when no current task exists
- Provide helpful message if now.md is already empty
