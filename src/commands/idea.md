---
allowed-tools: [Bash]
description: 'Capture ideas quickly to brain dump'
---

# /p:idea - Capture Ideas

## Purpose

Quickly capture ideas, thoughts, and potential tasks without breaking flow.

## Usage

```
/p:idea <text>
```

## Execution

Execute the command silently and show only the final result:

```bash
prjct idea "<your idea>"
```

The command handles all file operations internally. Show only the final message.
## Implementation

1. **Append to planning/ideas.md**:

   ```markdown
   ## Backlog

   - [timestamp] [idea text]
     - Category: [auto-detected: feature/bug/improvement/research]
     - Priority: [auto-assessed: high/medium/low]
     - Related: [link to analysis/context if applicable]
   ```

2. **Check if actionable**:
   Action verbs: implement, add, fix, create, update, refactor, optimize, investigate

   If actionable, also append to core/next.md:

   ```markdown
   - [ ] [idea text]
     - Source: planning/ideas.md
     - Added: [timestamp]
   ```

3. **Update planning/roadmap.md**:
   - Add to appropriate roadmap section based on priority
   - Update planning metrics

4. **Log to memory/context.jsonl**:

   ```json
   {
     "action": "idea",
     "text": "[idea]",
     "timestamp": "[ISO]",
     "category": "[auto-detected]",
     "priority": "[assessed]",
     "actionable": true/false,
     "layer": "planning"
     "timestamp": "[ISO]",
     "added_to_queue": [boolean]
   }
   ```

5. **Response format**:

   ```
   💡 Idea captured: [idea]

   ✅ Also added to task queue!
   ```

   Or:

   ```
   💡 Idea captured: [idea]

   Review all ideas in .prjct/ideas.md
   ```

## Best Practices

- Capture first, organize later
- Don't overthink - just dump
- Review ideas weekly
- Convert good ideas to tasks
