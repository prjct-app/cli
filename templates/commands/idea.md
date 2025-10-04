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

1. **Append to session**: `planning/sessions/{YYYY-MM}/{YYYY-MM-DD}.jsonl`
2. **Update index**: Append to `planning/ideas.md` (keep only last 30 days)
3. If actionable → add to `core/next.md`
4. **Archive old**: If ideas.md > 30 days, move to `planning/archive/ideas-{YYYY-MM}.md`

## Session Log Format

```jsonl
{"ts":"2025-10-04T16:00:00Z","type":"idea_add","idea":"{text}","actionable":{true/false},"priority":"{high/med/low}"}
```

## Response

```
💡 {idea}
{✅ Added to queue | 📝 Saved to backlog}

/p:now "{idea}" | /p:next
```
