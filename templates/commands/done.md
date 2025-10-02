---
allowed-tools: [Read, Write, Edit, TodoWrite]
description: "Complete task, clear focus"
---

# /p:done

## Usage
```
/p:done
```

## Execution

1. Read task from `~/.prjct-cli/projects/{id}/core/now.md`, calculate duration
2. Clear `core/now.md`
3. Update `progress/metrics.md`, `core/context.md`
4. Log to `memory/context.jsonl`:
   ```json
   {"action":"done","task":"[task]","started":"[t1]","completed":"[t2]","duration":"[min]","layer":"core"}
   ```
5. Response:
   ```
   ✅ [task description] ([duration])

   What's next?
   • "start [next task]" → Begin working
   • "ship this feature" → Track & celebrate
   • "add new idea" → Brainstorm

   Or use: /p:now | /p:ship | /p:idea
   ```

   Or if queue empty:
   ```
   ✅ [task description] ([duration])

   Queue is empty! What now?
   • "add a task" → Plan next work
   • "brainstorm ideas" → Creative mode
   • "see my progress" → View achievements

   Or: /p:idea | /p:next | /p:recap
   ```