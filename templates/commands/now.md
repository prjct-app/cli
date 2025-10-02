---
allowed-tools: [Read, Write, Edit, TodoWrite]
description: "Manage current focus task"
---

# /p:now

## Usage
```
/p:now              # Show current
/p:now [task]       # Set focus
```

## Execution

**Show**: Read `~/.prjct-cli/projects/{id}/core/now.md`, display task + elapsed time

**Set**:
1. Update `core/now.md` with task + timestamp
2. Update `core/context.md`, `progress/metrics.md`
3. Log to `memory/context.jsonl`:
   ```json
   {"action":"now","task":"[task]","timestamp":"[ISO]","previous":"[old]","layer":"core"}
   ```
4. Response:
   ```
   🎯 Working on: [task description]
   Started: [time]

   When you're done:
   • "I'm done" or "finished"
   • Or type: /p:done

   Need help? Say "I'm stuck" or use /p:stuck
   ```