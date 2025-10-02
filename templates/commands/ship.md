---
allowed-tools: [Read, Write, Edit, TodoWrite]
description: "Ship a feature"
---

# /p:ship

## Usage
```
/p:ship <feature>
```

## Execution

1. Add to `~/.prjct-cli/projects/{id}/progress/shipped.md`:
   ```markdown
   ## Week [W], [YEAR]
   - ✅ [feature] ([timestamp])
   ```

2. Update `progress/metrics.md` (count, velocity, streak)
3. Update `core/context.md`
4. Log to `memory/context.jsonl`:
   ```json
   {"action":"ship","feature":"[desc]","timestamp":"[ISO]","week":"[w]","layer":"progress","total":[n]}
   ```

5. Response:
   ```
   🚀 [feature name] shipped!

   📈 This week: [count] | Total: [total]
   Velocity: [X] features/day

   Keep the momentum!
   • "start next task" → Keep building
   • "see my progress" → View stats
   • "plan ahead" → Strategic thinking

   Or: /p:now | /p:recap | /p:roadmap
   ```