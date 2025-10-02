---
allowed-tools: [Read]
description: "Get unstuck"
---

# /p:stuck

## Usage
```
/p:stuck <issue>
```

## Execution

1. Detect issue type (bug/design/perf/feature)
2. Check context:
   - `~/.prjct-cli/projects/{id}/analysis/repo-summary.md`
   - `~/.prjct-cli/projects/{id}/memory/context.jsonl`
3. Log to `memory/context.jsonl`:
   ```json
   {"action":"stuck","issue":"[desc]","category":"[type]","approach":"[steps]","status":"in_progress"}
   ```

4. Response by type:

   **Bug**: `🔍 1. Check logs 2. Isolate problem 3. Search error`

   **Design**: `🎨 1. Define requirements 2. Start simple 3. Ship MVP`

   **Performance**: `⚡ 1. Profile first 2. Fix slowest 3. Cache operations`

   **Default**: `💡 1. Break into tasks 2. Start smallest 3. Ship it`

5. Suggest breakdown + next actions:
   ```
   💡 [Type-specific guidance above]

   Let's break it down:
   1. [subtask 1] (~15min)
   2. [subtask 2] (~30min)

   Ready to start?
   • "start the first part" → Begin small
   • "add these as tasks" → Queue them
   • "think more" → Capture ideas

   Or: /p:now "[first subtask]" | /p:task | /p:idea
   ```