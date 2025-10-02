---
allowed-tools: [Read, Write, Edit]
description: "Quick idea capture"
---

# /p:idea

## Usage
```
/p:idea <text>
```

## Execution

1. Append to `~/.prjct-cli/projects/{id}/planning/ideas.md`:
   ```markdown
   - [timestamp] [idea]
   ```

2. If actionable (has action verbs), add to `core/next.md`
3. Log to `memory/context.jsonl`:
   ```json
   {"action":"idea","text":"[idea]","category":"[type]","actionable":true,"added_to_queue":true}
   ```

4. Response (if actionable):
   ```
   💡 Idea captured: [idea text]

   ✅ Added to task queue!

   Ready to start?
   • "start this idea" → Begin now
   • "plan more" → Keep brainstorming
   • "see all ideas" → View backlog

   Or: /p:now "[idea]" | /p:idea | /p:recap
   ```

   Or (if just backlog):
   ```
   💡 Idea saved: [idea text]

   What now?
   • "add another idea" → Keep brainstorming
   • "start working" → Pick a task
   • "see my ideas" → View backlog

   Or: /p:idea | /p:now | /p:next
   ```