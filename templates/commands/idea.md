---
allowed-tools: [Write]
description: 'Quick idea capture'
---

# /p:idea

## Usage

```
/p:idea <text>
```

## Flow

1. Append: `planning/ideas.md` with timestamp
2. If actionable → add to `core/next.md`
3. Log: `memory/context.jsonl`

## Response

```
💡 {idea}
{✅ Added to queue | 📝 Saved to backlog}

/p:now "{idea}" | /p:next
```
