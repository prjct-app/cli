---
allowed-tools: [Read, Write]
description: 'Complete task, clear focus'
---

# /p:done

## Validation

- Requires: `.prjct/prjct.config.json` exists
- Requires: `core/now.md` has content
- Else: "Not working on anything. Use /p:now or /p:next"

## Flow

1. Read: `core/now.md` → calculate duration
2. Clear: `core/now.md`
3. Update: `progress/metrics.md`, `core/context.md`
4. Log: `memory/context.jsonl`

## Response

```
✅ {task} ({duration})

Next?
• "start {task}" → work
• "ship {feature}" → celebrate
• /p:now | /p:ship
```
